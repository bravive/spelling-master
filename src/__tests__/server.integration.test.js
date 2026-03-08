import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb, usersCol, trophiesCol, wordstatsCol, roundhistoryCol, credithistoryCol, weeklyChallengeWordsCol, weeklyStatsCol, trophyhistoryCol, giftsCol, friendshipsCol, inviteCodesCol } from '../db.js';
import { app } from '../../server.js';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.JWT_SECRET = 'test-secret';
  process.env.ADMIN_PIN  = '0000';
  await connectDb(mongod.getUri());
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
    credithistoryCol().deleteMany({}),
    weeklyChallengeWordsCol().deleteMany({}),
    weeklyStatsCol().deleteMany({}),
    trophyhistoryCol().deleteMany({}),
    giftsCol().deleteMany({}),
    friendshipsCol().deleteMany({}),
    inviteCodesCol().deleteMany({}),
  ]);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const getAdminToken = async () => {
  const { body } = await request(app).post('/api/auth/login').send({ userId: 'admin', pin: '0000' });
  return body.token;
};

const makeCode = async () => {
  const token = await getAdminToken();
  const { body } = await request(app).post('/api/admin/invite-codes').set('Authorization', `Bearer ${token}`);
  return body.code;
};

const createUser = async (overrides = {}) => {
  const { inviteCode: overrideCode, ...rest } = overrides;
  const inviteCode = overrideCode ?? await makeCode();
  return request(app).post('/api/users').send({
    key: 'alice', name: 'Alice', pin: '123456', starterId: 1, starterSlug: 'bulbasaur',
    inviteCode, ...rest,
  });
};

const loginUser = (userId = 'alice', pin = '123456') =>
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
  it('returns ok', async () => {
    const res = await request(app).get('/ping');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
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

  it('rejects reserved username "admin"', async () => {
    const res = await createUser({ key: 'admin' });
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
    const res = await loginUser('admin', '0000');
    expect(res.status).toBe(200);
    expect(res.body.user.isAdmin).toBe(true);
  });

  it('returns 401 for unknown user (0 matching records)', async () => {
    const res = await loginUser('nobody', '123456');
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

  it('strips redundant fields that belong in other collections', async () => {
    await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        level: 3,
        collection: { 1: { count: 1 } },
        creditHistory: [{ date: '2026-01-01', amount: 5 }],
        roundHistory: [{ date: '2026-01-01', score: 10 }],
        wordStats: { cat: { attempts: 3, correct: 3 } },
        shinyEligible: true,
        consecutiveRegular: 2,
        nextPokemonId: 42,
        bestScores: { 1: 10 },
      });
    const after = await usersCol().findOne({ userId: 'alice' });
    expect(after.level).toBe(3);
    expect(after.collection).toBeUndefined();
    expect(after.creditHistory).toBeUndefined();
    expect(after.roundHistory).toBeUndefined();
    expect(after.wordStats).toBeUndefined();
    expect(after.shinyEligible).toBeUndefined();
    expect(after.consecutiveRegular).toBeUndefined();
    expect(after.nextPokemonId).toBeUndefined();
    expect(after.bestScores).toBeUndefined();
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
    const bobToken = (await loginUser('bob', '123456')).body.token;
    const res = await request(app).get('/api/trophy').set('Authorization', `Bearer ${bobToken}`);
    expect(res.body.collection).toEqual({});
    expect(res.body.shinyEligible).toBe(false);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/trophy');
    expect(res.status).toBe(401);
  });

  it('returns null nextPokemonId for new user on GET', async () => {
    const res = await request(app).get('/api/trophy').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.nextPokemonId).toBeNull();
  });

  it('clears nextPokemonId when current one is already caught', async () => {
    // Save trophy with nextPokemonId=1 but also mark pokemon 1 as caught
    await request(app).put('/api/trophy').set('Authorization', `Bearer ${token}`)
      .send({ collection: { '1': { count: 1 } }, shinyEligible: false, consecutiveRegular: 0, nextPokemonId: 1 });

    // GET should detect nextPokemonId=1 is caught and clear it
    const res = await request(app).get('/api/trophy').set('Authorization', `Bearer ${token}`);
    expect(res.body.nextPokemonId).toBeNull();

    // Check it was persisted as null in DB
    const user = await usersCol().findOne({ userId: 'alice' });
    const doc = await trophiesCol().findOne({ userId: user._id });
    expect(doc.nextPokemonId).toBeNull();
  });

  it('preserves nextPokemonId across PUT + GET cycle', async () => {
    const data = { collection: {}, shinyEligible: false, consecutiveRegular: 0, nextPokemonId: 25 };
    await request(app).put('/api/trophy').set('Authorization', `Bearer ${token}`).send(data);
    const res = await request(app).get('/api/trophy').set('Authorization', `Bearer ${token}`);
    expect(res.body.nextPokemonId).toBe(25);
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
    const bobToken = (await loginUser('bob', '123456')).body.token;
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
    const bobToken = (await loginUser('bob', '123456')).body.token;
    const res = await request(app).get('/api/roundhistory').set('Authorization', `Bearer ${bobToken}`);
    expect(res.body.roundHistory).toEqual([]);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/roundhistory');
    expect(res.status).toBe(401);
  });
});

// ── Credit history ──────────────────────────────────────────────────────────
describe('GET/PUT /api/credithistory', () => {
  let token;
  beforeEach(async () => {
    await createUser();
    const res = await loginUser();
    token = res.body.token;
  });

  it('returns empty array for new user', async () => {
    const res = await request(app).get('/api/credithistory').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('saves and retrieves credit history', async () => {
    const history = [
      { date: '2026-03-05', amount: 3, source: 'round', description: 'Score 9/10' },
      { date: '2026-03-06', amount: 5, source: 'round', description: 'Score 10/10' },
    ];
    await request(app).put('/api/credithistory').set('Authorization', `Bearer ${token}`).send(history);
    const res = await request(app).get('/api/credithistory').set('Authorization', `Bearer ${token}`);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ amount: 3, source: 'round' });
  });

  it('does not return another user\'s credit history', async () => {
    await request(app).put('/api/credithistory').set('Authorization', `Bearer ${token}`)
      .send([{ date: '2026-03-05', amount: 5, source: 'round', description: 'Score 10/10' }]);
    await createUser({ key: 'bob', name: 'Bob' });
    const bobToken = (await loginUser('bob', '123456')).body.token;
    const res = await request(app).get('/api/credithistory').set('Authorization', `Bearer ${bobToken}`);
    expect(res.body).toEqual([]);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/credithistory');
    expect(res.status).toBe(401);
  });
});

// ── Trophy history ──────────────────────────────────────────────────────────
describe('GET/POST /api/trophyhistory', () => {
  let token;
  beforeEach(async () => {
    await createUser();
    const res = await loginUser();
    token = res.body.token;
  });

  it('returns empty array for new user', async () => {
    const res = await request(app).get('/api/trophyhistory').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('creates and retrieves trophy history entries', async () => {
    await request(app).post('/api/trophyhistory').set('Authorization', `Bearer ${token}`)
      .send({ action: 'buy', cost: 3, pokemon: 'pikachu' });
    await request(app).post('/api/trophyhistory').set('Authorization', `Bearer ${token}`)
      .send({ action: 'evolve', from: 'charmander', to: 'charmeleon' });
    const res = await request(app).get('/api/trophyhistory').set('Authorization', `Bearer ${token}`);
    expect(res.body).toHaveLength(2);
    // Sorted newest first
    expect(res.body[0].action).toBe('evolve');
    expect(res.body[1].action).toBe('buy');
    expect(res.body[1].pokemon).toBe('pikachu');
  });

  it('does not return another user\'s history', async () => {
    await request(app).post('/api/trophyhistory').set('Authorization', `Bearer ${token}`)
      .send({ action: 'buy', cost: 3, pokemon: 'bulbasaur' });
    await createUser({ key: 'bob', name: 'Bob' });
    const bobToken = (await loginUser('bob', '123456')).body.token;
    const res = await request(app).get('/api/trophyhistory').set('Authorization', `Bearer ${bobToken}`);
    expect(res.body).toEqual([]);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/trophyhistory');
    expect(res.status).toBe(401);
  });
});

// ── Update profile ───────────────────────────────────────────────────────────
describe('PUT /api/users/me/profile', () => {
  let token;
  beforeEach(async () => {
    await createUser();
    const res = await loginUser();
    token = res.body.token;
  });

  it('updates name with correct current PIN', async () => {
    const res = await request(app)
      .put('/api/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPin: '123456', newName: 'Alice B' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Alice B');
    expect(res.body.user.userId).toBe('alice_b');
  });

  it('rejects name change with wrong PIN', async () => {
    const res = await request(app)
      .put('/api/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPin: '9999', newName: 'Alice B' });
    expect(res.status).toBe(401);
  });

  it('rejects missing current PIN', async () => {
    const res = await request(app)
      .put('/api/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ newName: 'Alice B' });
    expect(res.status).toBe(400);
  });

  it('rejects reserved name "test"', async () => {
    const res = await request(app)
      .put('/api/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPin: '123456', newName: 'test' });
    expect(res.status).toBe(400);
  });

  it('rejects duplicate name', async () => {
    await createUser({ key: 'bob', name: 'Bob' });
    const res = await request(app)
      .put('/api/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPin: '123456', newName: 'Bob' });
    expect(res.status).toBe(409);
  });

  it('allows keeping the same name', async () => {
    const res = await request(app)
      .put('/api/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPin: '123456', newName: 'Alice' });
    expect(res.status).toBe(200);
  });

  it('updates PIN', async () => {
    const res = await request(app)
      .put('/api/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPin: '123456', newPin: '567890' });
    expect(res.status).toBe(200);

    // Old PIN should fail
    const fail = await loginUser('alice', '123456');
    expect(fail.status).toBe(401);
    // New PIN should work
    const ok = await loginUser('alice', '567890');
    expect(ok.status).toBe(200);
  });

  it('rejects non-6-digit new PIN', async () => {
    const res = await request(app)
      .put('/api/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPin: '123456', newPin: '12' });
    expect(res.status).toBe(400);
  });

  it('updates avatar (starter)', async () => {
    const res = await request(app)
      .put('/api/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPin: '123456', starterId: 4, starterSlug: 'charmander' });
    expect(res.status).toBe(200);
    expect(res.body.user.starterSlug).toBe('charmander');
    expect(res.body.user.starterId).toBe(4);
  });

  it('updates multiple fields at once', async () => {
    const res = await request(app)
      .put('/api/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPin: '123456', newName: 'Alice C', starterId: 7, starterSlug: 'squirtle', newPin: '432100' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Alice C');
    expect(res.body.user.starterSlug).toBe('squirtle');
    // Verify new PIN works
    const ok = await loginUser('alice_c', '432100');
    expect(ok.status).toBe(200);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).put('/api/users/me/profile').send({ currentPin: '123456' });
    expect(res.status).toBe(401);
  });
});

// ── Admin dashboard ──────────────────────────────────────────────────────────
describe('GET /api/admin/users', () => {
  let adminToken;
  beforeEach(async () => {
    const res = await loginUser('admin', '0000');
    adminToken = res.body.token;
  });

  it('returns user list with detailed stats', async () => {
    await createUser();
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Alice');
    expect(res.body[0]).toHaveProperty('masteredCount');
    expect(res.body[0]).toHaveProperty('avgScore');
    expect(res.body[0]).toHaveProperty('shinyCount');
    expect(res.body[0]).toHaveProperty('rounds');
  });

  it('returns 403 for non-admin token', async () => {
    await createUser();
    const userToken = (await loginUser('alice', '123456')).body.token;
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no users exist', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
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
    const bobToken = (await loginUser('bob', '123456')).body.token;

    // bob sees empty stats (not alice's)
    const res = await request(app).get('/api/weekly-stats').set('Authorization', `Bearer ${bobToken}`);
    expect(res.body).toEqual({});
  });
});

// ── Invalid / expired JWT → 401 on every protected route ─────────────────────
// ── Gifts (Pokemon gifting between friends) ──────────────────────────────────
describe('Gifts API', () => {
  let aliceToken, bobToken, aliceId, bobId;

  beforeEach(async () => {
    const a = await createUser();
    aliceId = a.body.user.id;
    aliceToken = (await loginUser()).body.token;

    const b = await createUser({ key: 'bob', name: 'Bob' });
    bobId = b.body.user.id;
    bobToken = (await loginUser('bob', '123456')).body.token;
  });

  const makeFriends = async () => {
    await request(app).post('/api/friends/invite')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId });
    const friends = await request(app).get('/api/friends')
      .set('Authorization', `Bearer ${bobToken}`);
    const pending = friends.body.find(f => f.status === 'pending');
    await request(app).put(`/api/friends/${pending.friendshipId}/accept`)
      .set('Authorization', `Bearer ${bobToken}`);
  };

  const giveAlicePokemon = async (pokemonId, count = 1) => {
    const col = {};
    col[pokemonId] = { count, shiny: false };
    await request(app).put('/api/trophy')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ collection: col });
  };

  it('requires friendship to send gift', async () => {
    await giveAlicePokemon(1, 2);
    const res = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1 });
    expect(res.status).toBe(403);
  });

  it('sends a gift between friends', async () => {
    await makeFriends();
    await giveAlicePokemon(1, 2);
    const res = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1 });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
  });

  it('lists pending gifts', async () => {
    await makeFriends();
    await giveAlicePokemon(1, 2);
    await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1 });

    const res = await request(app).get('/api/gifts')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].pokemonId).toBe(1);
    expect(res.body[0].fromName).toBe('Alice');
  });

  it('returns pending count for recipient', async () => {
    await makeFriends();
    await giveAlicePokemon(1, 2);
    await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1 });

    const res = await request(app).get('/api/gifts/pending-count')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(res.body.count).toBe(1);
  });

  it('accepts a gift and transfers pokemon', async () => {
    await makeFriends();
    await giveAlicePokemon(1, 2);
    const sendRes = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1 });

    const giftId = sendRes.body.giftId;
    const res = await request(app).put(`/api/gifts/${giftId}/accept`)
      .set('Authorization', `Bearer ${bobToken}`);
    expect(res.status).toBe(200);

    // Verify transfer
    const aliceTrophy = await request(app).get('/api/trophy')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(aliceTrophy.body.collection['1'].count).toBe(1);

    const bobTrophy = await request(app).get('/api/trophy')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(bobTrophy.body.collection['1'].count).toBe(1);
  });

  it('increments count when recipient already has the pokemon', async () => {
    await makeFriends();
    await giveAlicePokemon(1, 2);
    // Bob already has one copy
    await request(app).put('/api/trophy')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ collection: { 1: { count: 1 } } });

    const sendRes = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1 });
    await request(app).put(`/api/gifts/${sendRes.body.giftId}/accept`)
      .set('Authorization', `Bearer ${bobToken}`);

    const bobTrophy = await request(app).get('/api/trophy')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(bobTrophy.body.collection['1'].count).toBe(2); // was 1, now 2
  });

  it('preserves recipient shiny when accepting a regular gift', async () => {
    await makeFriends();
    await giveAlicePokemon(1, 2);
    // Bob has a shiny of pokemon 1
    await request(app).put('/api/trophy')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ collection: { 1: { count: 1, shiny: true } } });

    const sendRes = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1 });
    await request(app).put(`/api/gifts/${sendRes.body.giftId}/accept`)
      .set('Authorization', `Bearer ${bobToken}`);

    const bobTrophy = await request(app).get('/api/trophy')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(bobTrophy.body.collection['1'].count).toBe(2);    // count went up
    expect(bobTrophy.body.collection['1'].shiny).toBe(true); // shiny preserved
  });

  it('increments count and sets shiny when accepting a shiny gift', async () => {
    await makeFriends();
    await giveAliceShiny(1);
    // Bob has a regular copy
    await request(app).put('/api/trophy')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ collection: { 1: { count: 1, shiny: false } } });

    const sendRes = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1, isShiny: true });
    await request(app).put(`/api/gifts/${sendRes.body.giftId}/accept`)
      .set('Authorization', `Bearer ${bobToken}`);

    const bobTrophy = await request(app).get('/api/trophy')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(bobTrophy.body.collection['1'].count).toBe(2);    // count incremented
    expect(bobTrophy.body.collection['1'].shiny).toBe(true); // shiny inherited
  });

  it('declines a gift without transfer', async () => {
    await makeFriends();
    await giveAlicePokemon(1, 2);
    const sendRes = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1 });

    const giftId = sendRes.body.giftId;
    await request(app).put(`/api/gifts/${giftId}/decline`)
      .set('Authorization', `Bearer ${bobToken}`);

    // No transfer
    const aliceTrophy = await request(app).get('/api/trophy')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(aliceTrophy.body.collection['1'].count).toBe(2);
  });

  it('prevents duplicate pending gift for same pokemon to same user', async () => {
    await makeFriends();
    await giveAlicePokemon(1, 2);
    await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1 });

    const res = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1 });
    expect(res.status).toBe(409);
  });

  it('prevents gifting when all copies reserved for pending gifts', async () => {
    await makeFriends();
    // Create a third user to avoid duplicate-gift check
    const c = await createUser({ key: 'carol', name: 'Carol' });
    const carolId = c.body.user.id;
    const carolToken = (await loginUser('carol', '123456')).body.token;
    // Befriend alice and carol
    await request(app).post('/api/friends/invite')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: carolId });
    const carolFriends = await request(app).get('/api/friends')
      .set('Authorization', `Bearer ${carolToken}`);
    const carolPending = carolFriends.body.find(f => f.status === 'pending');
    await request(app).put(`/api/friends/${carolPending.friendshipId}/accept`)
      .set('Authorization', `Bearer ${carolToken}`);

    await giveAlicePokemon(1, 1);
    // Gift to bob — uses the only copy
    await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1 });

    // Try gift to carol — all copies reserved
    const res = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: carolId, pokemonId: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('reserved');
  });

  it('cancels pending gifts when unfriending', async () => {
    await makeFriends();
    await giveAlicePokemon(1, 2);
    await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1 });

    // Get friendship ID
    const friends = await request(app).get('/api/friends')
      .set('Authorization', `Bearer ${aliceToken}`);
    const friendship = friends.body.find(f => f.status === 'accepted');

    // Unfriend
    await request(app).delete(`/api/friends/${friendship.friendshipId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    // Gift should be cancelled
    const gifts = await giftsCol().find({}).toArray();
    expect(gifts[0].status).toBe('cancelled');
  });

  it('auto-declines gift on accept if sender no longer has pokemon', async () => {
    await makeFriends();
    await giveAlicePokemon(1, 1);
    const sendRes = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1 });

    // Remove the pokemon from alice (simulate swap/evolve)
    await request(app).put('/api/trophy')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ collection: {} });

    const res = await request(app).put(`/api/gifts/${sendRes.body.giftId}/accept`)
      .set('Authorization', `Bearer ${bobToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('no longer has');
  });

  it('only recipient can accept a gift', async () => {
    await makeFriends();
    await giveAlicePokemon(1, 2);
    const sendRes = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1 });

    const res = await request(app).put(`/api/gifts/${sendRes.body.giftId}/accept`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(403);
  });

  it('logs trophy history for both sender and recipient on accept', async () => {
    await makeFriends();
    await giveAlicePokemon(1, 2);
    const sendRes = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1 });

    await request(app).put(`/api/gifts/${sendRes.body.giftId}/accept`)
      .set('Authorization', `Bearer ${bobToken}`);

    const aliceHistory = await request(app).get('/api/trophyhistory')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(aliceHistory.body.some(e => e.action === 'gift_sent')).toBe(true);

    const bobHistory = await request(app).get('/api/trophyhistory')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(bobHistory.body.some(e => e.action === 'gift_received')).toBe(true);
  });

  it('can gift last copy of a pokemon', async () => {
    await makeFriends();
    await giveAlicePokemon(1, 1);
    const res = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1 });
    expect(res.status).toBe(201);
  });

  it('removes pokemon from sender collection when gifting last copy and accepted', async () => {
    await makeFriends();
    await giveAlicePokemon(1, 1);
    const sendRes = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1 });

    await request(app).put(`/api/gifts/${sendRes.body.giftId}/accept`)
      .set('Authorization', `Bearer ${bobToken}`);

    const aliceTrophy = await request(app).get('/api/trophy')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(aliceTrophy.body.collection['1']).toBeUndefined();
  });

  // ── Shiny gift tests ─────────────────────────────────────────────────────

  const giveAliceShiny = async (pokemonId) => {
    const aliceTrophy = await request(app).get('/api/trophy')
      .set('Authorization', `Bearer ${aliceToken}`);
    const existing = aliceTrophy.body.collection[pokemonId] || {};
    await request(app).put('/api/trophy')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ collection: { ...aliceTrophy.body.collection, [pokemonId]: { ...existing, shiny: true } } });
  };

  it('sends a shiny gift when sender owns the shiny', async () => {
    await makeFriends();
    await giveAliceShiny(1);
    const res = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1, isShiny: true });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    // Gift document has isShiny: true
    const gifts = await request(app).get('/api/gifts')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(gifts.body[0].isShiny).toBe(true);
  });

  it('rejects shiny gift when sender has no shiny', async () => {
    await makeFriends();
    await giveAlicePokemon(1, 1); // regular copy only, no shiny
    const res = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1, isShiny: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('shiny');
  });

  it('prevents sending two pending shiny gifts for same pokemon', async () => {
    await makeFriends();
    const c = await createUser({ key: 'carol', name: 'Carol' });
    const carolId = c.body.user.id;
    const carolToken = (await loginUser('carol', '123456')).body.token;
    await request(app).post('/api/friends/invite')
      .set('Authorization', `Bearer ${aliceToken}`).send({ toUserId: carolId });
    const carolFriends = await request(app).get('/api/friends').set('Authorization', `Bearer ${carolToken}`);
    const carolPending = carolFriends.body.find(f => f.status === 'pending');
    await request(app).put(`/api/friends/${carolPending.friendshipId}/accept`)
      .set('Authorization', `Bearer ${carolToken}`);

    await giveAliceShiny(1);
    await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1, isShiny: true });

    const res = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: carolId, pokemonId: 1, isShiny: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('reserved');
  });

  it('accepts shiny gift: transfers shiny flag from sender to recipient', async () => {
    await makeFriends();
    await giveAlicePokemon(1, 2);
    await giveAliceShiny(1);

    const sendRes = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1, isShiny: true });

    await request(app).put(`/api/gifts/${sendRes.body.giftId}/accept`)
      .set('Authorization', `Bearer ${bobToken}`);

    const aliceTrophy = await request(app).get('/api/trophy')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(aliceTrophy.body.collection['1'].shiny).toBe(false); // shiny gone from sender

    const bobTrophy = await request(app).get('/api/trophy')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(bobTrophy.body.collection['1'].shiny).toBe(true); // shiny landed on recipient
  });

  it('accepts shiny gift and removes sender entry when they had only the shiny', async () => {
    await makeFriends();
    await giveAliceShiny(1); // shiny only, no regular count

    const sendRes = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1, isShiny: true });

    await request(app).put(`/api/gifts/${sendRes.body.giftId}/accept`)
      .set('Authorization', `Bearer ${bobToken}`);

    const aliceTrophy = await request(app).get('/api/trophy')
      .set('Authorization', `Bearer ${aliceToken}`);
    // Entry should be gone since sender had no regular copies
    expect(aliceTrophy.body.collection['1']).toBeUndefined();

    const bobTrophy = await request(app).get('/api/trophy')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(bobTrophy.body.collection['1'].shiny).toBe(true);
  });

  it('declines shiny gift: no collection change on either side', async () => {
    await makeFriends();
    await giveAliceShiny(1);

    const sendRes = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1, isShiny: true });

    await request(app).put(`/api/gifts/${sendRes.body.giftId}/decline`)
      .set('Authorization', `Bearer ${bobToken}`);

    const aliceTrophy = await request(app).get('/api/trophy')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(aliceTrophy.body.collection['1'].shiny).toBe(true); // still has shiny

    const bobTrophy = await request(app).get('/api/trophy')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(bobTrophy.body.collection['1']).toBeUndefined(); // bob got nothing
  });

  it('allows one pending regular and one pending shiny gift for same pokemon', async () => {
    await makeFriends();
    await giveAlicePokemon(1, 1);
    await giveAliceShiny(1);
    // Send regular
    const r1 = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1, isShiny: false });
    expect(r1.status).toBe(201);
    // Send shiny — different isShiny so not a duplicate
    const r2 = await request(app).post('/api/gifts/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ toUserId: bobId, pokemonId: 1, isShiny: true });
    expect(r2.status).toBe(201);
  });
});

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
    { method: 'get',  path: '/api/credithistory' },
    { method: 'put',  path: '/api/credithistory' },
    { method: 'get',  path: '/api/trophyhistory' },
    { method: 'post', path: '/api/trophyhistory' },
    { method: 'get',  path: '/api/weekly-stats' },
    { method: 'put',  path: '/api/weekly-stats/w2026-10' },
    { method: 'put',  path: '/api/users/me' },
    { method: 'put',  path: '/api/users/me/profile' },
    { method: 'post', path: '/api/gifts/send' },
    { method: 'get',  path: '/api/gifts' },
    { method: 'get',  path: '/api/gifts/pending-count' },
    { method: 'put',  path: '/api/gifts/some-id/accept' },
    { method: 'put',  path: '/api/gifts/some-id/decline' },
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

// ── Invite Codes ──────────────────────────────────────────────────────────────
describe('Invite code system', () => {
  it('admin can create an invite code', async () => {
    const token = await getAdminToken();
    const res = await request(app).post('/api/admin/invite-codes').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^[A-Z0-9]{8}$/);
    expect(res.body.usedBy).toBeNull();
    expect(res.body.createdByName).toBe('Admin');
  });

  it('admin can list all invite codes', async () => {
    const token = await getAdminToken();
    await request(app).post('/api/admin/invite-codes').set('Authorization', `Bearer ${token}`);
    await request(app).post('/api/admin/invite-codes').set('Authorization', `Bearer ${token}`);
    const res = await request(app).get('/api/admin/invite-codes').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('user can create up to 5 invite codes', async () => {
    await createUser();
    const { body: { token } } = await loginUser();
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/invite-codes').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(201);
    }
    const sixth = await request(app).post('/api/invite-codes').set('Authorization', `Bearer ${token}`);
    expect(sixth.status).toBe(400);
    expect(sixth.body.error).toMatch(/maximum/i);
  });

  it('user can list their own codes', async () => {
    await createUser();
    const { body: { token } } = await loginUser();
    await request(app).post('/api/invite-codes').set('Authorization', `Bearer ${token}`);
    const res = await request(app).get('/api/invite-codes').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].code).toBeDefined();
  });

  it('validate endpoint returns true for valid unused code', async () => {
    const code = await makeCode();
    const res = await request(app).get(`/api/invite-codes/validate?code=${code}`);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  it('validate endpoint returns false for unknown code', async () => {
    const res = await request(app).get('/api/invite-codes/validate?code=INVALID1');
    expect(res.body.valid).toBe(false);
  });

  it('POST /api/users fails without invite code', async () => {
    const res = await request(app).post('/api/users').send({
      key: 'alice', name: 'Alice', pin: '123456', starterId: 1, starterSlug: 'bulbasaur',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invite code/i);
  });

  it('POST /api/users fails with invalid invite code', async () => {
    const res = await request(app).post('/api/users').send({
      key: 'alice', name: 'Alice', pin: '123456', starterId: 1, starterSlug: 'bulbasaur', inviteCode: 'INVALID1',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('POST /api/users succeeds with valid invite code and marks it consumed', async () => {
    const code = await makeCode();
    const res = await request(app).post('/api/users').send({
      key: 'alice', name: 'Alice', pin: '123456', starterId: 1, starterSlug: 'bulbasaur', inviteCode: code,
    });
    expect(res.status).toBe(201);

    // Code should now be consumed
    const validateRes = await request(app).get(`/api/invite-codes/validate?code=${code}`);
    expect(validateRes.body.valid).toBe(false);
  });

  it('POST /api/users fails when code already consumed', async () => {
    const code = await makeCode();
    await request(app).post('/api/users').send({
      key: 'alice', name: 'Alice', pin: '123456', starterId: 1, starterSlug: 'bulbasaur', inviteCode: code,
    });
    const res = await request(app).post('/api/users').send({
      key: 'bob', name: 'Bob', pin: '123456', starterId: 1, starterSlug: 'bulbasaur', inviteCode: code,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already used/i);
  });

  it('consumed code shows usedByName', async () => {
    const code = await makeCode();
    await request(app).post('/api/users').send({
      key: 'alice', name: 'Alice', pin: '123456', starterId: 1, starterSlug: 'bulbasaur', inviteCode: code,
    });
    const adminToken = await getAdminToken();
    const res = await request(app).get('/api/admin/invite-codes').set('Authorization', `Bearer ${adminToken}`);
    const doc = res.body.find(c => c.code === code);
    expect(doc.usedByName).toBe('Alice');
  });
});
