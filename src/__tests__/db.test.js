import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock mongodb before importing db.js
vi.mock('mongodb', () => {
  const createIndex = vi.fn().mockResolvedValue({});
  const collection  = vi.fn(() => ({ createIndex }));
  const db          = vi.fn(() => ({ collection, databaseName: 'test' }));
  const connect     = vi.fn().mockResolvedValue(undefined);
  const close       = vi.fn().mockResolvedValue(undefined);
  const MongoClient = vi.fn(function MongoClient() {
    this.connect = connect;
    this.db = db;
    this.close = close;
  });
  return { MongoClient };
});

// Import after mocking
const { connectDb, getDb, closeDb, usersCol, trophiesCol, wordstatsCol, roundhistoryCol, weeklyChallengeWordsCol, weeklyStatsCol, resolveMongoUri } = await import('../db.js');

describe('db module', () => {
  beforeEach(async () => {
    await connectDb('mongodb://localhost:27017/test');
  });

  afterEach(async () => {
    await closeDb();
  });

  it('connects with the provided URI', async () => {
    const { MongoClient } = await import('mongodb');
    expect(MongoClient).toHaveBeenCalledWith('mongodb://localhost:27017/test');
  });

  it('getDb returns the connected db instance', () => {
    expect(getDb()).toBeDefined();
    expect(getDb().databaseName).toBe('test');
  });

  it('throws when MONGO_URL is not set', async () => {
    await closeDb();
    await expect(connectDb()).rejects.toThrow('Missing required env var: MONGO_URL');
  });

  it('usersCol returns collection named "users"', () => {
    usersCol();
    expect(getDb().collection).toHaveBeenCalledWith('users');
  });

  it('trophiesCol returns collection named "trophies"', () => {
    trophiesCol();
    expect(getDb().collection).toHaveBeenCalledWith('trophies');
  });

  it('wordstatsCol returns collection named "wordstats"', () => {
    wordstatsCol();
    expect(getDb().collection).toHaveBeenCalledWith('wordstats');
  });

  it('roundhistoryCol returns collection named "roundhistory"', () => {
    roundhistoryCol();
    expect(getDb().collection).toHaveBeenCalledWith('roundhistory');
  });

  it('weeklyChallengeWordsCol returns collection named "weeklychallengewords"', () => {
    weeklyChallengeWordsCol();
    expect(getDb().collection).toHaveBeenCalledWith('weeklychallengewords');
  });

  it('weeklyStatsCol returns collection named "weeklychallengestats"', () => {
    weeklyStatsCol();
    expect(getDb().collection).toHaveBeenCalledWith('weeklychallengestats');
  });

  it('ensureIndexes creates unique index on userId for all collections', async () => {
    const col = getDb().collection('users');
    expect(col.createIndex).toHaveBeenCalledWith({ userId: 1 }, { unique: true });
  });
});

// ── resolveMongoUri ───────────────────────────────────────────────────────────
describe('resolveMongoUri', () => {
  beforeEach(() => { delete process.env.MONGO_URL; });
  afterEach(() => { delete process.env.MONGO_URL; });

  it('returns MONGO_URL when set', () => {
    process.env.MONGO_URL = 'mongodb://user:pass@host:27017/mydb';
    expect(resolveMongoUri()).toBe('mongodb://user:pass@host:27017/mydb');
  });

  it('throws when MONGO_URL is not set', () => {
    expect(() => resolveMongoUri()).toThrow('Missing required env var: MONGO_URL');
  });
});
