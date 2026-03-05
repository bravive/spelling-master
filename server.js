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

const writeUsers = (data) => {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
};

const wordStatsFile = (username) =>
  join(__dirname, 'data', `${username}-wordstats.json`);

const readWordStats = (username) => {
  try {
    return JSON.parse(readFileSync(wordStatsFile(username), 'utf8'));
  } catch {
    return {};
  }
};

const writeWordStats = (username, data) => {
  writeFileSync(wordStatsFile(username), JSON.stringify(data, null, 2), 'utf8');
};

const app = express();
app.use(express.json({ limit: '4mb' }));

app.get('/api/users', (_req, res) => {
  res.json(readUsers());
});

app.post('/api/users', (req, res) => {
  writeUsers(req.body);
  res.json({ ok: true });
});

app.get('/api/wordstats/:username', (req, res) => {
  res.json(readWordStats(req.params.username));
});

app.post('/api/wordstats/:username', (req, res) => {
  writeWordStats(req.params.username, req.body);
  res.json({ ok: true });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Spell Master API running on http://localhost:${PORT}`));
