import { MongoClient } from 'mongodb';

let client;
let db;

export const resolveMongoUri = () => {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  const { MONGOUSER, MONGOPASSWORD, MONGOHOST, MONGOPORT, MONGODATABASE } = process.env;
  if (MONGOHOST && MONGOUSER && MONGOPASSWORD) {
    const db = MONGODATABASE || 'spell-master';
    const port = MONGOPORT ? `:${MONGOPORT}` : '';
    return `mongodb://${MONGOUSER}:${encodeURIComponent(MONGOPASSWORD)}@${MONGOHOST}${port}/${db}`;
  }
  throw new Error('Set MONGODB_URI or MONGOHOST/MONGOUSER/MONGOPASSWORD env vars');
};

export const connectDb = async () => {
  const uri = resolveMongoUri();
  client = new MongoClient(uri);
  await client.connect();
  db = client.db();
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
export const weeklyChallengeWordsCol = () => getDb().collection('weeklychallengewords');
export const weeklyStatsCol          = () => getDb().collection('weeklychallengestats');

// ── Indexes ───────────────────────────────────────────────────────────────────
const ensureIndexes = async () => {
  await Promise.all([
    usersCol().createIndex({ userId: 1 }, { unique: true }),
    trophiesCol().createIndex({ userId: 1 }, { unique: true }),
    wordstatsCol().createIndex({ userId: 1 }, { unique: true }),
    roundhistoryCol().createIndex({ userId: 1 }, { unique: true }),
    weeklyChallengeWordsCol().createIndex({ weekId: 1 }, { unique: true }),
    weeklyChallengeWordsCol().createIndex({ startDate: 1 }),
    weeklyStatsCol().createIndex({ userId: 1, weekId: 1 }, { unique: true }),
    weeklyStatsCol().createIndex({ userId: 1 }),
  ]);
};
