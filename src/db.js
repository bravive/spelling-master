import { MongoClient } from 'mongodb';

let client;
let db;

export const connectDb = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not set');
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

// ── Collection helpers ────────────────────────────────────────────────────────
export const usersCol       = () => getDb().collection('users');
export const collectionsCol = () => getDb().collection('collections');
export const wordstatsCol   = () => getDb().collection('wordstats');
export const roundhistoryCol = () => getDb().collection('roundhistory');

// ── Indexes ───────────────────────────────────────────────────────────────────
const ensureIndexes = async () => {
  await Promise.all([
    usersCol().createIndex({ userId: 1 }, { unique: true }),
    collectionsCol().createIndex({ userId: 1 }, { unique: true }),
    wordstatsCol().createIndex({ userId: 1 }, { unique: true }),
    roundhistoryCol().createIndex({ userId: 1 }, { unique: true }),
  ]);
};
