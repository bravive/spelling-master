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
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
    await connectDb();
  });

  afterEach(async () => {
    await closeDb();
  });

  it('connects using MONGODB_URI env var', async () => {
    const { MongoClient } = await import('mongodb');
    expect(MongoClient).toHaveBeenCalledWith('mongodb://localhost:27017/test');
  });

  it('getDb returns the connected db instance', () => {
    expect(getDb()).toBeDefined();
    expect(getDb().databaseName).toBe('test');
  });

  it('throws if MONGODB_URI is not set', async () => {
    await closeDb();
    delete process.env.MONGODB_URI;
    await expect(connectDb()).rejects.toThrow();
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
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
  const VARS = ['MONGODB_URI', 'MONGOHOST', 'MONGOPORT', 'MONGOUSER', 'MONGOPASSWORD', 'MONGODATABASE'];

  beforeEach(() => VARS.forEach(v => delete process.env[v]));
  afterEach(() => VARS.forEach(v => delete process.env[v]));

  it('returns MONGODB_URI directly when set', () => {
    process.env.MONGODB_URI = 'mongodb://custom-uri/db';
    expect(resolveMongoUri()).toBe('mongodb://custom-uri/db');
  });

  it('constructs URI from Railway vars', () => {
    process.env.MONGOUSER = 'user';
    process.env.MONGOPASSWORD = 'pass';
    process.env.MONGOHOST = 'host.railway.internal';
    process.env.MONGOPORT = '27017';
    process.env.MONGODATABASE = 'mydb';
    expect(resolveMongoUri()).toBe('mongodb://user:pass@host.railway.internal:27017/mydb');
  });

  it('encodes special characters in password', () => {
    process.env.MONGOUSER = 'user';
    process.env.MONGOPASSWORD = 'p@ss:w/ord';
    process.env.MONGOHOST = 'host';
    process.env.MONGOPORT = '27017';
    expect(resolveMongoUri()).toBe('mongodb://user:p%40ss%3Aw%2Ford@host:27017/spell-master');
  });

  it('defaults database to spell-master when MONGODATABASE is not set', () => {
    process.env.MONGOUSER = 'user';
    process.env.MONGOPASSWORD = 'pass';
    process.env.MONGOHOST = 'host';
    process.env.MONGOPORT = '27017';
    expect(resolveMongoUri()).toContain('/spell-master');
  });

  it('omits port when MONGOPORT is not set', () => {
    process.env.MONGOUSER = 'user';
    process.env.MONGOPASSWORD = 'pass';
    process.env.MONGOHOST = 'host';
    expect(resolveMongoUri()).toBe('mongodb://user:pass@host/spell-master');
  });

  it('throws when no URI can be constructed', () => {
    expect(() => resolveMongoUri()).toThrow();
  });
});
