import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { connectDb } from './src/db.js';
import {
  getAllUsers, findUser, findUserById, createUser, checkPin, updateUser, updateUserPin,
  getTrophy, saveTrophy,
  getWordStats, saveWordStats,
  getRoundHistory, saveRoundHistory,
  getAllWeeks, getAllWeeklyStats, saveWeeklyStats,
  getAdminUsers,
  createFriendship, findFriendship, findFriendshipById, acceptFriendship, deleteFriendship, getUserFriendships,
  createMessage, getMessages, markMessagesRead, getUnreadCounts,
  getAdminFriendships,
} from './src/store.js';

const ADMIN_KEY = 'admin';
const ADMIN_ID  = 'admin';

const DEV_JWT_SECRET = 'dev-secret-do-not-use-in-production';
const DEV_ADMIN_PIN  = '0000';

const JWT_SECRET = process.env.JWT_SECRET || DEV_JWT_SECRET;
const ADMIN_PIN  = process.env.ADMIN_PIN  || DEV_ADMIN_PIN;

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('[ERROR] JWT_SECRET env var is not set in production! Refusing to start.');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Rename _id → id and strip pin before sending to client
const publicUser = ({ pin: _pin, _id, ...rest }) => ({ id: _id, ...rest });

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
        user = payload.isAdmin ? 'admin' : payload.id;
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

app.get('/ping', (_req, res) => res.json({ ok: true }));

// GET /api/users — public profile list, keyed by UUID
app.get('/api/users', async (_req, res) => {
  const users = await getAllUsers();
  const pub = {};
  for (const u of users) pub[u._id] = publicUser(u);
  res.json(pub);
});

// POST /api/auth/login — validate PIN, return JWT with user UUID
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { userId, pin, rememberMe } = req.body;
  if (!userId || typeof pin !== 'string')
    return res.status(400).json({ error: 'userId and pin are required' });

  const expiry = rememberMe ? '30d' : '8h';

  if (userId === ADMIN_KEY) {
    if (pin !== ADMIN_PIN) return res.status(401).json({ error: 'Wrong PIN' });
    const token = jwt.sign({ id: ADMIN_ID, isAdmin: true }, JWT_SECRET, { expiresIn: expiry });
    return res.json({ token, user: { name: 'Admin', isAdmin: true } });
  }

  const user = await findUser(userId);
  if (!user) return res.status(401).json({ error: 'Wrong PIN' });

  const match = await checkPin(user, pin);
  if (!match) return res.status(401).json({ error: 'Wrong PIN' });

  const token = jwt.sign({ id: user._id, isAdmin: false }, JWT_SECRET, { expiresIn: expiry });
  res.json({ token, user: publicUser(user) });
});

// POST /api/users — create new profile
app.post('/api/users', async (req, res) => {
  const { key, name, pin, starterId, starterSlug } = req.body;
  if (!key || !name || !pin || !starterId || !starterSlug)
    return res.status(400).json({ error: 'Missing required fields' });
  if (!/^\d{4}$/.test(pin))       return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
  if (key === ADMIN_KEY)           return res.status(400).json({ error: 'That name is reserved' });
  if (key === 'test')              return res.status(400).json({ error: 'That name is reserved' });
  if (!/^[a-z0-9_]+$/.test(key))  return res.status(400).json({ error: 'Invalid key format' });

  if (await findUser(key)) return res.status(409).json({ error: 'Name already taken' });

  const user = await createUser({ key, name, pin, starterId, starterSlug });
  res.status(201).json({ ok: true, user: publicUser(user) });
});

// PUT /api/users/me — save game state for current user
app.put('/api/users/me', requireAuth, async (req, res) => {
  const { id } = req.jwtUser;
  if (!await findUserById(id)) return res.status(404).json({ error: 'User not found' });

  const { pin: _pin, _id: __id, id: _id2, ...updates } = req.body;
  await updateUser(id, updates);
  res.json({ ok: true });
});

// PUT /api/users/me/profile — update profile (name, PIN, avatar). Requires current PIN.
app.put('/api/users/me/profile', requireAuth, async (req, res) => {
  const { id } = req.jwtUser;
  const user = await findUserById(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { currentPin, newName, newPin, starterId, starterSlug } = req.body;
  if (!currentPin) return res.status(400).json({ error: 'Current PIN is required' });

  const match = await checkPin(user, currentPin);
  if (!match) return res.status(401).json({ error: 'Wrong PIN' });

  const updates = {};

  if (newName !== undefined) {
    const trimmed = newName.trim();
    if (!trimmed) return res.status(400).json({ error: 'Name cannot be empty' });
    const key = trimmed.toLowerCase().replace(/\s+/g, '_');
    if (key === ADMIN_KEY || key === 'test') return res.status(400).json({ error: 'That name is reserved' });
    if (!/^[a-z0-9_]+$/.test(key)) return res.status(400).json({ error: 'Invalid name format' });
    const existing = await findUser(key);
    if (existing && existing._id !== id) return res.status(409).json({ error: 'Name already taken' });
    updates.name = trimmed;
    updates.userId = key;
  }

  if (newPin !== undefined) {
    if (!/^\d{4}$/.test(newPin)) return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    await updateUserPin(id, newPin);
  }

  if (starterId !== undefined && starterSlug !== undefined) {
    updates.starterId = starterId;
    updates.starterSlug = starterSlug;
  }

  if (Object.keys(updates).length > 0) {
    await updateUser(id, updates);
  }

  const updated = await findUserById(id);
  res.json({ ok: true, user: publicUser(updated) });
});

// GET /api/admin/users — admin dashboard: all users with detailed stats
app.get('/api/admin/users', requireAdmin, async (_req, res) => {
  const users = await getAdminUsers();
  res.json(users);
});

// GET /api/admin/friendships — admin dashboard: all friendships with message stats
app.get('/api/admin/friendships', requireAdmin, async (_req, res) => {
  res.json(await getAdminFriendships());
});

app.get('/api/trophy', requireAuth, async (req, res) => {
  const doc = await getTrophy(req.jwtUser.id);
  res.json(doc ?? { collection: {}, shinyEligible: false, consecutiveRegular: 0 });
});

app.put('/api/trophy', requireAuth, async (req, res) => {
  await saveTrophy(req.jwtUser.id, req.body);
  res.json({ ok: true });
});

app.get('/api/wordstats', requireAuth, async (req, res) => {
  res.json(await getWordStats(req.jwtUser.id));
});

app.put('/api/wordstats', requireAuth, async (req, res) => {
  await saveWordStats(req.jwtUser.id, req.body);
  res.json({ ok: true });
});

app.get('/api/roundhistory', requireAuth, async (req, res) => {
  const doc = await getRoundHistory(req.jwtUser.id);
  res.json(doc ?? { roundHistory: [], bestScores: {}, creditHistory: [] });
});

app.put('/api/roundhistory', requireAuth, async (req, res) => {
  await saveRoundHistory(req.jwtUser.id, req.body);
  res.json({ ok: true });
});

// GET /api/weekly-words — all weeks sorted by startDate, no auth required
app.get('/api/weekly-words', async (_req, res) => {
  const weeks = await getAllWeeks();
  res.json(weeks);
});

// GET /api/weekly-stats — all weekly stats for current user, keyed by weekId
app.get('/api/weekly-stats', requireAuth, async (req, res) => {
  res.json(await getAllWeeklyStats(req.jwtUser.id));
});

// PUT /api/weekly-stats/:weekId — upsert stats for one week
app.put('/api/weekly-stats/:weekId', requireAuth, async (req, res) => {
  await saveWeeklyStats(req.jwtUser.id, req.params.weekId, req.body);
  res.json({ ok: true });
});

// ── Friends ──────────────────────────────────────────────────────────────────

// Search users by name (excludes self)
app.get('/api/friends/search', requireAuth, async (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (!q) return res.json([]);
  const { usersCol: _uc } = await import('./src/db.js');
  const col = _uc();
  const users = await col.find({
    userId: { $regex: q, $options: 'i' },
    _id: { $ne: req.jwtUser.id },
  }).limit(10).toArray();
  res.json(users.map(u => ({ id: u._id, userId: u.userId, name: u.name, starterSlug: u.starterSlug, level: u.level })));
});

// Get unread message counts per friend
app.get('/api/friends/unread', requireAuth, async (req, res) => {
  res.json(await getUnreadCounts(req.jwtUser.id));
});

// List all friendships (accepted + pending received)
app.get('/api/friends', requireAuth, async (req, res) => {
  const myId = req.jwtUser.id;
  const friendships = await getUserFriendships(myId);

  // Collect friend user IDs to look up their profiles + trophies
  const friendIds = friendships.map(f => f.user1 === myId ? f.user2 : f.user1);
  const { usersCol: _uc, trophiesCol: _tc } = await import('./src/db.js');
  const [friendUsers, friendTrophies] = await Promise.all([
    _uc().find({ _id: { $in: friendIds } }).toArray(),
    _tc().find({ userId: { $in: friendIds } }).toArray(),
  ]);
  const userMap = Object.fromEntries(friendUsers.map(u => [u._id, u]));
  const trophyMap = Object.fromEntries(friendTrophies.map(t => [t.userId, t]));

  const result = friendships.map(f => {
    const friendId = f.user1 === myId ? f.user2 : f.user1;
    const u = userMap[friendId] || {};
    const t = trophyMap[friendId] || {};
    const col = t.collection || {};
    const caught = Object.values(col).filter(c => c.regular).length;
    const shinyCount = Object.values(col).filter(c => c.shiny).length;
    return {
      friendshipId: f._id,
      status: f.status,
      initiator: f.initiator,
      friendId,
      name: u.name,
      userId: u.userId,
      starterSlug: u.starterSlug,
      level: u.level,
      streak: u.streak,
      caught,
      shinyCount,
    };
  });
  res.json(result);
});

// Send friend invite
app.post('/api/friends/invite', requireAuth, async (req, res) => {
  const { toUserId } = req.body;
  if (!toUserId) return res.status(400).json({ error: 'toUserId is required' });
  const myId = req.jwtUser.id;
  if (toUserId === myId) return res.status(400).json({ error: 'Cannot friend yourself' });

  // Check target exists
  const target = await findUserById(toUserId);
  if (!target) return res.status(404).json({ error: 'User not found' });

  // Check existing
  const existing = await findFriendship(myId, toUserId);
  if (existing) {
    if (existing.status === 'accepted') return res.status(409).json({ error: 'Already friends' });
    return res.status(409).json({ error: 'Invite already pending' });
  }

  const doc = await createFriendship(myId, toUserId);
  res.status(201).json({ ok: true, friendshipId: doc._id });
});

// Accept friend invite
app.put('/api/friends/:friendshipId/accept', requireAuth, async (req, res) => {
  const f = await findFriendshipById(req.params.friendshipId);
  if (!f) return res.status(404).json({ error: 'Not found' });

  const myId = req.jwtUser.id;
  // Only the non-initiator can accept
  if (f.initiator === myId) return res.status(403).json({ error: 'Cannot accept your own invite' });
  // Must be a participant
  if (f.user1 !== myId && f.user2 !== myId) return res.status(403).json({ error: 'Not your invite' });
  if (f.status === 'accepted') return res.json({ ok: true });

  await acceptFriendship(f._id);
  res.json({ ok: true });
});

// Decline invite or remove friend
app.delete('/api/friends/:friendshipId', requireAuth, async (req, res) => {
  const f = await findFriendshipById(req.params.friendshipId);
  if (!f) return res.status(404).json({ error: 'Not found' });

  const myId = req.jwtUser.id;
  if (f.user1 !== myId && f.user2 !== myId) return res.status(403).json({ error: 'Not your friendship' });

  await deleteFriendship(f._id);
  res.json({ ok: true });
});

// Get messages with a friend
app.get('/api/friends/:friendId/messages', requireAuth, async (req, res) => {
  const myId = req.jwtUser.id;
  const friendId = req.params.friendId;

  // Verify friendship exists and is accepted
  const f = await findFriendship(myId, friendId);
  if (!f || f.status !== 'accepted') return res.status(403).json({ error: 'Not friends' });

  const msgs = await getMessages(myId, friendId);
  // Mark messages from friend as read
  await markMessagesRead(myId, friendId);
  res.json(msgs.reverse());
});

// Send message to a friend
app.post('/api/friends/:friendId/messages', requireAuth, async (req, res) => {
  const myId = req.jwtUser.id;
  const friendId = req.params.friendId;
  const { text } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0)
    return res.status(400).json({ error: 'Message text is required' });
  if (text.length > 200)
    return res.status(400).json({ error: 'Message too long (max 200 characters)' });

  const f = await findFriendship(myId, friendId);
  if (!f || f.status !== 'accepted') return res.status(403).json({ error: 'Not friends' });

  const msg = await createMessage(myId, friendId, text.trim());
  res.status(201).json(msg);
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
  // Listen immediately so Railway's healthcheck can reach /ping while DB connects
  app.listen(PORT, () => console.log(`Spell Master API running on http://localhost:${PORT}`));
  connectDb()
    .catch(err => {
      console.error('[ERROR] Failed to connect to MongoDB:', err.message);
      process.exit(1);
    });
}
