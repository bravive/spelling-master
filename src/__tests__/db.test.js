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

  it('throws when no URI and required env vars are missing', async () => {
    await closeDb();
    await expect(connectDb()).rejects.toThrow('Missing required env vars');
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
  const VARS = ['MONGOHOST', 'MONGOPORT', 'MONGOUSER', 'MONGOPASSWORD', 'MONGODATABASE'];

  beforeEach(() => VARS.forEach(v => delete process.env[v]));
  afterEach(() => VARS.forEach(v => delete process.env[v]));

  it('constructs URI with auth when all vars are set', () => {
    process.env.MONGOHOST     = 'host.railway.internal';
    process.env.MONGOPORT     = '27017';
    process.env.MONGODATABASE = 'mydb';
    process.env.MONGOUSER     = 'user';
    process.env.MONGOPASSWORD = 'pass';
    expect(resolveMongoUri()).toBe('mongodb://user:pass@host.railway.internal:27017/mydb');
  });

  it('constructs URI without auth when MONGOUSER/MONGOPASSWORD are omitted (local dev)', () => {
    process.env.MONGOHOST     = 'localhost';
    process.env.MONGOPORT     = '27017';
    process.env.MONGODATABASE = 'spellmaster';
    expect(resolveMongoUri()).toBe('mongodb://localhost:27017/spellmaster');
  });

  it('encodes special characters in password', () => {
    process.env.MONGOHOST     = 'host';
    process.env.MONGOPORT     = '27017';
    process.env.MONGODATABASE = 'mydb';
    process.env.MONGOUSER     = 'user';
    process.env.MONGOPASSWORD = 'p@ss:w/ord';
    expect(resolveMongoUri()).toBe('mongodb://user:p%40ss%3Aw%2Ford@host:27017/mydb');
  });

  it('throws when MONGOHOST is missing', () => {
    process.env.MONGOPORT     = '27017';
    process.env.MONGODATABASE = 'mydb';
    expect(() => resolveMongoUri()).toThrow('Missing required env vars: MONGOHOST');
  });

  it('throws when MONGOPORT is missing', () => {
    process.env.MONGOHOST     = 'host';
    process.env.MONGODATABASE = 'mydb';
    expect(() => resolveMongoUri()).toThrow('Missing required env vars: MONGOPORT');
  });

  it('throws when MONGODATABASE is missing', () => {
    process.env.MONGOHOST = 'host';
    process.env.MONGOPORT = '27017';
    expect(() => resolveMongoUri()).toThrow('Missing required env vars: MONGODATABASE');
  });

  it('throws when only MONGOUSER is set without MONGOPASSWORD', () => {
    process.env.MONGOHOST     = 'host';
    process.env.MONGOPORT     = '27017';
    process.env.MONGODATABASE = 'mydb';
    process.env.MONGOUSER     = 'user';
    expect(() => resolveMongoUri()).toThrow('Both MONGOUSER and MONGOPASSWORD must be set together');
  });

  it('throws when only MONGOPASSWORD is set without MONGOUSER', () => {
    process.env.MONGOHOST     = 'host';
    process.env.MONGOPORT     = '27017';
    process.env.MONGODATABASE = 'mydb';
    process.env.MONGOPASSWORD = 'pass';
    expect(() => resolveMongoUri()).toThrow('Both MONGOUSER and MONGOPASSWORD must be set together');
  });
});
