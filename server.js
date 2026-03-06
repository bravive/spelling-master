import express from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataFile = (name) => join(__dirname, 'data', `${name}.json`);

// ─── Generic shared-file helpers ─────────────────────────────────────────────
// Each file is { [username]: { ...data } }
const readFile  = (name) => { try { return JSON.parse(readFileSync(dataFile(name), 'utf8')); } catch { return {}; } };
const writeFile = (name, data) => writeFileSync(dataFile(name), JSON.stringify(data, null, 2), 'utf8');

const readEntry  = (name, username) => readFile(name)[username] || null;
const writeEntry = (name, username, entry) => {
  const all = readFile(name);
  all[username] = entry;
  writeFile(name, all);
};

// ─── users.json helpers ───────────────────────────────────────────────────────
const STRIP_FIELDS = new Set(['wordStats', 'collection', 'shinyEligible', 'consecutiveRegular', 'roundHistory', 'bestScores']);
const readUsers = () => readFile('users');
const writeUsers = (data) => {
  const clean = {};
  for (const [k, v] of Object.entries(data)) {
    const entry = {};
    for (const [f, val] of Object.entries(v)) {
      if (!STRIP_FIELDS.has(f)) entry[f] = val;
    }
    clean[k] = entry;
  }
  writeFile('users', clean);
};

// ─── Migration: extract embedded fields from users.json into shared files ─────
const migrate = () => {
  const users = readUsers();
  let dirty = false;
  const colAll = readFile('collection');
  const rhAll  = readFile('roundhistory');
  const wsAll  = readFile('wordstats');

  for (const [username, user] of Object.entries(users)) {
    if (user.wordStats && Object.keys(user.wordStats).length > 0) {
      if (!wsAll[username]) wsAll[username] = user.wordStats;
      delete user.wordStats; dirty = true;
    }
    const colFields = ['collection', 'shinyEligible', 'consecutiveRegular'];
    if (colFields.some(f => f in user)) {
      if (!colAll[username]) colAll[username] = {
        collection: user.collection || {},
        shinyEligible: user.shinyEligible ?? false,
        consecutiveRegular: user.consecutiveRegular ?? 0,
      };
      colFields.forEach(f => delete user[f]); dirty = true;
    }
    const rhFields = ['roundHistory', 'bestScores'];
    if (rhFields.some(f => f in user)) {
      if (!rhAll[username]) rhAll[username] = {
        roundHistory: user.roundHistory || [],
        bestScores: user.bestScores || {},
      };
      rhFields.forEach(f => delete user[f]); dirty = true;
    }
  }

  if (dirty) {
    writeFile('users', users);
    writeFile('wordstats', wsAll);
    writeFile('collection', colAll);
    writeFile('roundhistory', rhAll);
  }
};

migrate();

// ─── Express ──────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '4mb' }));

app.get('/api/users', (_req, res) => res.json(readUsers()));
app.post('/api/users', (req, res) => { writeUsers(req.body); res.json({ ok: true }); });

app.get('/api/wordstats/:username',   (req, res) => res.json(readEntry('wordstats',   req.params.username) || {}));
app.post('/api/wordstats/:username',  (req, res) => { writeEntry('wordstats',  req.params.username, req.body); res.json({ ok: true }); });

app.get('/api/collection/:username',  (req, res) => res.json(readEntry('collection',  req.params.username) || { collection: {}, shinyEligible: false, consecutiveRegular: 0 }));
app.post('/api/collection/:username', (req, res) => { writeEntry('collection', req.params.username, req.body); res.json({ ok: true }); });

app.get('/api/roundhistory/:username',  (req, res) => res.json(readEntry('roundhistory',  req.params.username) || { roundHistory: [], bestScores: {} }));
app.post('/api/roundhistory/:username', (req, res) => { writeEntry('roundhistory', req.params.username, req.body); res.json({ ok: true }); });

const PORT = 3001;
app.listen(PORT, () => console.log(`Spell Master API running on http://localhost:${PORT}`));
