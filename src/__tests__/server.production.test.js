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
  // Create a fake dist/ tree that mirrors what Vite produces
  mkdirSync(join(TEST_DIST, 'assets'), { recursive: true });
  writeFileSync(join(TEST_DIST, 'index.html'),            '<html><body>SPA</body></html>');
  writeFileSync(join(TEST_DIST, 'assets', 'app.js'),      'console.log("app")');
  writeFileSync(join(TEST_DIST, 'assets', 'app.css'),     'body { margin: 0; }');
  writeFileSync(join(TEST_DIST, 'assets', 'logo.svg'),    '<svg xmlns="http://www.w3.org/2000/svg"/>');
  writeFileSync(join(TEST_DIST, 'assets', 'sprite.png'),  Buffer.from([0x89, 0x50, 0x4e, 0x47])); // PNG magic bytes
  writeFileSync(join(TEST_DIST, 'assets', 'font.woff2'),  Buffer.from([0x77, 0x4f, 0x46, 0x32])); // wOF2 magic bytes
  writeFileSync(join(TEST_DIST, 'favicon.ico'),           Buffer.from([0x00, 0x00, 0x01, 0x00])); // ICO magic bytes
  writeFileSync(join(TEST_DIST, 'manifest.json'),         JSON.stringify({ name: 'Spell Master' }));

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
  it('serves dist/index.html at / with text/html content-type', async () => {
    const res = await get('/');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(await res.text()).toContain('SPA');
  });

  it('serves JS bundle with javascript content-type', async () => {
    const res = await get('/assets/app.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/javascript/);
    expect(await res.text()).toContain('console.log');
  });

  it('serves CSS bundle with text/css content-type', async () => {
    const res = await get('/assets/app.css');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/css/);
    expect(await res.text()).toContain('margin');
  });

  it('serves SVG with image/svg+xml content-type', async () => {
    const res = await get('/assets/logo.svg');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/svg/);
  });

  it('serves PNG with image/png content-type', async () => {
    const res = await get('/assets/sprite.png');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/image\/png/);
  });

  it('serves woff2 font with font/woff2 content-type', async () => {
    const res = await get('/assets/font.woff2');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/woff2/);
  });

  it('serves favicon.ico from dist root', async () => {
    const res = await get('/favicon.ico');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/image/);
  });

  it('serves manifest.json with application/json content-type', async () => {
    const res = await get('/manifest.json');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    const body = await res.json();
    expect(body.name).toBe('Spell Master');
  });

  it('sets ETag header for cacheable assets', async () => {
    const res = await get('/assets/app.js');
    expect(res.headers.get('etag')).toBeTruthy();
  });
});

// ── missing assets ────────────────────────────────────────────────────────────
describe('Missing static assets', () => {
  it('unknown asset path falls through to SPA index.html (200)', async () => {
    // express.static calls next() for missing files; SPA catch-all handles it
    const res = await get('/assets/chunk-missing-abc123.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/html/);
    expect(await res.text()).toContain('SPA');
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

  it('URL-encoded path → index.html', async () => {
    const res = await get('/game%2Fstage1');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('SPA');
  });
});
