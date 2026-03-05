import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, 'data', 'users.json');

const readUsers = () => {
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {};
  }
};

const STRIP_FIELDS = new Set(['wordStats', 'collection', 'shinyEligible', 'consecutiveRegular', 'roundHistory', 'bestScores']);
const writeUsers = (data) => {
  const clean = {};
  for (const [k, v] of Object.entries(data)) {
    const entry = {};
    for (const [f, val] of Object.entries(v)) {
      if (!STRIP_FIELDS.has(f)) entry[f] = val;
    }
    clean[k] = entry;
  }
  writeFileSync(DATA_FILE, JSON.stringify(clean, null, 2), 'utf8');
};

// ─── Per-user file helpers ────────────────────────────────────────────────────
const makeFileHelpers = (suffix, emptyVal) => {
  const path = (u) => join(__dirname, 'data', `${u}-${suffix}.json`);
  const read = (u) => { try { return JSON.parse(readFileSync(path(u), 'utf8')); } catch { return emptyVal(); } };
  const write = (u, d) => writeFileSync(path(u), JSON.stringify(d, null, 2), 'utf8');
  return { path, read, write };
};

const ws  = makeFileHelpers('wordstats',    () => ({}));
const col = makeFileHelpers('collection',   () => ({ collection: {}, shinyEligible: false, consecutiveRegular: 0 }));
const rh  = makeFileHelpers('roundhistory', () => ({ roundHistory: [], bestScores: {} }));

// Keep old names for wordstats (used in migration below)
const wordStatsFile = ws.path;
const readWordStats  = ws.read;
const writeWordStats = ws.write;

// One-time migration: extract embedded per-user data from users.json into separate files
const migrate = () => {
  const users = readUsers();
  let dirty = false;
  for (const [username, user] of Object.entries(users)) {
    // wordStats
    if (user.wordStats && Object.keys(user.wordStats).length > 0) {
      if (!existsSync(wordStatsFile(username))) writeWordStats(username, user.wordStats);
      delete user.wordStats;
      dirty = true;
    }
    // collection
    const colFields = ['collection', 'shinyEligible', 'consecutiveRegular'];
    if (colFields.some(f => f in user)) {
      if (!existsSync(col.path(username))) {
        col.write(username, {
          collection: user.collection || {},
          shinyEligible: user.shinyEligible ?? false,
          consecutiveRegular: user.consecutiveRegular ?? 0,
        });
      }
      colFields.forEach(f => delete user[f]);
      dirty = true;
    }
    // roundHistory
    const rhFields = ['roundHistory', 'bestScores'];
    if (rhFields.some(f => f in user)) {
      if (!existsSync(rh.path(username))) {
        rh.write(username, {
          roundHistory: user.roundHistory || [],
          bestScores: user.bestScores || {},
        });
      }
      rhFields.forEach(f => delete user[f]);
      dirty = true;
    }
  }
  if (dirty) writeFileSync(DATA_FILE, JSON.stringify(users, null, 2), 'utf8');
};

migrate();

const app = express();
app.use(express.json({ limit: '4mb' }));

app.get('/api/users', (_req, res) => {
  res.json(readUsers());
});

app.post('/api/users', (req, res) => {
  writeUsers(req.body);
  res.json({ ok: true });
});

app.get('/api/wordstats/:username', (req, res) => res.json(ws.read(req.params.username)));
app.post('/api/wordstats/:username', (req, res) => { ws.write(req.params.username, req.body); res.json({ ok: true }); });

app.get('/api/collection/:username', (req, res) => res.json(col.read(req.params.username)));
app.post('/api/collection/:username', (req, res) => { col.write(req.params.username, req.body); res.json({ ok: true }); });

app.get('/api/roundhistory/:username', (req, res) => res.json(rh.read(req.params.username)));
app.post('/api/roundhistory/:username', (req, res) => { rh.write(req.params.username, req.body); res.json({ ok: true }); });

const PORT = 3001;
app.listen(PORT, () => console.log(`Spell Master API running on http://localhost:${PORT}`));
