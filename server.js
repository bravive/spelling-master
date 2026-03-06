import express from 'express';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const DATA_FILE = join(DATA_DIR, 'users.json');

// Ensure data directory exists (important in production)
mkdirSync(DATA_DIR, { recursive: true });

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

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/api/users', (_req, res) => {
  res.json(readUsers());
});

app.post('/api/users', (req, res) => {
  writeUsers(req.body);
  res.json({ ok: true });
});

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  const distPath = join(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Spell Master API running on http://localhost:${PORT}`));
