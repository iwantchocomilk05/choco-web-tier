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

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function normalizeScore(value, fallbackRating) {
  const raw = value !== undefined ? Number(value) : Number(fallbackRating);
  if (Number.isNaN(raw)) return 0;
  return Math.round(Math.min(10, Math.max(0, raw * (value === undefined ? 2 : 1))) * 10) / 10;
}

function normalizeWebtoon(item) {
  return {
    ...item,
    score: normalizeScore(item.score, item.rating),
    reviewReason: String(item.reviewReason || item.detailReview || '').trim(),
    comments: Array.isArray(item.comments) ? item.comments : []
  };
}

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
  const token = parseCookies(req)[AUTH_COOKIE];
  return token ? sessions.get(token) || null : null;
}
function requireAdmin(req, res, next) {
  const session = getSession(req);
  if (!session || session.username !== ADMIN_USERNAME) return res.status(403).json({ error: 'admin only' });
  return next();
}

async function readWebtoons() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw).map(normalizeWebtoon);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}
async function writeWebtoons(items) { await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), 'utf8'); }

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'invalid credentials' });
  const token = crypto.randomUUID();
  sessions.set(token, { username, createdAt: Date.now() });
  setCookie(res, AUTH_COOKIE, token, 60 * 60 * 24 * 7);
  return res.json({ ok: true, username });
});
app.post('/api/auth/logout', (req, res) => { const token = parseCookies(req)[AUTH_COOKIE]; if (token) sessions.delete(token); clearCookie(res, AUTH_COOKIE); res.json({ ok: true }); });
app.get('/api/auth/me', (req, res) => { const session = getSession(req); res.json({ isAdmin: Boolean(session?.username === ADMIN_USERNAME) }); });

app.get('/api/webtoons', asyncHandler(async (_req, res) => res.json(await readWebtoons())));

app.post('/api/webtoons', requireAdmin, asyncHandler(async (req, res) => {
  const { title, genre, tier = 'B', score = 0, note = '', imageUrl = '', reviewReason = '' } = req.body || {};
  if (!title || typeof title !== 'string') return res.status(400).json({ error: 'title is required' });
  const normalizedScore = normalizeScore(score);
  if (normalizedScore < 0 || normalizedScore > 10) return res.status(400).json({ error: 'score must be between 0 and 10' });
  if (!['S', 'A', 'B', 'C', 'D'].includes(String(tier).toUpperCase())) return res.status(400).json({ error: 'tier must be one of S,A,B,C,D' });

  const item = {
    id: crypto.randomUUID(), title: title.trim(), genre: String(genre || '기타').trim(), tier: String(tier).toUpperCase(),
    score: normalizedScore, note: String(note || '').trim(), imageUrl: String(imageUrl || '').trim(), reviewReason: String(reviewReason || '').trim(), comments: [], createdAt: new Date().toISOString()
  };
  const items = await readWebtoons(); items.push(item); await writeWebtoons(items); res.status(201).json(item);
}));

app.patch('/api/webtoons/:id', requireAdmin, asyncHandler(async (req, res) => {
  const items = await readWebtoons();
  const i = items.findIndex((x) => x.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'webtoon not found' });
  const next = { ...items[i], ...req.body };
  if (next.score !== undefined) {
    next.score = normalizeScore(next.score);
    if (next.score < 0 || next.score > 10) return res.status(400).json({ error: 'score must be between 0 and 10' });
  }
  if (next.tier && !['S','A','B','C','D'].includes(String(next.tier).toUpperCase())) return res.status(400).json({ error: 'invalid tier' });
  next.tier = String(next.tier || items[i].tier).toUpperCase();
  next.reviewReason = String(next.reviewReason || '').trim();
  items[i] = normalizeWebtoon(next); await writeWebtoons(items); res.json(items[i]);
}));

app.delete('/api/webtoons/:id', requireAdmin, asyncHandler(async (req, res) => {
  const items = await readWebtoons(); const next = items.filter((x) => x.id !== req.params.id);
  if (next.length === items.length) return res.status(404).json({ error: 'webtoon not found' });
  await writeWebtoons(next); res.status(204).send();
}));

app.post('/api/webtoons/:id/comments', asyncHandler(async (req, res) => {
  const { nickname = '익명', text = '' } = req.body || {};
  if (!String(text).trim()) return res.status(400).json({ error: 'text is required' });
  const items = await readWebtoons(); const i = items.findIndex((x) => x.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'webtoon not found' });
  const comment = { id: crypto.randomUUID(), nickname: String(nickname || '익명').trim(), text: String(text).trim(), createdAt: new Date().toISOString() };
  items[i].comments.push(comment); await writeWebtoons(items); res.status(201).json(comment);
}));

app.use((err, _req, res, _next) => res.status(500).json({ error: 'internal server error' }));
app.listen(PORT, () => console.log(`Webtoon Tier app listening on http://localhost:${PORT}`));
