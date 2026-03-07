import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb, usersCol, trophiesCol, wordstatsCol, roundhistoryCol, weeklyChallengeWordsCol, weeklyStatsCol } from '../db.js';
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
    trophiesCol().deleteMany({}),
    wordstatsCol().deleteMany({}),
    roundhistoryCol().deleteMany({}),
    weeklyChallengeWordsCol().deleteMany({}),
    weeklyStatsCol().deleteMany({}),
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

// ── List users ────────────────────────────────────────────────────────────────
describe('GET /api/users', () => {
  it('returns empty object when no users exist', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });

  it('returns one user keyed by UUID with no PIN', async () => {
    const { body } = await createUser();
    const uuid = body.user.id;

    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toHaveLength(1);
    expect(res.body[uuid]).toBeDefined();
    expect(res.body[uuid].userId).toBe('alice');
    expect(res.body[uuid].pin).toBeUndefined();
  });

  it('returns all users when multiple exist', async () => {
    const { body: a } = await createUser();
    const { body: b } = await createUser({ key: 'bob', name: 'Bob' });

    const res = await request(app).get('/api/users');
    expect(Object.keys(res.body)).toHaveLength(2);
    expect(res.body[a.user.id].userId).toBe('alice');
    expect(res.body[b.user.id].userId).toBe('bob');
  });
});

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
  it('creates a user and initialises related collections keyed by UUID', async () => {
    const res = await createUser();
    expect(res.status).toBe(201);
    expect(res.body.user.userId).toBe('alice');
    expect(res.body.user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.user.pin).toBeUndefined();

    const uuid = res.body.user.id;
    const col = await trophiesCol().findOne({ userId: uuid });
    expect(col).not.toBeNull();
    const ws = await wordstatsCol().findOne({ userId: uuid });
    expect(ws).not.toBeNull();
    const rh = await roundhistoryCol().findOne({ userId: uuid });
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

  it('returns JWT and user with id on correct PIN', async () => {
    const res = await loginUser();
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.pin).toBeUndefined();
    expect(res.body.user.id).toMatch(/^[0-9a-f-]{36}$/);
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

  it('returns 401 for unknown user (0 matching records)', async () => {
    const res = await loginUser('nobody', '1234');
    expect(res.status).toBe(401);
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

// ── Trophy ────────────────────────────────────────────────────────────────────
describe('GET/PUT /api/trophy', () => {
  let token;
  beforeEach(async () => {
    await createUser();
    const res = await loginUser();
    token = res.body.token;
  });

  it('returns empty collection for new user', async () => {
    const res = await request(app)
      .get('/api/trophy')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.collection).toEqual({});
  });

  it('saves and retrieves collection data', async () => {
    const data = { collection: { '1': { regular: true } }, shinyEligible: false, consecutiveRegular: 1 };
    await request(app).put('/api/trophy').set('Authorization', `Bearer ${token}`).send(data);
    const res = await request(app).get('/api/trophy').set('Authorization', `Bearer ${token}`);
    expect(res.body.collection['1'].regular).toBe(true);
  });

  it('sets updated_at on PUT', async () => {
    const user = await usersCol().findOne({ userId: 'alice' });
    const before = await trophiesCol().findOne({ userId: user._id });
    await new Promise(r => setTimeout(r, 10));
    await request(app).put('/api/trophy').set('Authorization', `Bearer ${token}`)
      .send({ collection: {}, shinyEligible: false, consecutiveRegular: 0 });
    const after = await trophiesCol().findOne({ userId: user._id });
    expect(after.updated_at.getTime()).toBeGreaterThan(before.updated_at.getTime());
  });

  it('repeated PUTs upsert — never creates duplicate trophy docs', async () => {
    const data = { collection: { '1': { regular: true } }, shinyEligible: false, consecutiveRegular: 1 };
    await request(app).put('/api/trophy').set('Authorization', `Bearer ${token}`).send(data);
    await request(app).put('/api/trophy').set('Authorization', `Bearer ${token}`)
      .send({ ...data, consecutiveRegular: 2 });
    const user = await usersCol().findOne({ userId: 'alice' });
    const count = await trophiesCol().countDocuments({ userId: user._id });
    expect(count).toBe(1);
  });

  it("does not return another user's trophy data", async () => {
    await request(app).put('/api/trophy').set('Authorization', `Bearer ${token}`)
      .send({ collection: { '1': { regular: true, shiny: true } }, shinyEligible: true, consecutiveRegular: 3 });

    await createUser({ key: 'bob', name: 'Bob' });
    const bobToken = (await loginUser('bob', '1234')).body.token;
    const res = await request(app).get('/api/trophy').set('Authorization', `Bearer ${bobToken}`);
    expect(res.body.collection).toEqual({});
    expect(res.body.shinyEligible).toBe(false);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/trophy');
    expect(res.status).toBe(401);
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

  it('repeated PUTs upsert — never creates duplicate wordstats docs', async () => {
    await request(app).put('/api/wordstats').set('Authorization', `Bearer ${token}`)
      .send({ cat: { attempts: 1, correct: 1, weight: 1 } });
    await request(app).put('/api/wordstats').set('Authorization', `Bearer ${token}`)
      .send({ cat: { attempts: 2, correct: 2, weight: 0.75 }, dog: { attempts: 1, correct: 0, weight: 1.6 } });
    const user = await usersCol().findOne({ userId: 'alice' });
    const count = await wordstatsCol().countDocuments({ userId: user._id });
    expect(count).toBe(1);
    const res = await request(app).get('/api/wordstats').set('Authorization', `Bearer ${token}`);
    expect(Object.keys(res.body)).toHaveLength(2);
  });

  it("does not return another user's word stats", async () => {
    await request(app).put('/api/wordstats').set('Authorization', `Bearer ${token}`)
      .send({ cat: { attempts: 5, correct: 5, weight: 0.3 } });

    await createUser({ key: 'bob', name: 'Bob' });
    const bobToken = (await loginUser('bob', '1234')).body.token;
    const res = await request(app).get('/api/wordstats').set('Authorization', `Bearer ${bobToken}`);
    expect(res.body).toEqual({});
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/wordstats');
    expect(res.status).toBe(401);
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

  it('saves multiple rounds and retrieves them all', async () => {
    const rounds = [
      { date: '2026-03-04', score: 7, earned: 0, pass: true },
      { date: '2026-03-05', score: 9, earned: 3, pass: true },
      { date: '2026-03-06', score: 10, earned: 5, pass: true },
    ];
    await request(app).put('/api/roundhistory').set('Authorization', `Bearer ${token}`)
      .send({ roundHistory: rounds, bestScores: { '10': '2026-03-06' } });
    const res = await request(app).get('/api/roundhistory').set('Authorization', `Bearer ${token}`);
    expect(res.body.roundHistory).toHaveLength(3);
    expect(res.body.bestScores['10']).toBe('2026-03-06');
  });

  it('repeated PUTs upsert — never creates duplicate roundhistory docs', async () => {
    await request(app).put('/api/roundhistory').set('Authorization', `Bearer ${token}`)
      .send({ roundHistory: [{ date: '2026-03-05', score: 8, earned: 2, pass: true }], bestScores: {} });
    await request(app).put('/api/roundhistory').set('Authorization', `Bearer ${token}`)
      .send({ roundHistory: [{ date: '2026-03-05', score: 8, earned: 2, pass: true }, { date: '2026-03-06', score: 10, earned: 5, pass: true }], bestScores: {} });
    const user = await usersCol().findOne({ userId: 'alice' });
    const count = await roundhistoryCol().countDocuments({ userId: user._id });
    expect(count).toBe(1);
  });

  it("does not return another user's round history", async () => {
    await request(app).put('/api/roundhistory').set('Authorization', `Bearer ${token}`)
      .send({ roundHistory: [{ date: '2026-03-06', score: 10, earned: 5, pass: true }], bestScores: {} });

    await createUser({ key: 'bob', name: 'Bob' });
    const bobToken = (await loginUser('bob', '1234')).body.token;
    const res = await request(app).get('/api/roundhistory').set('Authorization', `Bearer ${bobToken}`);
    expect(res.body.roundHistory).toEqual([]);
  });

  it('saves and retrieves creditHistory', async () => {
    const creditHistory = [
      { date: '2026-03-06', amount: 5, source: 'round', description: 'Score 10/10' },
      { date: '2026-03-06', amount: 1, source: 'streak', description: '3-day streak bonus' },
    ];
    await request(app).put('/api/roundhistory').set('Authorization', `Bearer ${token}`)
      .send({ roundHistory: [], bestScores: {}, creditHistory });
    const res = await request(app).get('/api/roundhistory').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.creditHistory).toHaveLength(2);
    expect(res.body.creditHistory[0]).toMatchObject({ source: 'round', amount: 5 });
    expect(res.body.creditHistory[1]).toMatchObject({ source: 'streak', amount: 1 });
  });

  it('creditHistory is empty array for new user', async () => {
    const res = await request(app).get('/api/roundhistory').set('Authorization', `Bearer ${token}`);
    expect(res.body.creditHistory).toEqual([]);
  });

  it('creditHistory persists across updates', async () => {
    const firstEvent = { date: '2026-03-05', amount: 3, source: 'round', description: 'Score 9/10' };
    await request(app).put('/api/roundhistory').set('Authorization', `Bearer ${token}`)
      .send({ roundHistory: [], bestScores: {}, creditHistory: [firstEvent] });

    const secondEvent = { date: '2026-03-06', amount: 0.5, source: 'weekly', description: 'Week w2026-10: 1 new word(s)' };
    await request(app).put('/api/roundhistory').set('Authorization', `Bearer ${token}`)
      .send({ roundHistory: [], bestScores: {}, creditHistory: [firstEvent, secondEvent] });

    const res = await request(app).get('/api/roundhistory').set('Authorization', `Bearer ${token}`);
    expect(res.body.creditHistory).toHaveLength(2);
    expect(res.body.creditHistory[1]).toMatchObject({ source: 'weekly', amount: 0.5 });
  });

  it("does not return another user's creditHistory", async () => {
    const creditHistory = [{ date: '2026-03-06', amount: 5, source: 'round', description: 'Score 10/10' }];
    await request(app).put('/api/roundhistory').set('Authorization', `Bearer ${token}`)
      .send({ roundHistory: [], bestScores: {}, creditHistory });

    await createUser({ key: 'bob', name: 'Bob' });
    const bobToken = (await loginUser('bob', '1234')).body.token;
    const res = await request(app).get('/api/roundhistory').set('Authorization', `Bearer ${bobToken}`);
    expect(res.body.creditHistory).toEqual([]);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/roundhistory');
    expect(res.status).toBe(401);
  });
});

// ── Delete user ───────────────────────────────────────────────────────────────
describe('DELETE /api/users/:id', () => {
  let adminToken;
  let aliceId;
  beforeEach(async () => {
    const created = await createUser();
    aliceId = created.body.user.id;
    const res = await loginUser('test', '0000');
    adminToken = res.body.token;
  });

  it('admin can delete a user and all related data', async () => {
    // Create weekly stats for alice first
    await weeklyStatsCol().insertOne({ _id: 'test-stat', userId: aliceId, weekId: 'w2026-10', wordsCorrect: [], completed: false, creditsEarned: 0 });

    const res = await request(app)
      .delete(`/api/users/${aliceId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(await usersCol().findOne({ userId: 'alice' })).toBeNull();
    expect(await trophiesCol().findOne({ userId: aliceId })).toBeNull();
    expect(await wordstatsCol().findOne({ userId: aliceId })).toBeNull();
    expect(await roundhistoryCol().findOne({ userId: aliceId })).toBeNull();
    expect(await weeklyStatsCol().findOne({ userId: aliceId })).toBeNull();
  });

  it('returns 403 for non-admin token', async () => {
    await createUser({ key: 'bob', name: 'Bob' });
    const bobToken = (await loginUser('bob', '1234')).body.token;
    const res = await request(app)
      .delete(`/api/users/${aliceId}`)
      .set('Authorization', `Bearer ${bobToken}`);
    expect(res.status).toBe(403);
  });

  it('cannot delete admin account', async () => {
    const res = await request(app)
      .delete('/api/users/admin')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 when deleting a non-existent user ID', async () => {
    const res = await request(app)
      .delete('/api/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// ── Weekly words ───────────────────────────────────────────────────────────────
describe('GET /api/weekly-words — 0 or 1 records', () => {
  it('returns empty array when no weeks exist', async () => {
    const res = await request(app).get('/api/weekly-words');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns a single week when only one exists', async () => {
    await weeklyChallengeWordsCol().insertOne({
      _id: 'w1', weekId: 'w2026-01', label: 'Week 1', startDate: '2026-01-05',
      words: [{ w: 'cat', s: 'The cat sat.' }], created_at: new Date(), updated_at: new Date(),
    });
    const res = await request(app).get('/api/weekly-words');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].weekId).toBe('w2026-01');
  });
});

describe('GET /api/weekly-words — multiple records', () => {
  beforeEach(async () => {
    await weeklyChallengeWordsCol().insertMany([
      { _id: 'w1', weekId: 'w2026-01', label: 'Week 1', startDate: '2026-01-05', words: [{ w: 'cat', s: 'The cat sat.' }], created_at: new Date(), updated_at: new Date() },
      { _id: 'w2', weekId: 'w2026-02', label: 'Week 2', startDate: '2026-01-12', words: [{ w: 'dog', s: 'The dog ran.' }], created_at: new Date(), updated_at: new Date() },
    ]);
  });

  it('returns all weeks sorted by startDate, no auth required', async () => {
    const res = await request(app).get('/api/weekly-words');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].weekId).toBe('w2026-01');
    expect(res.body[1].weekId).toBe('w2026-02');
  });

  it('returns weeks in startDate order even when inserted out of order', async () => {
    // Insert a week with an earlier startDate after the two already seeded
    await weeklyChallengeWordsCol().insertOne({
      _id: 'w0', weekId: 'w2025-52', label: 'Week 52', startDate: '2025-12-29',
      words: [], created_at: new Date(), updated_at: new Date(),
    });
    const res = await request(app).get('/api/weekly-words');
    expect(res.body[0].weekId).toBe('w2025-52');
    expect(res.body[1].weekId).toBe('w2026-01');
    expect(res.body[2].weekId).toBe('w2026-02');
  });

  it('returns words array for each week', async () => {
    const res = await request(app).get('/api/weekly-words');
    expect(res.body[0].words).toEqual([{ w: 'cat', s: 'The cat sat.' }]);
  });
});

// ── Weekly stats ───────────────────────────────────────────────────────────────
describe('GET/PUT /api/weekly-stats', () => {
  let token;
  beforeEach(async () => {
    await createUser();
    const res = await loginUser();
    token = res.body.token;
  });

  it('returns empty object for new user', async () => {
    const res = await request(app).get('/api/weekly-stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/weekly-stats');
    expect(res.status).toBe(401);
  });

  it('upserts weekly stats for a given weekId', async () => {
    const data = { wordsCorrect: ['cat', 'dog'], completed: false, creditsEarned: 1, lastDailyReward: null };
    const res = await request(app)
      .put('/api/weekly-stats/w2026-10')
      .set('Authorization', `Bearer ${token}`)
      .send(data);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const stats = await request(app).get('/api/weekly-stats').set('Authorization', `Bearer ${token}`);
    expect(stats.body['w2026-10'].wordsCorrect).toEqual(['cat', 'dog']);
    expect(stats.body['w2026-10'].creditsEarned).toBe(1);
  });

  it('keyed response maps weekId to stat doc', async () => {
    await request(app).put('/api/weekly-stats/w2026-10').set('Authorization', `Bearer ${token}`)
      .send({ wordsCorrect: ['cat'], completed: false, creditsEarned: 0.5, lastDailyReward: null });
    await request(app).put('/api/weekly-stats/w2026-11').set('Authorization', `Bearer ${token}`)
      .send({ wordsCorrect: ['bird'], completed: true, creditsEarned: 3, lastDailyReward: '2026-03-06' });

    const res = await request(app).get('/api/weekly-stats').set('Authorization', `Bearer ${token}`);
    expect(Object.keys(res.body)).toHaveLength(2);
    expect(res.body['w2026-11'].completed).toBe(true);
  });

  it('PUT returns 401 without token', async () => {
    const res = await request(app).put('/api/weekly-stats/w2026-10').send({ wordsCorrect: [] });
    expect(res.status).toBe(401);
  });

  it('second PUT for same weekId updates the doc, not creates a duplicate', async () => {
    await request(app).put('/api/weekly-stats/w2026-10').set('Authorization', `Bearer ${token}`)
      .send({ wordsCorrect: ['cat'], completed: false, creditsEarned: 0.5, lastDailyReward: null });
    await request(app).put('/api/weekly-stats/w2026-10').set('Authorization', `Bearer ${token}`)
      .send({ wordsCorrect: ['cat', 'dog'], completed: true, creditsEarned: 4, lastDailyReward: '2026-03-06' });

    const count = await weeklyStatsCol().countDocuments({});
    expect(count).toBe(1);

    const res = await request(app).get('/api/weekly-stats').set('Authorization', `Bearer ${token}`);
    expect(res.body['w2026-10'].wordsCorrect).toEqual(['cat', 'dog']);
    expect(res.body['w2026-10'].completed).toBe(true);
    expect(res.body['w2026-10'].creditsEarned).toBe(4);
  });

  it("does not return another user's weekly stats", async () => {
    // alice saves stats for w2026-10
    await request(app).put('/api/weekly-stats/w2026-10').set('Authorization', `Bearer ${token}`)
      .send({ wordsCorrect: ['cat'], completed: false, creditsEarned: 0.5, lastDailyReward: null });

    // bob creates account and logs in
    await createUser({ key: 'bob', name: 'Bob' });
    const bobToken = (await loginUser('bob', '1234')).body.token;

    // bob sees empty stats (not alice's)
    const res = await request(app).get('/api/weekly-stats').set('Authorization', `Bearer ${bobToken}`);
    expect(res.body).toEqual({});
  });
});

// ── Invalid / expired JWT → 401 on every protected route ─────────────────────
describe('Invalid JWT returns 401 on all protected routes', () => {
  const BAD_TOKEN = 'Bearer invalid.jwt.token';
  const EXPIRED_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    'eyJpZCI6ImFiYyIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwMDAwMDAxfQ.' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

  const protectedRoutes = [
    { method: 'get',  path: '/api/trophy' },
    { method: 'put',  path: '/api/trophy' },
    { method: 'get',  path: '/api/wordstats' },
    { method: 'put',  path: '/api/wordstats' },
    { method: 'get',  path: '/api/roundhistory' },
    { method: 'put',  path: '/api/roundhistory' },
    { method: 'get',  path: '/api/weekly-stats' },
    { method: 'put',  path: '/api/weekly-stats/w2026-10' },
    { method: 'put',  path: '/api/users/me' },
  ];

  for (const { method, path } of protectedRoutes) {
    it(`${method.toUpperCase()} ${path} returns 401 for a malformed token`, async () => {
      const res = await request(app)[method](path).set('Authorization', BAD_TOKEN).send({});
      expect(res.status).toBe(401);
    });

    it(`${method.toUpperCase()} ${path} returns 401 for an expired token`, async () => {
      const res = await request(app)[method](path).set('Authorization', EXPIRED_TOKEN).send({});
      expect(res.status).toBe(401);
    });

    it(`${method.toUpperCase()} ${path} returns 401 with no Authorization header`, async () => {
      const res = await request(app)[method](path).send({});
      expect(res.status).toBe(401);
    });
  }
});
