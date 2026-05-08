const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'webtoons.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-admin-password';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function readWebtoons() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeWebtoons(items) {
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), 'utf8');
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function requireAdmin(req, res, next) {
  const password = req.header('x-admin-password');
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'admin only' });
  }
  return next();
}

app.get('/api/config', (_req, res) => {
  res.json({
    adminConfigured: ADMIN_PASSWORD !== 'change-me-admin-password',
    writeMode: 'admin-only'
  });
});

app.get('/api/webtoons', asyncHandler(async (_req, res) => {
  const items = await readWebtoons();
  res.json(items);
}));

app.post('/api/webtoons', requireAdmin, asyncHandler(async (req, res) => {
  const { title, genre, tier = 'B', rating = 3, note = '' } = req.body || {};

  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'title is required' });
  }

  const normalized = {
    id: crypto.randomUUID(),
    title: title.trim(),
    genre: String(genre || '기타').trim(),
    tier: String(tier || 'B').toUpperCase(),
    rating: Number(rating),
    note: String(note || '').trim(),
    createdAt: new Date().toISOString()
  };

  if (Number.isNaN(normalized.rating) || normalized.rating < 1 || normalized.rating > 5) {
    return res.status(400).json({ error: 'rating must be between 1 and 5' });
  }

  const allowedTiers = ['S', 'A', 'B', 'C', 'D'];
  if (!allowedTiers.includes(normalized.tier)) {
    return res.status(400).json({ error: 'tier must be one of S,A,B,C,D' });
  }

  const items = await readWebtoons();
  items.push(normalized);
  await writeWebtoons(items);

  return res.status(201).json(normalized);
}));

app.patch('/api/webtoons/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const items = await readWebtoons();
  const index = items.findIndex((x) => x.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'webtoon not found' });
  }

  const current = items[index];
  const next = { ...current, ...req.body };

  if (next.tier) {
    next.tier = String(next.tier).toUpperCase();
    if (!['S', 'A', 'B', 'C', 'D'].includes(next.tier)) {
      return res.status(400).json({ error: 'tier must be one of S,A,B,C,D' });
    }
  }

  if (next.rating !== undefined) {
    next.rating = Number(next.rating);
    if (Number.isNaN(next.rating) || next.rating < 1 || next.rating > 5) {
      return res.status(400).json({ error: 'rating must be between 1 and 5' });
    }
  }

  items[index] = next;
  await writeWebtoons(items);

  return res.json(next);
}));

app.delete('/api/webtoons/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const items = await readWebtoons();
  const next = items.filter((x) => x.id !== id);

  if (next.length === items.length) {
    return res.status(404).json({ error: 'webtoon not found' });
  }

  await writeWebtoons(next);
  return res.status(204).send();
}));

app.use((err, _req, res, _next) => {
  console.error('[server-error]', err);
  return res.status(500).json({ error: 'internal server error' });
});

app.listen(PORT, () => {
  console.log(`Webtoon Tier app listening on http://localhost:${PORT}`);
});
