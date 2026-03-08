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
  getCreditHistory, saveCreditHistory,
  getTrophyHistory, addTrophyHistoryEntry,
  getAllWeeks, getAllWeeklyStats, saveWeeklyStats,
  getAdminUsers,
  createFriendship, findFriendship, findFriendshipById, acceptFriendship, deleteFriendship, getUserFriendships,
  createMessage, getMessages, markMessagesRead, getUnreadCounts,
  createGift, findPendingGift, findGiftById, getUserGifts, countPendingOutgoingGifts, acceptGift, declineGift, cancelPendingGiftsBetween,
  getAdminFriendships,
  createInviteCode, findInviteCode, consumeInviteCode, countUserInviteCodes, getUserInviteCodes, getAllInviteCodes,
} from './src/store.js';
// Inline isPkCaught to avoid importing browser-dependent shared.js
const pkCount = (owned) => owned?.count != null ? owned.count : (owned?.regular ? 1 : 0);
const isPkCaught = (owned) => pkCount(owned) >= 1;

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

// POST /api/users — create new profile (requires invite code)
app.post('/api/users', async (req, res) => {
  const { key, name, pin, starterId, starterSlug, inviteCode } = req.body;
  if (!key || !name || !pin || !starterId || !starterSlug)
    return res.status(400).json({ error: 'Missing required fields' });
  if (!inviteCode)                 return res.status(400).json({ error: 'Invite code is required' });
  if (!/^\d{4}$/.test(pin))       return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
  if (key === ADMIN_KEY)           return res.status(400).json({ error: 'That name is reserved' });
  if (key === 'test')              return res.status(400).json({ error: 'That name is reserved' });
  if (!/^[a-z0-9_]+$/.test(key))  return res.status(400).json({ error: 'Invalid key format' });

  if (await findUser(key)) return res.status(409).json({ error: 'Name already taken' });

  const codeDoc = await findInviteCode(inviteCode);
  if (!codeDoc)          return res.status(400).json({ error: 'Invalid invite code' });
  if (codeDoc.usedBy)    return res.status(400).json({ error: 'Invite code already used' });

  const user = await createUser({ key, name, pin, starterId, starterSlug });
  await consumeInviteCode(inviteCode, user._id, user.name);
  res.status(201).json({ ok: true, user: publicUser(user) });
});

// PUT /api/users/me — save game state for current user
app.put('/api/users/me', requireAuth, async (req, res) => {
  const { id } = req.jwtUser;
  if (!await findUserById(id)) return res.status(404).json({ error: 'User not found' });

  const { pin: _pin, _id: __id, id: _id2,
          collection: _col, creditHistory: _ch, roundHistory: _rh, wordStats: _ws,
          shinyEligible: _se, consecutiveRegular: _cr, nextPokemonId: _np,
          bestScores: _bs, ...updates } = req.body;
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
    const key = trimmed.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!key) return res.status(400).json({ error: 'Name must contain at least one letter or number' });
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

// GET /api/admin/invite-codes — admin: all invite codes
app.get('/api/admin/invite-codes', requireAdmin, async (_req, res) => {
  res.json(await getAllInviteCodes());
});

// POST /api/admin/invite-codes — admin: create unlimited invite codes
app.post('/api/admin/invite-codes', requireAdmin, async (_req, res) => {
  const code = await createInviteCode('admin', 'Admin');
  res.status(201).json(code);
});

// GET /api/invite-codes/validate?code=... — public: check if code is valid & unused
app.get('/api/invite-codes/validate', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'code is required' });
  const doc = await findInviteCode(code);
  if (!doc || doc.usedBy) return res.json({ valid: false });
  res.json({ valid: true });
});

// GET /api/invite-codes — user: list their own created codes
app.get('/api/invite-codes', requireAuth, async (req, res) => {
  if (req.jwtUser.isAdmin) return res.json(await getAllInviteCodes());
  res.json(await getUserInviteCodes(req.jwtUser.id));
});

// POST /api/invite-codes — user: create invite code (max 5 total per user)
app.post('/api/invite-codes', requireAuth, async (req, res) => {
  if (req.jwtUser.isAdmin) return res.status(403).json({ error: 'Use /api/admin/invite-codes' });
  const user = await findUserById(req.jwtUser.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const count = await countUserInviteCodes(req.jwtUser.id);
  if (count >= 5) return res.status(400).json({ error: 'You have reached the maximum of 5 invite codes' });
  const code = await createInviteCode(req.jwtUser.id, user.name);
  res.status(201).json(code);
});

app.get('/api/trophy', requireAuth, async (req, res) => {
  const doc = await getTrophy(req.jwtUser.id);
  if (!doc) return res.json({ collection: {}, shinyEligible: false, consecutiveRegular: 0, nextPokemonId: null });
  const { _id, userId, created_at, updated_at, ...trophy } = doc;
  const result = { collection: {}, shinyEligible: false, consecutiveRegular: 0, nextPokemonId: null, ...trophy };

  // Clear nextPokemonId if it points to an already-caught Pokémon
  if (result.nextPokemonId && isPkCaught(result.collection[result.nextPokemonId])) {
    result.nextPokemonId = null;
    saveTrophy(req.jwtUser.id, { nextPokemonId: null }).catch(() => {});
  }

  res.json(result);
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
  res.json(doc ?? { roundHistory: [], bestScores: {} });
});

app.put('/api/roundhistory', requireAuth, async (req, res) => {
  const { creditHistory: _ch, ...data } = req.body;
  await saveRoundHistory(req.jwtUser.id, data);
  res.json({ ok: true });
});

app.get('/api/credithistory', requireAuth, async (req, res) => {
  const history = await getCreditHistory(req.jwtUser.id);
  res.json(history);
});

app.put('/api/credithistory', requireAuth, async (req, res) => {
  await saveCreditHistory(req.jwtUser.id, req.body);
  res.json({ ok: true });
});

app.get('/api/trophyhistory', requireAuth, async (req, res) => {
  res.json(await getTrophyHistory(req.jwtUser.id));
});

app.post('/api/trophyhistory', requireAuth, async (req, res) => {
  await addTrophyHistoryEntry(req.jwtUser.id, req.body);
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
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const { usersCol: _uc } = await import('./src/db.js');
  const col = _uc();
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const users = await col.find({
    name: { $regex: `^${escaped}$`, $options: 'i' },
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
    const caught = Object.values(col).filter(c => (c.count || (c.regular ? 1 : 0)) >= 1).length;
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

  // Cancel any pending gifts between these users
  const friendId = f.user1 === myId ? f.user2 : f.user1;
  await Promise.all([
    deleteFriendship(f._id),
    cancelPendingGiftsBetween(myId, friendId),
  ]);
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

// ── Gifts ──────────────────────────────────────────────────────────────────

// Send a gift
app.post('/api/gifts/send', requireAuth, async (req, res) => {
  const myId = req.jwtUser.id;
  const { toUserId, pokemonId, isShiny = false } = req.body;
  if (!toUserId || pokemonId == null) return res.status(400).json({ error: 'toUserId and pokemonId are required' });

  // Must be accepted friends
  const friendship = await findFriendship(myId, toUserId);
  if (!friendship || friendship.status !== 'accepted') return res.status(403).json({ error: 'Not friends' });

  // Look up sender's collection
  const trophy = await getTrophy(myId);
  const col = trophy?.collection || {};
  const owned = col[pokemonId];

  if (isShiny) {
    // Validate sender owns the shiny variant
    if (!owned?.shiny) return res.status(400).json({ error: 'You do not own the shiny of this Pokemon' });
    // Only one shiny can be pending at a time (you only have one)
    const pendingShiny = await countPendingOutgoingGifts(myId, pokemonId, true);
    if (pendingShiny >= 1) return res.status(400).json({ error: 'Your shiny is already reserved for a pending gift' });
  } else {
    const count = pkCount(owned);
    if (count < 1) return res.status(400).json({ error: 'You do not own this Pokemon' });
    // Account for pending outgoing regular gifts
    const pendingCount = await countPendingOutgoingGifts(myId, pokemonId, false);
    if (count - pendingCount < 1) return res.status(400).json({ error: 'All copies are reserved for pending gifts' });
  }

  // Prevent duplicate pending gift of same type
  const existing = await findPendingGift(myId, toUserId, pokemonId, isShiny);
  if (existing) return res.status(409).json({ error: 'Gift already pending for this Pokemon' });

  // Resolve slug
  const { ALL_POKEMON } = await import('./src/data/pokemon.js');
  const pk = ALL_POKEMON.find(p => p.id === pokemonId);
  if (!pk) return res.status(400).json({ error: 'Invalid Pokemon' });

  const gift = await createGift(myId, toUserId, pokemonId, pk.slug, isShiny);
  res.status(201).json({ ok: true, giftId: gift._id });
});

// List pending gifts (incoming + outgoing)
app.get('/api/gifts', requireAuth, async (req, res) => {
  const myId = req.jwtUser.id;
  const gifts = await getUserGifts(myId);

  // Enrich with user profiles
  const userIds = [...new Set(gifts.flatMap(g => [g.fromUserId, g.toUserId]))];
  const { usersCol: _uc } = await import('./src/db.js');
  const users = userIds.length > 0 ? await _uc().find({ _id: { $in: userIds } }).toArray() : [];
  const userMap = Object.fromEntries(users.map(u => [u._id, u]));

  res.json(gifts.map(g => ({
    ...g,
    fromName: userMap[g.fromUserId]?.name || 'Unknown',
    fromStarterSlug: userMap[g.fromUserId]?.starterSlug,
    toName: userMap[g.toUserId]?.name || 'Unknown',
    toStarterSlug: userMap[g.toUserId]?.starterSlug,
  })));
});

// Count incoming pending gifts (for badge)
app.get('/api/gifts/pending-count', requireAuth, async (req, res) => {
  const { giftsCol: _gc } = await import('./src/db.js');
  const count = await _gc().countDocuments({ toUserId: req.jwtUser.id, status: 'pending' });
  res.json({ count });
});

// Accept a gift
app.put('/api/gifts/:giftId/accept', requireAuth, async (req, res) => {
  const gift = await findGiftById(req.params.giftId);
  if (!gift) return res.status(404).json({ error: 'Gift not found' });
  if (gift.status !== 'pending') return res.status(400).json({ error: 'Gift is no longer pending' });
  if (gift.toUserId !== req.jwtUser.id) return res.status(403).json({ error: 'Not your gift to accept' });

  // Re-validate sender still owns the pokemon (or its shiny)
  const senderTrophy = await getTrophy(gift.fromUserId);
  const senderCol = senderTrophy?.collection || {};
  const senderOwned = senderCol[gift.pokemonId];
  const newSenderCol = { ...senderCol };

  const recipientTrophy = await getTrophy(gift.toUserId);
  const recipientCol = recipientTrophy?.collection || {};
  const recipientOwned = recipientCol[gift.pokemonId] || {};
  const newRecipientCol = { ...recipientCol };

  if (gift.isShiny) {
    // Re-validate sender still has the shiny
    if (!senderOwned?.shiny) {
      await declineGift(gift._id);
      return res.status(400).json({ error: 'Sender no longer has the shiny of this Pokemon' });
    }
    // Remove shiny from sender; keep regular copies if any
    const updatedSender = { ...senderOwned, shiny: false };
    if (pkCount(updatedSender) === 0 && !updatedSender.shiny) {
      delete newSenderCol[gift.pokemonId];
    } else {
      newSenderCol[gift.pokemonId] = updatedSender;
    }
    // Add shiny to recipient and also increment their regular count
    newRecipientCol[gift.pokemonId] = { ...recipientOwned, shiny: true, count: pkCount(recipientOwned) + 1 };
  } else {
    const senderCount = pkCount(senderOwned);
    const otherPending = await countPendingOutgoingGifts(gift.fromUserId, gift.pokemonId, false);
    // This gift is one of the pending, so available = count - (otherPending - 1)
    if (senderCount - (otherPending - 1) < 1) {
      await declineGift(gift._id);
      return res.status(400).json({ error: 'Sender no longer has this Pokemon available' });
    }
    // Decrement sender count
    const newSenderCount = senderCount - 1;
    if (newSenderCount <= 0 && !senderOwned?.shiny) {
      delete newSenderCol[gift.pokemonId];
    } else {
      newSenderCol[gift.pokemonId] = { ...senderOwned, count: newSenderCount };
    }
    // Increment recipient count
    newRecipientCol[gift.pokemonId] = { ...recipientOwned, count: pkCount(recipientOwned) + 1 };
  }

  await saveTrophy(gift.fromUserId, { collection: newSenderCol });
  await saveTrophy(gift.toUserId, { collection: newRecipientCol });

  // Update caught counts for both users
  const senderCaught = Object.values(newSenderCol).filter(c => isPkCaught(c)).length;
  const recipientCaught = Object.values(newRecipientCol).filter(c => isPkCaught(c)).length;
  await Promise.all([
    updateUser(gift.fromUserId, { caught: senderCaught }),
    updateUser(gift.toUserId, { caught: recipientCaught }),
  ]);

  // Log trophy history for both
  const senderUser = await findUserById(gift.fromUserId);
  const recipientUser = await findUserById(gift.toUserId);
  await Promise.all([
    addTrophyHistoryEntry(gift.fromUserId, { action: 'gift_sent', pokemon: gift.pokemonSlug, toUser: recipientUser?.name || 'Unknown' }),
    addTrophyHistoryEntry(gift.toUserId, { action: 'gift_received', pokemon: gift.pokemonSlug, fromUser: senderUser?.name || 'Unknown' }),
  ]);

  await acceptGift(gift._id);
  res.json({ ok: true });
});

// Decline or cancel a gift
app.put('/api/gifts/:giftId/decline', requireAuth, async (req, res) => {
  const gift = await findGiftById(req.params.giftId);
  if (!gift) return res.status(404).json({ error: 'Gift not found' });
  if (gift.status !== 'pending') return res.status(400).json({ error: 'Gift is no longer pending' });

  const myId = req.jwtUser.id;
  if (gift.fromUserId !== myId && gift.toUserId !== myId) return res.status(403).json({ error: 'Not your gift' });

  await declineGift(gift._id);
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
  // Listen immediately so Railway's healthcheck can reach /ping while DB connects
  app.listen(PORT, () => console.log(`Spell Master API running on http://localhost:${PORT}`));
  connectDb()
    .catch(err => {
      console.error('[ERROR] Failed to connect to MongoDB:', err.message);
      process.exit(1);
    });
}
