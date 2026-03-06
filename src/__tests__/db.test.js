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
const { connectDb, getDb, closeDb, usersCol, collectionsCol, wordstatsCol, roundhistoryCol } = await import('../db.js');

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
    await expect(connectDb()).rejects.toThrow('MONGODB_URI environment variable is not set');
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
  });

  it('usersCol returns collection named "users"', () => {
    usersCol();
    expect(getDb().collection).toHaveBeenCalledWith('users');
  });

  it('collectionsCol returns collection named "collections"', () => {
    collectionsCol();
    expect(getDb().collection).toHaveBeenCalledWith('collections');
  });

  it('wordstatsCol returns collection named "wordstats"', () => {
    wordstatsCol();
    expect(getDb().collection).toHaveBeenCalledWith('wordstats');
  });

  it('roundhistoryCol returns collection named "roundhistory"', () => {
    roundhistoryCol();
    expect(getDb().collection).toHaveBeenCalledWith('roundhistory');
  });

  it('ensureIndexes creates unique index on userId for all collections', async () => {
    const col = getDb().collection('users');
    expect(col.createIndex).toHaveBeenCalledWith({ userId: 1 }, { unique: true });
  });
});
