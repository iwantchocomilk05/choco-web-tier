const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'webtoons.json');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-admin-password';
const AUTH_COOKIE = 'wt_admin_session';
const sessions = new Map();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return header.split(';').reduce((acc, pair) => {
    const [k, ...v] = pair.trim().split('=');
    acc[k] = decodeURIComponent(v.join('='));
    return acc;
  }, {});
}

function setCookie(res, name, value, maxAgeSec) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (maxAgeSec) parts.push(`Max-Age=${maxAgeSec}`);
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
}

function getSession(req) {
  const cookies = parseCookies(req);
  const token = cookies[AUTH_COOKIE];
  if (!token) return null;
  return sessions.get(token) || null;
}

function requireAdmin(req, res, next) {
  const session = getSession(req);
  if (!session || session.username !== ADMIN_USERNAME) {
    return res.status(403).json({ error: 'admin only' });
  }
  return next();
}

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

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  const token = crypto.randomUUID();
  sessions.set(token, { username, createdAt: Date.now() });
  setCookie(res, AUTH_COOKIE, token, 60 * 60 * 24 * 7);
  return res.json({ ok: true, username });
});

app.post('/api/auth/logout', (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies[AUTH_COOKIE];
  if (token) sessions.delete(token);
  clearCookie(res, AUTH_COOKIE);
  return res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const session = getSession(req);
  return res.json({ isAdmin: Boolean(session && session.username === ADMIN_USERNAME), username: session?.username || null });
});

app.get('/api/webtoons', asyncHandler(async (_req, res) => {
  const items = await readWebtoons();
  res.json(items);
}));

app.post('/api/webtoons', requireAdmin, asyncHandler(async (req, res) => {
  const { title, genre, tier = 'B', rating = 3, note = '', imageUrl = '' } = req.body || {};

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
    imageUrl: String(imageUrl || '').trim(),
    comments: [],
    createdAt: new Date().toISOString()
  };

  if (Number.isNaN(normalized.rating) || normalized.rating < 1 || normalized.rating > 5) {
    return res.status(400).json({ error: 'rating must be between 1 and 5' });
  }

  if (!['S', 'A', 'B', 'C', 'D'].includes(normalized.tier)) {
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

  if (index === -1) return res.status(404).json({ error: 'webtoon not found' });

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

  if (next.imageUrl !== undefined) {
    next.imageUrl = String(next.imageUrl || '').trim();
  }

  items[index] = next;
  await writeWebtoons(items);
  return res.json(next);
}));

app.delete('/api/webtoons/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const items = await readWebtoons();
  const next = items.filter((x) => x.id !== id);
  if (next.length === items.length) return res.status(404).json({ error: 'webtoon not found' });
  await writeWebtoons(next);
  return res.status(204).send();
}));

app.post('/api/webtoons/:id/comments', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nickname = '익명', text = '' } = req.body || {};
  const commentText = String(text).trim();
  if (!commentText) return res.status(400).json({ error: 'text is required' });

  const items = await readWebtoons();
  const index = items.findIndex((x) => x.id === id);
  if (index === -1) return res.status(404).json({ error: 'webtoon not found' });

  const comment = {
    id: crypto.randomUUID(),
    nickname: String(nickname || '익명').trim(),
    text: commentText,
    createdAt: new Date().toISOString()
  };

  const target = items[index];
  target.comments = Array.isArray(target.comments) ? target.comments : [];
  target.comments.push(comment);
  items[index] = target;
  await writeWebtoons(items);
  return res.status(201).json(comment);
}));

app.use((err, _req, res, _next) => {
  console.error('[server-error]', err);
  return res.status(500).json({ error: 'internal server error' });
});

app.listen(PORT, () => {
  console.log(`Webtoon Tier app listening on http://localhost:${PORT}`);
});
