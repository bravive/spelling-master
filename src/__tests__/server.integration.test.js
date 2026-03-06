import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb, usersCol, collectionsCol, wordstatsCol, roundhistoryCol } from '../db.js';
import { app } from '../../server.js';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET  = 'test-secret';
  process.env.ADMIN_PIN   = '0000';
  await connectDb();
});

afterAll(async () => {
  await closeDb();
  await mongod.stop();
});

beforeEach(async () => {
  // Clear all collections between tests
  await Promise.all([
    usersCol().deleteMany({}),
    collectionsCol().deleteMany({}),
    wordstatsCol().deleteMany({}),
    roundhistoryCol().deleteMany({}),
  ]);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const createUser = (overrides = {}) =>
  request(app).post('/api/users').send({
    key: 'alice', name: 'Alice', pin: '1234', starterId: 1, starterSlug: 'bulbasaur',
    ...overrides,
  });

const loginUser = (userId = 'alice', pin = '1234') =>
  request(app).post('/api/auth/login').send({ userId, pin });

// ── Health check ──────────────────────────────────────────────────────────────
describe('GET /ping', () => {
  it('returns ok and db:mongodb', async () => {
    const res = await request(app).get('/ping');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, db: 'mongodb' });
  });
});

// ── Create user ───────────────────────────────────────────────────────────────
describe('POST /api/users', () => {
  it('creates a user and initialises related collections', async () => {
    const res = await createUser();
    expect(res.status).toBe(201);
    expect(res.body.user.userId).toBe('alice');
    expect(res.body.user.pin).toBeUndefined();

    const col = await collectionsCol().findOne({ userId: 'alice' });
    expect(col).not.toBeNull();
    const ws = await wordstatsCol().findOne({ userId: 'alice' });
    expect(ws).not.toBeNull();
    const rh = await roundhistoryCol().findOne({ userId: 'alice' });
    expect(rh).not.toBeNull();
  });

  it('rejects duplicate usernames', async () => {
    await createUser();
    const res = await createUser();
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Name already taken');
  });

  it('rejects non-4-digit PINs', async () => {
    const res = await createUser({ pin: '12' });
    expect(res.status).toBe(400);
  });

  it('rejects reserved username "test"', async () => {
    const res = await createUser({ key: 'test' });
    expect(res.status).toBe(400);
  });

  it('stores created_at and updated_at', async () => {
    await createUser();
    const doc = await usersCol().findOne({ userId: 'alice' });
    expect(doc.created_at).toBeInstanceOf(Date);
    expect(doc.updated_at).toBeInstanceOf(Date);
  });

  it('stores UUID as _id', async () => {
    await createUser();
    const doc = await usersCol().findOne({ userId: 'alice' });
    expect(doc._id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  beforeEach(() => createUser());

  it('returns JWT on correct PIN', async () => {
    const res = await loginUser();
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.pin).toBeUndefined();
  });

  it('returns 401 on wrong PIN', async () => {
    const res = await loginUser('alice', '9999');
    expect(res.status).toBe(401);
  });

  it('returns 400 when fields are missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ userId: 'alice' });
    expect(res.status).toBe(400);
  });

  it('admin login works with correct ADMIN_PIN', async () => {
    const res = await loginUser('test', '0000');
    expect(res.status).toBe(200);
    expect(res.body.user.isAdmin).toBe(true);
  });
});

// ── Update user ───────────────────────────────────────────────────────────────
describe('PUT /api/users/me', () => {
  let token;
  beforeEach(async () => {
    await createUser();
    const res = await loginUser();
    token = res.body.token;
  });

  it('updates game state and sets updated_at', async () => {
    const before = await usersCol().findOne({ userId: 'alice' });

    await new Promise(r => setTimeout(r, 10)); // ensure time difference
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ level: 2, streak: 5 });

    expect(res.status).toBe(200);
    const after = await usersCol().findOne({ userId: 'alice' });
    expect(after.level).toBe(2);
    expect(after.streak).toBe(5);
    expect(after.updated_at.getTime()).toBeGreaterThan(before.updated_at.getTime());
  });

  it('does not allow PIN to be overwritten', async () => {
    const before = await usersCol().findOne({ userId: 'alice' });
    await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ pin: 'hacked' });
    const after = await usersCol().findOne({ userId: 'alice' });
    expect(after.pin).toBe(before.pin);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).put('/api/users/me').send({ level: 2 });
    expect(res.status).toBe(401);
  });
});

// ── Collection ────────────────────────────────────────────────────────────────
describe('GET/PUT /api/collection', () => {
  let token;
  beforeEach(async () => {
    await createUser();
    const res = await loginUser();
    token = res.body.token;
  });

  it('returns empty collection for new user', async () => {
    const res = await request(app)
      .get('/api/collection')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.collection).toEqual({});
  });

  it('saves and retrieves collection data', async () => {
    const data = { collection: { '1': { regular: true } }, shinyEligible: false, consecutiveRegular: 1 };
    await request(app).put('/api/collection').set('Authorization', `Bearer ${token}`).send(data);
    const res = await request(app).get('/api/collection').set('Authorization', `Bearer ${token}`);
    expect(res.body.collection['1'].regular).toBe(true);
  });

  it('sets updated_at on PUT', async () => {
    const before = await collectionsCol().findOne({ userId: 'alice' });
    await new Promise(r => setTimeout(r, 10));
    await request(app).put('/api/collection').set('Authorization', `Bearer ${token}`)
      .send({ collection: {}, shinyEligible: false, consecutiveRegular: 0 });
    const after = await collectionsCol().findOne({ userId: 'alice' });
    expect(after.updated_at.getTime()).toBeGreaterThan(before.updated_at.getTime());
  });
});

// ── Wordstats ─────────────────────────────────────────────────────────────────
describe('GET/PUT /api/wordstats', () => {
  let token;
  beforeEach(async () => {
    await createUser();
    const res = await loginUser();
    token = res.body.token;
  });

  it('returns empty stats for new user', async () => {
    const res = await request(app).get('/api/wordstats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });

  it('saves and retrieves word stats', async () => {
    const stats = { cat: { attempts: 2, correct: 2, weight: 0.75, retired: false } };
    await request(app).put('/api/wordstats').set('Authorization', `Bearer ${token}`).send(stats);
    const res = await request(app).get('/api/wordstats').set('Authorization', `Bearer ${token}`);
    expect(res.body.cat.attempts).toBe(2);
  });
});

// ── Round history ─────────────────────────────────────────────────────────────
describe('GET/PUT /api/roundhistory', () => {
  let token;
  beforeEach(async () => {
    await createUser();
    const res = await loginUser();
    token = res.body.token;
  });

  it('returns empty history for new user', async () => {
    const res = await request(app).get('/api/roundhistory').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.roundHistory).toEqual([]);
  });

  it('saves and retrieves round history', async () => {
    const data = { roundHistory: [{ date: '2026-03-06', score: 10, earned: 5, pass: true }], bestScores: {} };
    await request(app).put('/api/roundhistory').set('Authorization', `Bearer ${token}`).send(data);
    const res = await request(app).get('/api/roundhistory').set('Authorization', `Bearer ${token}`);
    expect(res.body.roundHistory).toHaveLength(1);
    expect(res.body.roundHistory[0].score).toBe(10);
  });
});

// ── Delete user ───────────────────────────────────────────────────────────────
describe('DELETE /api/users/:id', () => {
  let adminToken;
  beforeEach(async () => {
    await createUser();
    const res = await loginUser('test', '0000');
    adminToken = res.body.token;
  });

  it('admin can delete a user and all related data', async () => {
    const res = await request(app)
      .delete('/api/users/alice')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(await usersCol().findOne({ userId: 'alice' })).toBeNull();
    expect(await collectionsCol().findOne({ userId: 'alice' })).toBeNull();
    expect(await wordstatsCol().findOne({ userId: 'alice' })).toBeNull();
    expect(await roundhistoryCol().findOne({ userId: 'alice' })).toBeNull();
  });

  it('returns 403 for non-admin token', async () => {
    await createUser({ key: 'bob', name: 'Bob' });
    const bobToken = (await loginUser('bob', '1234')).body.token;
    const res = await request(app)
      .delete('/api/users/alice')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(res.status).toBe(403);
  });

  it('cannot delete admin account', async () => {
    const res = await request(app)
      .delete('/api/users/test')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});
