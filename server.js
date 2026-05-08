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

const normalizeScore = (value, fallbackRating) => {
  const raw = value !== undefined ? Number(value) : Number(fallbackRating);
  if (Number.isNaN(raw)) return 0;
  return Math.round(Math.min(10, Math.max(0, raw * (value === undefined ? 2 : 1))) * 10) / 10;
};

function normalizeComment(comment) {
  return {
    id: comment.id || crypto.randomUUID(),
    nickname: String(comment.nickname || '익명').trim(),
    content: String(comment.content || comment.text || '').trim(),
    createdAt: comment.createdAt || new Date().toISOString()
  };
}

function normalizeWebtoon(item) {
  return {
    ...item,
    score: normalizeScore(item.score, item.rating),
    reviewReason: String(item.reviewReason || item.detailReview || '').trim(),
    recommendation: ['recommend', 'not_recommend'].includes(item.recommendation) ? item.recommendation : 'recommend',
    comments: Array.isArray(item.comments) ? item.comments.map(normalizeComment) : []
  };
}

const parseCookies = (req) => (req.headers.cookie || '').split(';').filter(Boolean).reduce((a, p) => { const [k, ...v] = p.trim().split('='); a[k] = decodeURIComponent(v.join('=')); return a; }, {});
const setCookie = (res, n, v, s) => res.setHeader('Set-Cookie', `${n}=${encodeURIComponent(v)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${s}`);
const clearCookie = (res, n) => res.setHeader('Set-Cookie', `${n}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
const getSession = (req) => { const t = parseCookies(req)[AUTH_COOKIE]; return t ? sessions.get(t) || null : null; };
const requireAdmin = (req, res, next) => (getSession(req)?.username === ADMIN_USERNAME ? next() : res.status(403).json({ error: 'admin only' }));

async function readWebtoons() { try { return JSON.parse(await fs.readFile(DATA_FILE, 'utf8')).map(normalizeWebtoon); } catch (e) { if (e.code === 'ENOENT') return []; throw e; } }
const writeWebtoons = (items) => fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), 'utf8');

app.post('/api/auth/login', (req, res) => { const { username, password } = req.body || {}; if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'invalid credentials' }); const t = crypto.randomUUID(); sessions.set(t, { username }); setCookie(res, AUTH_COOKIE, t, 604800); return res.json({ ok: true }); });
app.post('/api/auth/logout', (req, res) => { const t = parseCookies(req)[AUTH_COOKIE]; if (t) sessions.delete(t); clearCookie(res, AUTH_COOKIE); res.json({ ok: true }); });
app.get('/api/auth/me', (req, res) => res.json({ isAdmin: getSession(req)?.username === ADMIN_USERNAME }));

app.get('/api/webtoons', asyncHandler(async (_req, res) => res.json(await readWebtoons())));
app.post('/api/webtoons', requireAdmin, asyncHandler(async (req, res) => {
  const { title, genre, tier = 'B', score = 0, note = '', imageUrl = '', reviewReason = '', recommendation = 'recommend' } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title is required' });
  const safeRec = ['recommend', 'not_recommend'].includes(recommendation) ? recommendation : 'recommend';
  const item = normalizeWebtoon({ id: crypto.randomUUID(), title: String(title).trim(), genre: String(genre || '기타').trim(), tier: String(tier).toUpperCase(), score: normalizeScore(score), note: String(note).trim(), imageUrl: String(imageUrl).trim(), reviewReason: String(reviewReason).trim(), recommendation: safeRec, comments: [], createdAt: new Date().toISOString() });
  if (!['S', 'A', 'B', 'C', 'D'].includes(item.tier)) return res.status(400).json({ error: 'invalid tier' });
  const items = await readWebtoons(); items.push(item); await writeWebtoons(items); res.status(201).json(item);
}));
app.patch('/api/webtoons/:id', requireAdmin, asyncHandler(async (req, res) => {
  const items = await readWebtoons(); const i = items.findIndex((x) => x.id === req.params.id); if (i === -1) return res.status(404).json({ error: 'webtoon not found' });
  const next = normalizeWebtoon({ ...items[i], ...req.body, tier: String((req.body?.tier ?? items[i].tier)).toUpperCase(), recommendation: req.body?.recommendation ?? items[i].recommendation, score: req.body?.score ?? items[i].score });
  if (!['S', 'A', 'B', 'C', 'D'].includes(next.tier)) return res.status(400).json({ error: 'invalid tier' });
  items[i] = next; await writeWebtoons(items); res.json(next);
}));
app.delete('/api/webtoons/:id', requireAdmin, asyncHandler(async (req, res) => { const items = await readWebtoons(); const next = items.filter((x) => x.id !== req.params.id); if (next.length === items.length) return res.status(404).json({ error: 'webtoon not found' }); await writeWebtoons(next); res.status(204).send(); }));
app.post('/api/webtoons/:id/comments', asyncHandler(async (req, res) => {
  const items = await readWebtoons(); const i = items.findIndex((x) => x.id === req.params.id); if (i === -1) return res.status(404).json({ error: 'webtoon not found' });
  const comment = normalizeComment({ id: crypto.randomUUID(), nickname: req.body?.nickname, content: req.body?.content ?? req.body?.text, createdAt: new Date().toISOString() });
  if (!comment.content) return res.status(400).json({ error: 'content is required' });
  items[i].comments.push(comment); await writeWebtoons(items); res.status(201).json(comment);
}));
app.delete('/api/webtoons/:id/comments/:commentId', requireAdmin, asyncHandler(async (req, res) => {
  const items = await readWebtoons(); const i = items.findIndex((x) => x.id === req.params.id); if (i === -1) return res.status(404).json({ error: 'webtoon not found' });
  const before = items[i].comments.length;
  items[i].comments = items[i].comments.filter((c) => c.id !== req.params.commentId);
  if (before === items[i].comments.length) return res.status(404).json({ error: 'comment not found' });
  await writeWebtoons(items); res.status(204).send();
}));

app.use((err, _req, res, _next) => res.status(500).json({ error: 'internal server error' }));
app.listen(PORT, () => console.log(`Webtoon Tier app listening on http://localhost:${PORT}`));
