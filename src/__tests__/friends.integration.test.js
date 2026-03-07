import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb, usersCol, trophiesCol, wordstatsCol, roundhistoryCol, friendshipsCol, messagesCol } from '../db.js';
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
  await Promise.all([
    usersCol().deleteMany({}),
    trophiesCol().deleteMany({}),
    wordstatsCol().deleteMany({}),
    roundhistoryCol().deleteMany({}),
    friendshipsCol().deleteMany({}),
    messagesCol().deleteMany({}),
  ]);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const createUser = (key, name, pin = '1234') =>
  request(app).post('/api/users').send({ key, name, pin, starterId: 1, starterSlug: 'bulbasaur' });

const login = (userId, pin = '1234') =>
  request(app).post('/api/auth/login').send({ userId, pin });

const auth = (token) => ({ Authorization: `Bearer ${token}` });

// ── Friend search ─────────────────────────────────────────────────────────────
describe('GET /api/friends/search', () => {
  it('returns matching users excluding self', async () => {
    await createUser('alice', 'Alice');
    await createUser('bob', 'Bob');
    const { body: { token } } = await login('alice');

    const res = await request(app).get('/api/friends/search?q=bob').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].userId).toBe('bob');
    expect(res.body[0].name).toBe('Bob');
  });

  it('does not return self in search results', async () => {
    await createUser('alice', 'Alice');
    const { body: { token } } = await login('alice');

    const res = await request(app).get('/api/friends/search?q=alice').set(auth(token));
    expect(res.body).toHaveLength(0);
  });

  it('returns empty for no match', async () => {
    await createUser('alice', 'Alice');
    const { body: { token } } = await login('alice');

    const res = await request(app).get('/api/friends/search?q=xyz').set(auth(token));
    expect(res.body).toHaveLength(0);
  });
});

// ── Friend invite flow ────────────────────────────────────────────────────────
describe('Friend invite flow', () => {
  it('sends an invite and shows as pending', async () => {
    const { body: { user: alice } } = await createUser('alice', 'Alice');
    const { body: { user: bob } } = await createUser('bob', 'Bob');
    const { body: { token: aliceToken } } = await login('alice');
    const { body: { token: bobToken } } = await login('bob');

    // Alice invites Bob
    const inviteRes = await request(app).post('/api/friends/invite')
      .set(auth(aliceToken)).send({ toUserId: bob.id });
    expect(inviteRes.status).toBe(201);

    // Bob sees the pending invite
    const bobFriends = await request(app).get('/api/friends').set(auth(bobToken));
    expect(bobFriends.body).toHaveLength(1);
    expect(bobFriends.body[0].status).toBe('pending');
    expect(bobFriends.body[0].name).toBe('Alice');

    // Alice also sees the pending invite
    const aliceFriends = await request(app).get('/api/friends').set(auth(aliceToken));
    expect(aliceFriends.body).toHaveLength(1);
    expect(aliceFriends.body[0].status).toBe('pending');
  });

  it('accepts an invite', async () => {
    const { body: { user: alice } } = await createUser('alice', 'Alice');
    const { body: { user: bob } } = await createUser('bob', 'Bob');
    const { body: { token: aliceToken } } = await login('alice');
    const { body: { token: bobToken } } = await login('bob');

    await request(app).post('/api/friends/invite')
      .set(auth(aliceToken)).send({ toUserId: bob.id });

    const bobFriends = await request(app).get('/api/friends').set(auth(bobToken));
    const friendshipId = bobFriends.body[0].friendshipId;

    // Bob accepts
    const acceptRes = await request(app).put(`/api/friends/${friendshipId}/accept`).set(auth(bobToken));
    expect(acceptRes.status).toBe(200);

    // Both see accepted friendship
    const aliceF = await request(app).get('/api/friends').set(auth(aliceToken));
    expect(aliceF.body[0].status).toBe('accepted');
  });

  it('prevents accepting your own invite', async () => {
    const { body: { user: bob } } = await createUser('bob', 'Bob');
    await createUser('alice', 'Alice');
    const { body: { token: aliceToken } } = await login('alice');

    const { body: { friendshipId } } = await request(app).post('/api/friends/invite')
      .set(auth(aliceToken)).send({ toUserId: bob.id });

    const res = await request(app).put(`/api/friends/${friendshipId}/accept`).set(auth(aliceToken));
    expect(res.status).toBe(403);
  });

  it('prevents duplicate invites', async () => {
    const { body: { user: bob } } = await createUser('bob', 'Bob');
    await createUser('alice', 'Alice');
    const { body: { token: aliceToken } } = await login('alice');

    await request(app).post('/api/friends/invite').set(auth(aliceToken)).send({ toUserId: bob.id });
    const res = await request(app).post('/api/friends/invite').set(auth(aliceToken)).send({ toUserId: bob.id });
    expect(res.status).toBe(409);
  });

  it('declines an invite', async () => {
    const { body: { user: bob } } = await createUser('bob', 'Bob');
    await createUser('alice', 'Alice');
    const { body: { token: aliceToken } } = await login('alice');
    const { body: { token: bobToken } } = await login('bob');

    await request(app).post('/api/friends/invite').set(auth(aliceToken)).send({ toUserId: bob.id });

    const bobFriends = await request(app).get('/api/friends').set(auth(bobToken));
    const friendshipId = bobFriends.body[0].friendshipId;

    await request(app).delete(`/api/friends/${friendshipId}`).set(auth(bobToken));

    const after = await request(app).get('/api/friends').set(auth(bobToken));
    expect(after.body).toHaveLength(0);
  });

  it('cannot friend yourself', async () => {
    const { body: { user: alice } } = await createUser('alice', 'Alice');
    const { body: { token } } = await login('alice');

    const res = await request(app).post('/api/friends/invite')
      .set(auth(token)).send({ toUserId: alice.id });
    expect(res.status).toBe(400);
  });
});

// ── Messages ──────────────────────────────────────────────────────────────────
describe('Messages', () => {
  let aliceToken, bobToken, aliceId, bobId;

  beforeEach(async () => {
    const { body: { user: alice } } = await createUser('alice', 'Alice');
    const { body: { user: bob } } = await createUser('bob', 'Bob');
    aliceId = alice.id;
    bobId = bob.id;
    ({ body: { token: aliceToken } } = await login('alice'));
    ({ body: { token: bobToken } } = await login('bob'));

    // Create and accept friendship
    await request(app).post('/api/friends/invite').set(auth(aliceToken)).send({ toUserId: bobId });
    const friends = await request(app).get('/api/friends').set(auth(bobToken));
    await request(app).put(`/api/friends/${friends.body[0].friendshipId}/accept`).set(auth(bobToken));
  });

  it('sends and receives messages', async () => {
    const sendRes = await request(app).post(`/api/friends/${bobId}/messages`)
      .set(auth(aliceToken)).send({ text: 'Hello Bob!' });
    expect(sendRes.status).toBe(201);
    expect(sendRes.body.text).toBe('Hello Bob!');

    const msgs = await request(app).get(`/api/friends/${aliceId}/messages`).set(auth(bobToken));
    expect(msgs.body).toHaveLength(1);
    expect(msgs.body[0].text).toBe('Hello Bob!');
  });

  it('rejects messages to non-friends', async () => {
    await createUser('carol', 'Carol');
    const { body: { token: carolToken, user: carol } } = await login('carol', '1234');

    const res = await request(app).post(`/api/friends/${bobId}/messages`)
      .set(auth(carolToken)).send({ text: 'Hey!' });
    expect(res.status).toBe(403);
  });

  it('rejects messages over 200 characters', async () => {
    const res = await request(app).post(`/api/friends/${bobId}/messages`)
      .set(auth(aliceToken)).send({ text: 'x'.repeat(201) });
    expect(res.status).toBe(400);
  });

  it('tracks unread counts', async () => {
    await request(app).post(`/api/friends/${bobId}/messages`)
      .set(auth(aliceToken)).send({ text: 'msg1' });
    await request(app).post(`/api/friends/${bobId}/messages`)
      .set(auth(aliceToken)).send({ text: 'msg2' });

    const unread = await request(app).get('/api/friends/unread').set(auth(bobToken));
    expect(unread.body[aliceId]).toBe(2);

    // Reading messages clears unread
    await request(app).get(`/api/friends/${aliceId}/messages`).set(auth(bobToken));
    const after = await request(app).get('/api/friends/unread').set(auth(bobToken));
    expect(after.body[aliceId]).toBeUndefined();
  });

  it('rejects empty messages', async () => {
    const res = await request(app).post(`/api/friends/${bobId}/messages`)
      .set(auth(aliceToken)).send({ text: '' });
    expect(res.status).toBe(400);
  });
});
