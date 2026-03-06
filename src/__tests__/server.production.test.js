// @vitest-environment node
//
// Tests the production static-file serving behaviour of the Express server:
//   - GET /ping → health check
//   - API routes are NOT swallowed by the SPA fallback
//   - Unknown routes fall back to dist/index.html  (Express 5 /*path fix)
//   - Static assets in dist/ are served directly
//
// We build a minimal Express app with the exact same routing block used in
// server.js so these tests also act as a regression guard for the
// path-to-regexp v8 wildcard issue (bare '*' crashes; '/*path' works).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..', '..');
const TEST_DIST = join(ROOT, 'test-dist-tmp');

let server;
let base;

beforeAll(async () => {
  // Create a minimal fake dist/ so express.static and sendFile have real files
  mkdirSync(join(TEST_DIST, 'assets'), { recursive: true });
  writeFileSync(join(TEST_DIST, 'index.html'),       '<html><body>SPA</body></html>');
  writeFileSync(join(TEST_DIST, 'assets', 'app.js'), 'console.log("app")');

  // Minimal app that mirrors the production routing in server.js
  const app = express();

  // Health check (same as server.js line 76)
  app.get('/ping', (_req, res) => res.json({ ok: true }));

  // Stub API route — proves it is NOT overridden by the SPA fallback
  app.get('/api/users', (_req, res) => res.json({ stubbed: true }));

  // Production static serving block — exactly what server.js does
  app.use(express.static(TEST_DIST));
  app.get('/*path', (_req, res) => res.sendFile(join(TEST_DIST, 'index.html')));

  server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
  rmSync(TEST_DIST, { recursive: true, force: true });
});

// ── helper ────────────────────────────────────────────────────────────────────
const get = (path) => fetch(`${base}${path}`);

// ── health check ──────────────────────────────────────────────────────────────
describe('GET /ping', () => {
  it('returns 200 { ok: true }', async () => {
    const res = await get('/ping');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

// ── API route priority ────────────────────────────────────────────────────────
describe('API routes take priority over SPA fallback', () => {
  it('GET /api/users is not swallowed by /*path', async () => {
    const res = await get('/api/users');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stubbed).toBe(true);
  });
});

// ── static asset serving ──────────────────────────────────────────────────────
describe('Static assets from dist/', () => {
  it('serves dist/index.html at /', async () => {
    const res = await get('/');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/html/);
    expect(await res.text()).toContain('SPA');
  });

  it('serves dist/assets/app.js directly', async () => {
    const res = await get('/assets/app.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/javascript/);
    expect(await res.text()).toContain('console.log');
  });
});

// ── SPA fallback (the /*path fix) ─────────────────────────────────────────────
describe('SPA fallback via /*path wildcard (Express 5 fix)', () => {
  it('unknown top-level route → index.html', async () => {
    const res = await get('/dashboard');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('SPA');
  });

  it('deep nested route → index.html', async () => {
    const res = await get('/game/stage2/results');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('SPA');
  });

  it('route with query string → index.html', async () => {
    const res = await get('/collection?user=alice');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('SPA');
  });
});
