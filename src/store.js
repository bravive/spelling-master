import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { usersCol, trophiesCol, wordstatsCol, roundhistoryCol, credithistoryCol, weeklyChallengeWordsCol, weeklyStatsCol, friendshipsCol, messagesCol, trophyhistoryCol, giftsCol, inviteCodesCol } from './db.js';

const now = () => new Date();

const log = (op, collection, filter) =>
  console.log(`[db] ${op} ${collection}${filter ? ' ' + JSON.stringify(filter) : ''}`);

// Upsert for related collections — keyed by userId (UUID foreign key)
const upsert = (col, userId, data) => {
  log('upsert', col.collectionName, { userId });
  return col.updateOne(
    { userId },
    { $set: { ...data, updated_at: now() }, $setOnInsert: { _id: randomUUID(), created_at: now() } },
    { upsert: true }
  );
};

// ── Users ─────────────────────────────────────────────────────────────────────

export const getAllUsers = () => {
  log('find', 'users');
  return usersCol().find({}).toArray();
};

// Login lookup — find by username
export const findUser = (username) => {
  log('findOne', 'users', { userId: username });
  return usersCol().findOne({ userId: username });
};

// Auth lookup — find by UUID
export const findUserById = (id) => {
  log('findOne', 'users', { _id: id });
  return usersCol().findOne({ _id: id });
};

export const createUser = async ({ key, name, pin, starterId, starterSlug }) => {
  const hashedPin = await bcrypt.hash(pin, 10);
  const t = now();
  const user = {
    _id: randomUUID(), userId: key,
    name, pin: hashedPin, starterId, starterSlug,
    level: 1, totalCredits: 0, creditBank: 0, streak: 0,
    lastPlayed: null, streakDates: [], caught: 0, roundCount: 0,
    created_at: t, updated_at: t,
  };
  log('insertOne', 'users', { userId: key });
  await usersCol().insertOne(user);

  // Related collections use the user's UUID as the foreign key
  const colBase = { created_at: t, updated_at: t };
  log('insertOne', 'trophies+wordstats+roundhistory+credithistory', { userId: user._id });
  await Promise.all([
    trophiesCol().insertOne({ _id: randomUUID(), userId: user._id, collection: {}, shinyEligible: false, consecutiveRegular: 0, nextPokemonId: null, ...colBase }),
    wordstatsCol().insertOne({ _id: randomUUID(), userId: user._id, stats: {}, ...colBase }),
    roundhistoryCol().insertOne({ _id: randomUUID(), userId: user._id, roundHistory: [], bestScores: {}, ...colBase }),
    credithistoryCol().insertOne({ _id: randomUUID(), userId: user._id, creditHistory: [], ...colBase }),
  ]);

  return user;
};

export const checkPin = async (user, pin) => {
  if (typeof user.pin === 'string' && user.pin.startsWith('$2')) {
    // bcrypt hash: try the entered PIN, then fallback to old 4-digit without '88' prefix
    if (await bcrypt.compare(pin, user.pin)) return true;
    if (pin.startsWith('88') && pin.length === 6) {
      return bcrypt.compare(pin.slice(2), user.pin);
    }
    return false;
  }
  // Plain-text legacy PIN: try direct match then '88' prefix fallback
  const match = user.pin === pin || (pin.startsWith('88') && pin.length === 6 && user.pin === pin.slice(2));
  if (match) {
    const hashed = await bcrypt.hash(user.pin, 10);
    log('updateOne', 'users', { _id: user._id, op: 'upgradePin' });
    await usersCol().updateOne({ _id: user._id }, { $set: { pin: hashed, updated_at: now() } });
  }
  return match;
};

// Updates a user's PIN (hashes before storing)
export const updateUserPin = async (id, newPin) => {
  const hashed = await bcrypt.hash(newPin, 10);
  log('updateOne', 'users', { _id: id, op: 'updatePin' });
  return usersCol().updateOne({ _id: id }, { $set: { pin: hashed, updated_at: now() } });
};

// Updates a user by UUID
export const updateUser = (id, updates) => {
  log('updateOne', 'users', { _id: id });
  return usersCol().updateOne(
    { _id: id },
    { $set: { ...updates, updated_at: now() } }
  );
};

// Deletes user by UUID and cascades to related collections
export const deleteUser = async (id) => {
  log('deleteOne', 'users', { _id: id });
  const result = await usersCol().deleteOne({ _id: id });
  if (result.deletedCount === 0) return false;
  log('deleteOne', 'trophies+wordstats+roundhistory+credithistory+trophyhistory+weeklystats+gifts', { userId: id });
  await Promise.all([
    trophiesCol().deleteOne({ userId: id }),
    wordstatsCol().deleteOne({ userId: id }),
    roundhistoryCol().deleteOne({ userId: id }),
    credithistoryCol().deleteOne({ userId: id }),
    trophyhistoryCol().deleteMany({ userId: id }),
    weeklyStatsCol().deleteMany({ userId: id }),
    giftsCol().deleteMany({ $or: [{ fromUserId: id }, { toUserId: id }] }),
  ]);
  return true;
};

// ── Trophies (Pokemon collection) ─────────────────────────────────────────────

export const getTrophy = (id) => {
  log('findOne', 'trophies', { userId: id });
  return trophiesCol().findOne({ userId: id });
};

export const saveTrophy = (id, data) => upsert(trophiesCol(), id, data);

// ── Wordstats ─────────────────────────────────────────────────────────────────

export const getWordStats = async (id) => {
  log('findOne', 'wordstats', { userId: id });
  const doc = await wordstatsCol().findOne({ userId: id });
  return doc?.stats ?? {};
};

export const saveWordStats = (id, stats) => upsert(wordstatsCol(), id, { stats });

// ── Roundhistory ──────────────────────────────────────────────────────────────

export const getRoundHistory = (id) => {
  log('findOne', 'roundhistory', { userId: id });
  return roundhistoryCol().findOne({ userId: id });
};

export const saveRoundHistory = (id, data) => upsert(roundhistoryCol(), id, data);

// ── Credit history ───────────────────────────────────────────────────────────

export const getCreditHistory = async (id) => {
  log('findOne', 'credithistory', { userId: id });
  const doc = await credithistoryCol().findOne({ userId: id });
  return doc?.creditHistory ?? [];
};

export const saveCreditHistory = (id, creditHistory) => upsert(credithistoryCol(), id, { creditHistory });

// ── Trophy history (manage operations log) ─────────────────────────────────

export const getTrophyHistory = async (id) => {
  log('find', 'trophyhistory', { userId: id });
  return trophyhistoryCol().find({ userId: id }).sort({ created_at: -1 }).toArray();
};

export const addTrophyHistoryEntry = (userId, entry) => {
  log('insertOne', 'trophyhistory', { userId, action: entry.action });
  return trophyhistoryCol().insertOne({
    _id: randomUUID(), userId, ...entry, created_at: now(),
  });
};

// ── Weekly challenge words ────────────────────────────────────────────────────


export const getAllWeeks = () => {
  log('find', 'weeklychallengewords');
  return weeklyChallengeWordsCol().find({}).sort({ startDate: 1 }).toArray();
};

// ── Weekly challenge stats ────────────────────────────────────────────────────

export const getAllWeeklyStats = async (userId) => {
  log('find', 'weeklychallengestats', { userId });
  const docs = await weeklyStatsCol().find({ userId }).toArray();
  // Return as a map keyed by weekId for easy frontend lookup
  return Object.fromEntries(docs.map(d => [d.weekId, d]));
};

export const saveWeeklyStats = (userId, weekId, data) => {
  log('upsert', 'weeklychallengestats', { userId, weekId });
  return weeklyStatsCol().updateOne(
    { userId, weekId },
    { $set: { ...data, updated_at: now() }, $setOnInsert: { _id: randomUUID(), userId, weekId, created_at: now() } },
    { upsert: true }
  );
};

// ── Friendships ─────────────────────────────────────────────────────────────

// Ensure user1 < user2 for the unique compound index
const orderedPair = (a, b) => a < b ? [a, b] : [b, a];

export const createFriendship = async (fromId, toId) => {
  const [user1, user2] = orderedPair(fromId, toId);
  const t = now();
  const doc = {
    _id: randomUUID(), user1, user2, initiator: fromId,
    status: 'pending', created_at: t, updated_at: t,
  };
  log('insertOne', 'friendships', { user1, user2 });
  await friendshipsCol().insertOne(doc);
  return doc;
};

export const findFriendship = (id1, id2) => {
  const [user1, user2] = orderedPair(id1, id2);
  log('findOne', 'friendships', { user1, user2 });
  return friendshipsCol().findOne({ user1, user2 });
};

export const findFriendshipById = (id) => {
  log('findOne', 'friendships', { _id: id });
  return friendshipsCol().findOne({ _id: id });
};

export const acceptFriendship = (id) => {
  log('updateOne', 'friendships', { _id: id, op: 'accept' });
  return friendshipsCol().updateOne(
    { _id: id },
    { $set: { status: 'accepted', updated_at: now() } }
  );
};

export const deleteFriendship = (id) => {
  log('deleteOne', 'friendships', { _id: id });
  return friendshipsCol().deleteOne({ _id: id });
};

export const getUserFriendships = (userId) => {
  log('find', 'friendships', { userId });
  return friendshipsCol().find({
    $or: [{ user1: userId }, { user2: userId }],
  }).toArray();
};

// ── Messages ────────────────────────────────────────────────────────────────

export const createMessage = async (fromId, toId, text) => {
  const t = now();
  const doc = { _id: randomUUID(), from: fromId, to: toId, text, read: false, created_at: t };
  log('insertOne', 'messages', { from: fromId, to: toId });
  await messagesCol().insertOne(doc);
  return doc;
};

export const getMessages = (userId1, userId2, limit = 50) => {
  log('find', 'messages', { between: [userId1, userId2] });
  return messagesCol().find({
    $or: [
      { from: userId1, to: userId2 },
      { from: userId2, to: userId1 },
    ],
  }).sort({ created_at: -1 }).limit(limit).toArray();
};

export const markMessagesRead = (toId, fromId) => {
  log('updateMany', 'messages', { to: toId, from: fromId, op: 'markRead' });
  return messagesCol().updateMany(
    { to: toId, from: fromId, read: false },
    { $set: { read: true } }
  );
};

export const getUnreadCounts = async (userId) => {
  log('aggregate', 'messages', { to: userId, op: 'unreadCounts' });
  const results = await messagesCol().aggregate([
    { $match: { to: userId, read: false } },
    { $group: { _id: '$from', count: { $sum: 1 } } },
  ]).toArray();
  return Object.fromEntries(results.map(r => [r._id, r.count]));
};

// ── Gifts (Pokemon gifting between friends) ─────────────────────────────────

export const createGift = async (fromUserId, toUserId, pokemonId, pokemonSlug, isShiny = false) => {
  const t = now();
  const doc = {
    _id: randomUUID(), fromUserId, toUserId, pokemonId, pokemonSlug, isShiny,
    status: 'pending', created_at: t, updated_at: t,
  };
  log('insertOne', 'gifts', { fromUserId, toUserId, pokemonId, isShiny });
  await giftsCol().insertOne(doc);
  return doc;
};

export const findPendingGift = (fromUserId, toUserId, pokemonId, isShiny = false) => {
  log('findOne', 'gifts', { fromUserId, toUserId, pokemonId, isShiny, status: 'pending' });
  return giftsCol().findOne({ fromUserId, toUserId, pokemonId, isShiny, status: 'pending' });
};

export const findGiftById = (id) => {
  log('findOne', 'gifts', { _id: id });
  return giftsCol().findOne({ _id: id });
};

export const getUserGifts = (userId) => {
  log('find', 'gifts', { userId, status: 'pending' });
  return giftsCol().find({
    status: 'pending',
    $or: [{ fromUserId: userId }, { toUserId: userId }],
  }).sort({ created_at: -1 }).toArray();
};

export const countPendingOutgoingGifts = (fromUserId, pokemonId, isShiny = false) => {
  log('count', 'gifts', { fromUserId, pokemonId, isShiny, status: 'pending' });
  return giftsCol().countDocuments({ fromUserId, pokemonId, isShiny, status: 'pending' });
};

export const acceptGift = (id) => {
  log('updateOne', 'gifts', { _id: id, op: 'accept' });
  return giftsCol().updateOne(
    { _id: id },
    { $set: { status: 'accepted', updated_at: now() } }
  );
};

export const declineGift = (id) => {
  log('updateOne', 'gifts', { _id: id, op: 'decline' });
  return giftsCol().updateOne(
    { _id: id },
    { $set: { status: 'declined', updated_at: now() } }
  );
};

export const cancelPendingGiftsBetween = (userId1, userId2) => {
  log('updateMany', 'gifts', { between: [userId1, userId2], op: 'cancelAll' });
  return giftsCol().updateMany(
    {
      status: 'pending',
      $or: [
        { fromUserId: userId1, toUserId: userId2 },
        { fromUserId: userId2, toUserId: userId1 },
      ],
    },
    { $set: { status: 'cancelled', updated_at: now() } }
  );
};

// ── Invite Codes ──────────────────────────────────────────────────────────────

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous I/O/1/0
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

export const createInviteCode = async (createdBy, createdByName) => {
  const t = now();
  let code;
  // Retry on duplicate code collision (astronomically unlikely but safe)
  for (let attempt = 0; attempt < 10; attempt++) {
    code = generateCode();
    try {
      const doc = { _id: randomUUID(), code, createdBy, createdByName, usedBy: null, usedByName: null, usedAt: null, created_at: t, updated_at: t };
      log('insertOne', 'invitecodes', { code, createdBy });
      await inviteCodesCol().insertOne(doc);
      return doc;
    } catch (e) {
      if (e.code !== 11000) throw e; // re-throw non-duplicate errors
    }
  }
  throw new Error('Failed to generate unique invite code');
};

export const findInviteCode = (code) => {
  log('findOne', 'invitecodes', { code });
  return inviteCodesCol().findOne({ code: code.toUpperCase() });
};

export const consumeInviteCode = (code, usedById, usedByName) => {
  log('updateOne', 'invitecodes', { code, op: 'consume' });
  return inviteCodesCol().updateOne(
    { code: code.toUpperCase(), usedBy: null },
    { $set: { usedBy: usedById, usedByName, usedAt: now(), updated_at: now() } }
  );
};

export const countUserInviteCodes = (createdBy) => {
  log('count', 'invitecodes', { createdBy });
  return inviteCodesCol().countDocuments({ createdBy });
};

export const getUserInviteCodes = (createdBy) => {
  log('find', 'invitecodes', { createdBy });
  return inviteCodesCol().find({ createdBy }).sort({ created_at: -1 }).toArray();
};

export const getAllInviteCodes = () => {
  log('find', 'invitecodes (admin)');
  return inviteCodesCol().find({}).sort({ created_at: -1 }).toArray();
};

// ── Admin dashboard queries ──────────────────────────────────────────────────

export const getAdminFriendships = async () => {
  log('find', 'friendships (admin)');
  const [friendships, allMessages, users] = await Promise.all([
    friendshipsCol().find({}).toArray(),
    messagesCol().aggregate([
      { $group: {
        _id: { $cond: [{ $lt: ['$from', '$to'] }, { u1: '$from', u2: '$to' }, { u1: '$to', u2: '$from' }] },
        count: { $sum: 1 },
        last: { $max: '$created_at' },
      }},
    ]).toArray(),
    usersCol().find({}).toArray(),
  ]);

  const userMap = Object.fromEntries(users.map(u => [u._id, u]));
  const msgMap = {};
  allMessages.forEach(m => {
    const key = `${m._id.u1}:${m._id.u2}`;
    msgMap[key] = { count: m.count, last: m.last };
  });

  return friendships.map(f => {
    const u1 = userMap[f.user1] || {};
    const u2 = userMap[f.user2] || {};
    const key = `${f.user1}:${f.user2}`;
    const msgs = msgMap[key] || { count: 0, last: null };
    return {
      id: f._id, status: f.status,
      user1: { id: f.user1, name: u1.name, userId: u1.userId, starterSlug: u1.starterSlug },
      user2: { id: f.user2, name: u2.name, userId: u2.userId, starterSlug: u2.starterSlug },
      initiator: f.initiator,
      messageCount: msgs.count,
      lastMessage: msgs.last,
      created_at: f.created_at,
    };
  });
};

export const getAdminUsers = async () => {
  log('find', 'users (admin)');
  const users = await usersCol().find({}).toArray();
  const allTrophies = await trophiesCol().find({}).toArray();
  const allWordstats = await wordstatsCol().find({}).toArray();
  const allRoundhistory = await roundhistoryCol().find({}).toArray();

  const trophyMap = Object.fromEntries(allTrophies.map(t => [t.userId, t]));
  const wsMap = Object.fromEntries(allWordstats.map(w => [w.userId, w]));
  const rhMap = Object.fromEntries(allRoundhistory.map(r => [r.userId, r]));

  return users.map(u => {
    const trophy = trophyMap[u._id] || {};
    const ws = wsMap[u._id] || {};
    const rh = rhMap[u._id] || {};
    const stats = ws.stats || {};
    const masteredCount = Object.values(stats).filter(s => s.attempts >= 3 && (s.correct / s.attempts) >= 0.8).length;
    const totalWordsAttempted = Object.keys(stats).length;
    const rounds = rh.roundHistory || [];
    const avgScore = rounds.length ? (rounds.reduce((sum, r) => sum + r.score, 0) / rounds.length).toFixed(1) : null;
    const shinyCount = Object.values(trophy.collection || {}).filter(c => c.shiny).length;

    return {
      id: u._id, userId: u.userId, name: u.name,
      level: u.level, streak: u.streak, lastPlayed: u.lastPlayed,
      totalCredits: u.totalCredits, creditBank: u.creditBank,
      caught: u.caught, roundCount: u.roundCount,
      starterSlug: u.starterSlug,
      created_at: u.created_at, updated_at: u.updated_at,
      masteredCount, totalWordsAttempted, avgScore, shinyCount,
      rounds,
    };
  });
};

export const getAdminTrends = async () => {
  // Build last-7-days date buckets
  const roundsByDay = {};
  const weeklyByDay = {};
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    dates.push(d);
    roundsByDay[d] = 0;
    weeklyByDay[d] = 0;
  }
  const minDate = dates[0];

  // Rounds per day — from roundhistory collection
  const rhDocs = await roundhistoryCol().find({}, { projection: { roundHistory: 1 } }).toArray();
  for (const doc of rhDocs) {
    for (const r of (doc.roundHistory || [])) {
      if (r.date >= minDate && r.date in roundsByDay) roundsByDay[r.date]++;
    }
  }

  // Weekly completions per day — credithistory where source='weekly' and 'completed' in description
  const chDocs = await credithistoryCol().find({}, { projection: { creditHistory: 1 } }).toArray();
  for (const doc of chDocs) {
    for (const e of (doc.creditHistory || [])) {
      if (e.source === 'weekly' && e.description?.includes('completed') && e.date >= minDate && e.date in weeklyByDay) {
        weeklyByDay[e.date]++;
      }
    }
  }

  return { roundsByDay, weeklyByDay, dates };
};
