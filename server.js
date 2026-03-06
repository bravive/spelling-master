import express from 'express';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || join(__dirname, 'data');
const DATA_FILE = join(DATA_DIR, 'users.json');
const ADMIN_KEY = 'test';

// Dev/test defaults — intentionally hardcoded for local development.
// Override with environment variables in production.
const DEV_JWT_SECRET = 'dev-secret-do-not-use-in-production';
const DEV_ADMIN_PIN  = '0000';

const JWT_SECRET = process.env.JWT_SECRET || DEV_JWT_SECRET;
const ADMIN_PIN  = process.env.ADMIN_PIN  || DEV_ADMIN_PIN;

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('[ERROR] JWT_SECRET env var is not set in production! Refusing to start.');
  process.exit(1);
}

// Ensure data directory exists
mkdirSync(DATA_DIR, { recursive: true });

const readUsers = () => {
  try { return JSON.parse(readFileSync(DATA_FILE, 'utf8')); }
  catch { return {}; }
};

const writeUsers = (data) => {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
};

// Strip PIN before sending to client
const publicUser = ({ pin: _pin, ...rest }) => rest;

const app = express();
app.use(express.json({ limit: '2mb' }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
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

// GET /ping — health check + volume diagnostics
app.get('/ping', (_req, res) => {
  const volumeEnv = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  let dataFileExists = false;
  try { readFileSync(DATA_FILE); dataFileExists = true; } catch { /* noop */ }
  res.json({
    ok: true,
    volume: {
      RAILWAY_VOLUME_MOUNT_PATH: volumeEnv ?? null,
      DATA_DIR,
      DATA_FILE,
      dataFileExists,
    },
  });
});

// GET /api/users — public profile list, no PINs
app.get('/api/users', (_req, res) => {
  const users = readUsers();
  const pub = {};
  for (const [k, u] of Object.entries(users)) pub[k] = publicUser(u);
  res.json(pub);
});

// POST /api/auth/login — validate PIN, return JWT
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { userId, pin } = req.body;
  if (!userId || typeof pin !== 'string') {
    return res.status(400).json({ error: 'userId and pin are required' });
  }

  // Admin login
  if (userId === ADMIN_KEY) {
    if (pin !== ADMIN_PIN) return res.status(401).json({ error: 'Wrong PIN' });
    const token = jwt.sign({ userId: ADMIN_KEY, isAdmin: true }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ token, user: { name: 'Admin', isAdmin: true } });
  }

  const users = readUsers();
  const user  = users[userId];
  if (!user) return res.status(401).json({ error: 'Wrong PIN' }); // don't leak "user not found"

  // Support legacy plaintext PINs — hash on first successful login
  let match;
  if (typeof user.pin === 'string' && user.pin.startsWith('$2')) {
    match = await bcrypt.compare(pin, user.pin);
  } else {
    match = user.pin === pin;
    if (match) {
      users[userId].pin = await bcrypt.hash(pin, 10);
      writeUsers(users);
    }
  }

  if (!match) return res.status(401).json({ error: 'Wrong PIN' });

  const token = jwt.sign({ userId, isAdmin: false }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: publicUser(users[userId]) });
});

// POST /api/users — create new profile (open, no auth required)
app.post('/api/users', async (req, res) => {
  const { key, name, pin, starterId, starterSlug } = req.body;
  if (!key || !name || !pin || !starterId || !starterSlug) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!/^\d{4}$/.test(pin))  return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
  if (key === ADMIN_KEY)     return res.status(400).json({ error: 'That name is reserved' });
  if (!/^[a-z0-9_]+$/.test(key)) return res.status(400).json({ error: 'Invalid key format' });

  const users = readUsers();
  if (users[key]) return res.status(409).json({ error: 'Name already taken' });

  const hashedPin = await bcrypt.hash(pin, 10);
  const user = {
    name, pin: hashedPin, starterId, starterSlug,
    level: 1, totalCredits: 0, creditBank: 0, streak: 0,
    lastPlayed: null, streakDates: [], collection: {},
    shinyEligible: false, consecutiveRegular: 0,
    wordStats: {}, roundHistory: [], bestScores: {},
    createdAt: new Date().toISOString(),
  };
  users[key] = user;
  writeUsers(users);
  res.status(201).json({ ok: true, user: publicUser(user) });
});

// PUT /api/users/:id — save game state (own user or admin)
app.put('/api/users/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  if (req.jwtUser.userId !== id && !req.jwtUser.isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const users = readUsers();
  if (!users[id]) return res.status(404).json({ error: 'User not found' });

  // Never allow overwriting the stored PIN via this endpoint
  const { pin: _pin, ...updates } = req.body;
  users[id] = { ...users[id], ...updates };
  writeUsers(users);
  res.json({ ok: true });
});

// DELETE /api/users/:id — admin only
app.delete('/api/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  if (id === ADMIN_KEY) return res.status(400).json({ error: 'Cannot delete admin' });

  const users = readUsers();
  if (!users[id]) return res.status(404).json({ error: 'User not found' });
  delete users[id];
  writeUsers(users);
  res.json({ ok: true });
});

// ── Serve React app in production ─────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const distPath = join(__dirname, 'dist');
  app.use(express.static(distPath));
  // Express 5 requires a named wildcard — bare '*' throws in path-to-regexp v8
  app.get('/*path', (_req, res) => res.sendFile(join(distPath, 'index.html')));
}

export { app };

// Only bind when run directly (not imported by tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Spell Master API running on http://localhost:${PORT}`));
}
