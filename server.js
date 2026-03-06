import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { rateLimit } from 'express-rate-limit';
import { connectDb, usersCol, collectionsCol, wordstatsCol, roundhistoryCol } from './src/db.js';

const ADMIN_KEY = 'test';

const DEV_JWT_SECRET = 'dev-secret-do-not-use-in-production';
const DEV_ADMIN_PIN  = '0000';

const JWT_SECRET = process.env.JWT_SECRET || DEV_JWT_SECRET;
const ADMIN_PIN  = process.env.ADMIN_PIN  || DEV_ADMIN_PIN;

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('[ERROR] JWT_SECRET env var is not set in production! Refusing to start.');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const now = () => new Date();

// Strip internal fields before sending to client
const publicUser = ({ pin: _pin, _id: __id, ...rest }) => rest;

const upsert = (col, userId, data) =>
  col.updateOne(
    { userId },
    { $set: { ...data, updated_at: now() }, $setOnInsert: { _id: randomUUID(), created_at: now() } },
    { upsert: true }
  );

// ── Express ───────────────────────────────────────────────────────────────────
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));

// ── Request logging ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  let responseBody;

  const origJson = res.json.bind(res);
  res.json = (body) => { responseBody = body; return origJson(body); };

  res.on('finish', () => {
    const ms = Date.now() - start;
    const auth = req.headers.authorization;
    let user = 'anon';
    if (auth?.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(auth.slice(7), JWT_SECRET);
        user = payload.isAdmin ? 'admin' : payload.userId;
      } catch { user = 'invalid-token'; }
    }
    const status = res.statusCode;
    const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
    const reset = '\x1b[0m';
    const ts = new Date().toISOString();
    const bodyStr = responseBody !== undefined ? ' → ' + JSON.stringify(responseBody) : '';
    console.log(`[${ts}] ${color}${status}${reset} ${req.method} ${req.originalUrl} [${user}] ${ms}ms${bodyStr}`);
  });
  next();
});

// ── Rate limiting ─────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: process.env.NODE_ENV === 'test' ? 10000 : 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true, legacyHeaders: false,
});

// ── Auth middleware ───────────────────────────────────────────────────────────
const requireAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.jwtUser = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    if (!req.jwtUser.isAdmin) return res.status(403).json({ error: 'Admin only' });
    next();
  });
};

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /ping
app.get('/ping', (_req, res) => {
  res.json({ ok: true, db: 'mongodb' });
});

// GET /api/users — public profile list, no PINs
app.get('/api/users', async (_req, res) => {
  const users = await usersCol().find({}).toArray();
  const pub = {};
  for (const u of users) pub[u.userId] = publicUser(u);
  res.json(pub);
});

// POST /api/auth/login — validate PIN, return JWT
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { userId, pin } = req.body;
  if (!userId || typeof pin !== 'string')
    return res.status(400).json({ error: 'userId and pin are required' });

  if (userId === ADMIN_KEY) {
    if (pin !== ADMIN_PIN) return res.status(401).json({ error: 'Wrong PIN' });
    const token = jwt.sign({ userId: ADMIN_KEY, isAdmin: true }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ token, user: { name: 'Admin', isAdmin: true } });
  }

  const user = await usersCol().findOne({ userId });
  if (!user) return res.status(401).json({ error: 'Wrong PIN' });

  let match;
  if (typeof user.pin === 'string' && user.pin.startsWith('$2')) {
    match = await bcrypt.compare(pin, user.pin);
  } else {
    match = user.pin === pin;
    if (match) {
      const hashed = await bcrypt.hash(pin, 10);
      await upsert(usersCol(), userId, { pin: hashed });
    }
  }

  if (!match) return res.status(401).json({ error: 'Wrong PIN' });

  const token = jwt.sign({ userId, isAdmin: false }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: publicUser(user) });
});

// POST /api/users — create new profile
app.post('/api/users', async (req, res) => {
  const { key, name, pin, starterId, starterSlug } = req.body;
  if (!key || !name || !pin || !starterId || !starterSlug)
    return res.status(400).json({ error: 'Missing required fields' });
  if (!/^\d{4}$/.test(pin))       return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
  if (key === ADMIN_KEY)           return res.status(400).json({ error: 'That name is reserved' });
  if (!/^[a-z0-9_]+$/.test(key))  return res.status(400).json({ error: 'Invalid key format' });

  const exists = await usersCol().findOne({ userId: key });
  if (exists) return res.status(409).json({ error: 'Name already taken' });

  const hashedPin = await bcrypt.hash(pin, 10);
  const t = now();
  const user = {
    _id: randomUUID(), userId: key,
    name, pin: hashedPin, starterId, starterSlug,
    level: 1, totalCredits: 0, creditBank: 0, streak: 0,
    lastPlayed: null, streakDates: [], caught: 0, roundCount: 0,
    created_at: t, updated_at: t,
  };
  await usersCol().insertOne(user);

  // Initialise related collections
  const colBase = { created_at: t, updated_at: t };
  await Promise.all([
    collectionsCol().insertOne({ _id: randomUUID(), userId: key, collection: {}, shinyEligible: false, consecutiveRegular: 0, ...colBase }),
    wordstatsCol().insertOne({ _id: randomUUID(), userId: key, stats: {}, ...colBase }),
    roundhistoryCol().insertOne({ _id: randomUUID(), userId: key, roundHistory: [], bestScores: {}, ...colBase }),
  ]);

  res.status(201).json({ ok: true, user: publicUser(user) });
});

// PUT /api/users/me — save game state for current user
app.put('/api/users/me', requireAuth, async (req, res) => {
  const userId = req.jwtUser.userId;
  const exists = await usersCol().findOne({ userId });
  if (!exists) return res.status(404).json({ error: 'User not found' });

  const { pin: _pin, _id: __id, ...updates } = req.body;
  await upsert(usersCol(), userId, updates);
  res.json({ ok: true });
});

// DELETE /api/users/:id — admin only
app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (id === ADMIN_KEY) return res.status(400).json({ error: 'Cannot delete admin' });

  const result = await usersCol().deleteOne({ userId: id });
  if (result.deletedCount === 0) return res.status(404).json({ error: 'User not found' });

  // Clean up related collections
  await Promise.all([
    collectionsCol().deleteOne({ userId: id }),
    wordstatsCol().deleteOne({ userId: id }),
    roundhistoryCol().deleteOne({ userId: id }),
  ]);
  res.json({ ok: true });
});

// GET /api/collection — current user's Pokémon collection
app.get('/api/collection', requireAuth, async (req, res) => {
  const userId = req.jwtUser.userId;
  const doc = await collectionsCol().findOne({ userId });
  res.json(doc ?? { collection: {}, shinyEligible: false, consecutiveRegular: 0 });
});

// PUT /api/collection — save current user's Pokémon collection
app.put('/api/collection', requireAuth, async (req, res) => {
  await upsert(collectionsCol(), req.jwtUser.userId, req.body);
  res.json({ ok: true });
});

// GET /api/wordstats — current user's word stats
app.get('/api/wordstats', requireAuth, async (req, res) => {
  const doc = await wordstatsCol().findOne({ userId: req.jwtUser.userId });
  res.json(doc?.stats ?? {});
});

// PUT /api/wordstats — save current user's word stats
app.put('/api/wordstats', requireAuth, async (req, res) => {
  await upsert(wordstatsCol(), req.jwtUser.userId, { stats: req.body });
  res.json({ ok: true });
});

// GET /api/roundhistory — current user's round history
app.get('/api/roundhistory', requireAuth, async (req, res) => {
  const doc = await roundhistoryCol().findOne({ userId: req.jwtUser.userId });
  res.json(doc ?? { roundHistory: [], bestScores: {} });
});

// PUT /api/roundhistory — save current user's round history
app.put('/api/roundhistory', requireAuth, async (req, res) => {
  await upsert(roundhistoryCol(), req.jwtUser.userId, req.body);
  res.json({ ok: true });
});

// ── Serve React app in production ─────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const distPath = join(dirname(fileURLToPath(import.meta.url)), 'dist');
  app.use(express.static(distPath));
  app.get('/*path', (_req, res) => res.sendFile(join(distPath, 'index.html')));
}

export { app };

// Only bind when run directly (not imported by tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = process.env.PORT || 3001;
  connectDb().then(() => {
    app.listen(PORT, () => console.log(`Spell Master API running on http://localhost:${PORT}`));
  }).catch(err => {
    console.error('[ERROR] Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
}
