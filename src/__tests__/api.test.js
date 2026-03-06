// @vitest-environment node
//
// Integration tests for the Express API endpoints fixed in the persistence bug:
//   POST /api/users       — create user with correct payload
//   POST /api/auth/login  — PIN validation, JWT issuance
//   GET  /api/users       — public list, PINs stripped
//   PUT  /api/users/:id   — authenticated game-state save (wordStats, credits, etc.)
//   DELETE /api/users/:id — admin-only profile deletion
//
// vi.hoisted sets RAILWAY_VOLUME_MOUNT_PATH before server.js is imported so
// the data file ends up in a throw-away temp directory.
//
// Login calls are intentionally minimised (≤ 9 total) to stay under the
// 10-per-15-min rate limit enforced by the shared Express server instance.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:http';

const TEST_DATA_DIR = vi.hoisted(() => {
  const dir = `/tmp/spelling-api-test-${process.pid}`;
  process.env.RAILWAY_VOLUME_MOUNT_PATH = dir;
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.ADMIN_PIN  = '0000';
  return dir;
});

import { app } from '../../server.js';

let server;
let base;

const resetData = () => writeFileSync(join(TEST_DATA_DIR, 'users.json'), '{}');

beforeAll(async () => {
  mkdirSync(TEST_DATA_DIR, { recursive: true });
  resetData();
  server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
  rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  delete process.env.RAILWAY_VOLUME_MOUNT_PATH;
  delete process.env.JWT_SECRET;
  delete process.env.ADMIN_PIN;
});

// ── request helpers ───────────────────────────────────────────────────────────
const authHeader = (token) => (token ? { Authorization: `Bearer ${token}` } : {});

const apiGet = (path, token) =>
  fetch(`${base}${path}`, { headers: authHeader(token) });

const apiPost = (path, body, token) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify(body),
  });

const apiPut = (path, body, token) =>
  fetch(`${base}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify(body),
  });

const apiDelete = (path, token) =>
  fetch(`${base}${path}`, { method: 'DELETE', headers: authHeader(token) });

// Shorthand: create a user
const createUser = (key, name, pin = '1234', starterId = 1, starterSlug = 'bulbasaur') =>
  apiPost('/api/users', { key, name, pin, starterId, starterSlug });

// Shorthand: log in and return just the JWT string
const loginToken = async (userId, pin) => {
  const data = await apiPost('/api/auth/login', { userId, pin }).then(r => r.json());
  return data.token;
};

// ── POST /api/users ───────────────────────────────────────────────────────────
describe('POST /api/users', () => {
  // Each test here creates users; reset before each so keys don't clash.
  beforeEach(resetData);

  it('creates a user and returns the profile without PIN', async () => {
    const res = await createUser('alice', 'Alice');
    expect(res.status).toBe(201);
    const { ok, user } = await res.json();
    expect(ok).toBe(true);
    expect(user.name).toBe('Alice');
    expect(user.level).toBe(1);
    expect(user.creditBank).toBe(0);
    expect(user.pin).toBeUndefined(); // server strips PIN from response
  });

  it('persists the new user (visible via GET /api/users)', async () => {
    await createUser('alice', 'Alice');
    const users = await apiGet('/api/users').then(r => r.json());
    expect(users.alice?.name).toBe('Alice');
  });

  it('rejects missing required fields', async () => {
    const res = await apiPost('/api/users', { key: 'bob', name: 'Bob' });
    expect(res.status).toBe(400);
  });

  it('rejects a PIN that is not exactly 4 digits', async () => {
    const res = await createUser('carol', 'Carol', '12');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/4 digits/i);
  });

  it('rejects the reserved key "test"', async () => {
    const res = await apiPost('/api/users', { key: 'test', name: 'Test', pin: '1234', starterId: 1, starterSlug: 'squirtle' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/reserved/i);
  });

  it('rejects a duplicate key with 409', async () => {
    await createUser('dave', 'Dave');
    const res = await createUser('dave', 'Dave', '5678');
    expect(res.status).toBe(409);
  });

  it('rejects keys with spaces or uppercase letters', async () => {
    const res = await apiPost('/api/users', { key: 'Dave Smith', name: 'Dave', pin: '1234', starterId: 1, starterSlug: 'bulbasaur' });
    expect(res.status).toBe(400);
  });

  it('accepts keys using the client-side derivation (lowercase + underscores)', async () => {
    const res = await apiPost('/api/users', { key: 'jane_doe', name: 'Jane Doe', pin: '1234', starterId: 1, starterSlug: 'pikachu' });
    expect(res.status).toBe(201);
  });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
// Each login call here counts against the shared rate limit (max 10 / 15 min).
// This group uses 5 calls: 2 success + 3 failure. The remaining 4 calls are
// shared between the PUT and DELETE groups (1 alice + 1 admin each).
describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    resetData();
    await createUser('alice', 'Alice', '1234');
  });

  it('returns a JWT and public user on valid PIN', async () => {
    const res = await apiPost('/api/auth/login', { userId: 'alice', pin: '1234' });
    expect(res.status).toBe(200);
    const { token, user } = await res.json();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // header.payload.sig
    expect(user.name).toBe('Alice');
    expect(user.pin).toBeUndefined();
  });

  it('rejects a wrong PIN with 401', async () => {
    const res = await apiPost('/api/auth/login', { userId: 'alice', pin: '9999' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for a non-existent user without leaking which field is wrong', async () => {
    const res = await apiPost('/api/auth/login', { userId: 'nobody', pin: '1234' });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/wrong pin/i);
  });

  it('allows admin (userId="test") login with the configured PIN', async () => {
    const res = await apiPost('/api/auth/login', { userId: 'test', pin: '0000' });
    expect(res.status).toBe(200);
    const { token, user } = await res.json();
    expect(typeof token).toBe('string');
    expect(user.isAdmin).toBe(true);
  });

  it('rejects admin login with a wrong PIN', async () => {
    const res = await apiPost('/api/auth/login', { userId: 'test', pin: '1111' });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/users ────────────────────────────────────────────────────────────
describe('GET /api/users', () => {
  beforeAll(async () => {
    resetData();
    await createUser('alice', 'Alice');
  });

  it('returns users with PINs stripped', async () => {
    const res = await apiGet('/api/users');
    expect(res.status).toBe(200);
    const users = await res.json();
    expect(users.alice).toBeDefined();
    expect(users.alice.pin).toBeUndefined();
    expect(users.alice.name).toBe('Alice');
  });

  it('returns an empty object when no users exist', async () => {
    resetData();
    const users = await apiGet('/api/users').then(r => r.json());
    expect(users).toEqual({});
  });
});

// ── PUT /api/users/me ─────────────────────────────────────────────────────────
// Alice's token is obtained once in beforeAll (login call #6 of the budget).
// Each test recreates Alice via beforeEach so the DB row is fresh, but the
// JWT remains valid — it is stateless and does not depend on the DB record.
describe('PUT /api/users/me', () => {
  let aliceToken;

  beforeAll(async () => {
    resetData();
    await createUser('alice', 'Alice', '1234');
    aliceToken = await loginToken('alice', '1234'); // login call #6
  });

  beforeEach(async () => {
    resetData();
    await createUser('alice', 'Alice', '1234');
  });

  it('saves game state (creditBank, streak) with a valid JWT', async () => {
    const res = await apiPut('/api/users/me', { creditBank: 7, streak: 3 }, aliceToken);
    expect(res.status).toBe(200);
    const users = await apiGet('/api/users').then(r => r.json());
    expect(users.alice.creditBank).toBe(7);
    expect(users.alice.streak).toBe(3);
  });

  it('saves wordStats as part of the user object', async () => {
    const wordStats = { cat: { attempts: 3, correct: 2, weight: 1.0 } };
    const res = await apiPut('/api/users/me', { wordStats }, aliceToken);
    expect(res.status).toBe(200);
    const users = await apiGet('/api/users').then(r => r.json());
    expect(users.alice.wordStats).toEqual(wordStats);
  });

  it('does not overwrite the stored PIN even if pin is included in the body', async () => {
    await apiPut('/api/users/me', { pin: '9999' }, aliceToken);
    // Attempting login with the bogus PIN must fail (original bcrypt hash unchanged)
    const res = await apiPost('/api/auth/login', { userId: 'alice', pin: '9999' });
    expect(res.status).toBe(401); // login call #7
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await apiPut('/api/users/me', { creditBank: 99 });
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/users/:id ─────────────────────────────────────────────────────
// Admin token (login call #8) and Alice token (login call #9) obtained once
// in beforeAll. Each test recreates Alice via beforeEach.
describe('DELETE /api/users/:id', () => {
  let adminToken;
  let aliceToken;

  beforeAll(async () => {
    resetData();
    await createUser('alice', 'Alice', '1234');
    adminToken = await loginToken('test', '0000');  // login call #8
    aliceToken = await loginToken('alice', '1234'); // login call #9
  });

  beforeEach(async () => {
    resetData();
    await createUser('alice', 'Alice', '1234');
  });

  it('admin can delete a user', async () => {
    const res = await apiDelete('/api/users/alice', adminToken);
    expect(res.status).toBe(200);
    const users = await apiGet('/api/users').then(r => r.json());
    expect(users.alice).toBeUndefined();
  });

  it('returns 404 when deleting a non-existent user', async () => {
    const res = await apiDelete('/api/users/nobody', adminToken);
    expect(res.status).toBe(404);
  });

  it('prevents deletion of the admin account with 400', async () => {
    const res = await apiDelete('/api/users/test', adminToken);
    expect(res.status).toBe(400);
  });

  it('rejects delete from a regular user JWT with 403', async () => {
    await createUser('bob', 'Bob', '5678');
    const res = await apiDelete('/api/users/bob', aliceToken);
    expect(res.status).toBe(403);
  });

  it('rejects delete without any JWT with 401', async () => {
    const res = await apiDelete('/api/users/alice');
    expect(res.status).toBe(401);
  });
});
