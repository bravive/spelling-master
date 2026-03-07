import { MongoClient } from 'mongodb';

let client;
let db;

export const resolveMongoUri = () => {
  const { MONGOUSER, MONGOPASSWORD, MONGOHOST, MONGOPORT, MONGODATABASE } = process.env;
  const missingRequired = ['MONGOHOST', 'MONGOPORT', 'MONGODATABASE'].filter(k => !process.env[k]);
  if (missingRequired.length) throw new Error(`Missing required env vars: ${missingRequired.join(', ')}`);
  if (!!MONGOUSER !== !!MONGOPASSWORD) throw new Error('Both MONGOUSER and MONGOPASSWORD must be set together');
  const auth = MONGOUSER ? `${MONGOUSER}:${encodeURIComponent(MONGOPASSWORD)}@` : '';
  return `mongodb://${auth}${MONGOHOST}:${MONGOPORT}/${MONGODATABASE}`;
};

export const connectDb = async (uriOverride) => {
  const uri = uriOverride ?? resolveMongoUri();
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
