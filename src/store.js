import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { usersCol, trophiesCol, wordstatsCol, roundhistoryCol, weeklyChallengeWordsCol, weeklyStatsCol } from './db.js';

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
  log('insertOne', 'trophies+wordstats+roundhistory', { userId: user._id });
  await Promise.all([
    trophiesCol().insertOne({ _id: randomUUID(), userId: user._id, collection: {}, shinyEligible: false, consecutiveRegular: 0, ...colBase }),
    wordstatsCol().insertOne({ _id: randomUUID(), userId: user._id, stats: {}, ...colBase }),
    roundhistoryCol().insertOne({ _id: randomUUID(), userId: user._id, roundHistory: [], bestScores: {}, creditHistory: [], ...colBase }),
  ]);

  return user;
};

export const checkPin = async (user, pin) => {
  if (typeof user.pin === 'string' && user.pin.startsWith('$2')) {
    return bcrypt.compare(pin, user.pin);
  }
  const match = user.pin === pin;
  if (match) {
    const hashed = await bcrypt.hash(pin, 10);
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
  log('deleteOne', 'trophies+wordstats+roundhistory+weeklystats', { userId: id });
  await Promise.all([
    trophiesCol().deleteOne({ userId: id }),
    wordstatsCol().deleteOne({ userId: id }),
    roundhistoryCol().deleteOne({ userId: id }),
    weeklyStatsCol().deleteMany({ userId: id }),
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

// ── Weekly challenge words ────────────────────────────────────────────────────

export const seedWeeklyWords = async (weeks) => {
  const col = weeklyChallengeWordsCol();
  const existing = new Set((await col.find({}, { projection: { weekId: 1 } }).toArray()).map(d => d.weekId));
  const toInsert = weeks.filter(w => !existing.has(w.id));
  if (toInsert.length === 0) {
    console.log('[seed] Weekly words already up to date');
    return;
  }
  await col.insertMany(toInsert.map(w => ({ _id: w.id, weekId: w.id, ...w })));
  console.log(`[seed] Inserted ${toInsert.length} weekly word set(s): ${toInsert.map(w => w.id).join(', ')}`);
};

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

// ── Admin dashboard queries ──────────────────────────────────────────────────

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
