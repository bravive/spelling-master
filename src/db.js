import { MongoClient } from 'mongodb';

let client;
let db;

export const resolveMongoUri = () => {
  const uri = process.env.MONGO_URL;
  if (!uri) throw new Error('Missing required env var: MONGO_URL');
  return uri;
};

export const connectDb = async (uriOverride) => {
  const uri = uriOverride ?? resolveMongoUri();
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.MONGODATABASE || 'spell-master');
  await ensureIndexes();
  console.log(`[db] Connected to MongoDB: ${db.databaseName}`);
};

export const getDb = () => {
  if (!db) throw new Error('Database not connected — call connectDb() first');
  return db;
};

export const closeDb = async () => {
  await client?.close();
  db = null;
  client = null;
};

// ── Collection helpers (MongoDB collection = table) ───────────────────────────
export const usersCol                = () => getDb().collection('users');
export const trophiesCol             = () => getDb().collection('trophies');
export const wordstatsCol            = () => getDb().collection('wordstats');
export const roundhistoryCol         = () => getDb().collection('roundhistory');
export const credithistoryCol        = () => getDb().collection('credithistory');
export const weeklyChallengeWordsCol = () => getDb().collection('weeklychallengewords');
export const weeklyStatsCol          = () => getDb().collection('weeklychallengestats');
export const friendshipsCol          = () => getDb().collection('friendships');
export const messagesCol             = () => getDb().collection('messages');

// ── Indexes ───────────────────────────────────────────────────────────────────
const ensureIndexes = async () => {
  await Promise.all([
    usersCol().createIndex({ userId: 1 }, { unique: true }),
    trophiesCol().createIndex({ userId: 1 }, { unique: true }),
    wordstatsCol().createIndex({ userId: 1 }, { unique: true }),
    roundhistoryCol().createIndex({ userId: 1 }, { unique: true }),
    credithistoryCol().createIndex({ userId: 1 }, { unique: true }),
    weeklyChallengeWordsCol().createIndex({ weekId: 1 }, { unique: true }),
    weeklyChallengeWordsCol().createIndex({ startDate: 1 }),
    weeklyStatsCol().createIndex({ userId: 1, weekId: 1 }, { unique: true }),
    weeklyStatsCol().createIndex({ userId: 1 }),
    friendshipsCol().createIndex({ user1: 1, user2: 1 }, { unique: true }),
    friendshipsCol().createIndex({ user2: 1, status: 1 }),
    friendshipsCol().createIndex({ user1: 1, status: 1 }),
    messagesCol().createIndex({ from: 1, to: 1, created_at: 1 }),
    messagesCol().createIndex({ to: 1, read: 1 }),
  ]);
};
