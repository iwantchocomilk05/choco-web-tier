const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'webtoons.json');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-admin-password';
const ADMIN_NICKNAME = '쪼코우유먹을래';
const AUTH_COOKIE = 'wt_admin_session';
const sessions = new Map();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const parseCookies = (req) => (req.headers.cookie || '').split(';').filter(Boolean).reduce((a, p) => { const [k, ...v] = p.trim().split('='); a[k] = decodeURIComponent(v.join('=')); return a; }, {});
const setCookie = (res, n, v, s) => res.setHeader('Set-Cookie', `${n}=${encodeURIComponent(v)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${s}`);
const clearCookie = (res, n) => res.setHeader('Set-Cookie', `${n}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
const getSession = (req) => { const t = parseCookies(req)[AUTH_COOKIE]; return t ? sessions.get(t) || null : null; };
const isAdminReq = (req) => getSession(req)?.username === ADMIN_USERNAME;
const requireAdmin = (req, res, next) => (isAdminReq(req) ? next() : res.status(403).json({ error: 'admin only' }));

const normalizeScore = (value, rating) => { const raw = value !== undefined ? Number(value) : Number(rating); if (Number.isNaN(raw)) return 0; return Math.round(Math.max(0, Math.min(10, raw * (value === undefined ? 2 : 1))) * 10) / 10; };
const normalizeReply = (r) => ({ id: r.id || crypto.randomUUID(), nickname: String(r.nickname || '익명').trim(), content: String(r.content || '').trim(), createdAt: r.createdAt || new Date().toISOString(), isAdmin: Boolean(r.isAdmin) });
const normalizeComment = (c) => ({ id: c.id || crypto.randomUUID(), nickname: String(c.nickname || '익명').trim(), content: String(c.content || c.text || '').trim(), createdAt: c.createdAt || new Date().toISOString(), likeCount: Math.max(0, Number(c.likeCount || 0)), isAdmin: Boolean(c.isAdmin), replies: Array.isArray(c.replies) ? c.replies.map(normalizeReply) : [] });
const normalizeWebtoon = (w) => ({ ...w, score: normalizeScore(w.score, w.rating), reviewReason: String(w.reviewReason || '').trim(), likeCount: Math.max(0, Number(w.likeCount || 0)), dislikeCount: Math.max(0, Number(w.dislikeCount || 0)), comments: Array.isArray(w.comments) ? w.comments.map(normalizeComment) : [] });

async function readWebtoons() { try { return JSON.parse(await fs.readFile(DATA_FILE, 'utf8')).map(normalizeWebtoon); } catch (e) { if (e.code === 'ENOENT') return []; throw e; } }
const writeWebtoons = (items) => fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), 'utf8');

app.post('/api/auth/login', (req, res) => { const { username, password } = req.body || {}; if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'invalid credentials' }); const t = crypto.randomUUID(); sessions.set(t, { username }); setCookie(res, AUTH_COOKIE, t, 604800); res.json({ ok: true }); });
app.post('/api/auth/logout', (req, res) => { const t = parseCookies(req)[AUTH_COOKIE]; if (t) sessions.delete(t); clearCookie(res, AUTH_COOKIE); res.json({ ok: true }); });
app.get('/api/auth/me', (req, res) => res.json({ isAdmin: isAdminReq(req), adminNickname: ADMIN_NICKNAME }));

app.get('/api/webtoons', asyncHandler(async (_req, res) => res.json(await readWebtoons())));
app.post('/api/webtoons', requireAdmin, asyncHandler(async (req, res) => { const items = await readWebtoons(); const n = normalizeWebtoon({ id: crypto.randomUUID(), ...req.body, tier: String(req.body?.tier || 'B').toUpperCase(), createdAt: new Date().toISOString() }); items.push(n); await writeWebtoons(items); res.status(201).json(n); }));
app.patch('/api/webtoons/:id', requireAdmin, asyncHandler(async (req, res) => { const items = await readWebtoons(); const i = items.findIndex(x=>x.id===req.params.id); if(i<0) return res.status(404).json({error:'not found'}); items[i]=normalizeWebtoon({...items[i],...req.body}); await writeWebtoons(items); res.json(items[i]); }));
app.delete('/api/webtoons/:id', requireAdmin, asyncHandler(async (req,res)=>{const items=await readWebtoons();const next=items.filter(x=>x.id!==req.params.id); if(next.length===items.length) return res.status(404).json({error:'not found'}); await writeWebtoons(next); res.status(204).send();}));

app.post('/api/webtoons/:id/vote', asyncHandler(async (req,res)=>{ const {vote}=req.body||{}; if(!['like','dislike',null].includes(vote)) return res.status(400).json({error:'invalid vote'}); const items=await readWebtoons(); const i=items.findIndex(x=>x.id===req.params.id); if(i<0) return res.status(404).json({error:'not found'}); const prev=req.body?.prevVote; if(prev==='like') items[i].likeCount=Math.max(0,items[i].likeCount-1); if(prev==='dislike') items[i].dislikeCount=Math.max(0,items[i].dislikeCount-1); if(vote==='like') items[i].likeCount+=1; if(vote==='dislike') items[i].dislikeCount+=1; await writeWebtoons(items); res.json({likeCount:items[i].likeCount,dislikeCount:items[i].dislikeCount}); }));

app.post('/api/webtoons/:id/comments', asyncHandler(async (req,res)=>{const items=await readWebtoons(); const i=items.findIndex(x=>x.id===req.params.id); if(i<0)return res.status(404).json({error:'not found'}); const admin=isAdminReq(req); const c=normalizeComment({id:crypto.randomUUID(),nickname:admin?ADMIN_NICKNAME:req.body?.nickname,content:req.body?.content,createdAt:new Date().toISOString(),isAdmin:admin}); if(!c.content)return res.status(400).json({error:'content required'}); items[i].comments.push(c); await writeWebtoons(items); res.status(201).json(c); }));
app.delete('/api/webtoons/:id/comments/:commentId', requireAdmin, asyncHandler(async (req,res)=>{const items=await readWebtoons(); const i=items.findIndex(x=>x.id===req.params.id); if(i<0)return res.status(404).json({error:'not found'}); items[i].comments=items[i].comments.filter(c=>c.id!==req.params.commentId); await writeWebtoons(items); res.status(204).send();}));
app.post('/api/webtoons/:id/comments/:commentId/like', asyncHandler(async (req,res)=>{const items=await readWebtoons(); const i=items.findIndex(x=>x.id===req.params.id); if(i<0)return res.status(404).json({error:'not found'}); const c=items[i].comments.find(c=>c.id===req.params.commentId); if(!c)return res.status(404).json({error:'not found'}); const prev=req.body?.liked===true; if(prev) c.likeCount=Math.max(0,c.likeCount-1); else c.likeCount+=1; await writeWebtoons(items); res.json({likeCount:c.likeCount});}));
app.post('/api/webtoons/:id/comments/:commentId/replies', asyncHandler(async (req,res)=>{const items=await readWebtoons(); const i=items.findIndex(x=>x.id===req.params.id); if(i<0)return res.status(404).json({error:'not found'}); const c=items[i].comments.find(c=>c.id===req.params.commentId); if(!c)return res.status(404).json({error:'not found'}); const admin=isAdminReq(req); const r=normalizeReply({id:crypto.randomUUID(),nickname:admin?ADMIN_NICKNAME:req.body?.nickname,content:req.body?.content,createdAt:new Date().toISOString(),isAdmin:admin}); if(!r.content)return res.status(400).json({error:'content required'}); c.replies.push(r); await writeWebtoons(items); res.status(201).json(r);}));
app.delete('/api/webtoons/:id/comments/:commentId/replies/:replyId', requireAdmin, asyncHandler(async (req,res)=>{const items=await readWebtoons(); const i=items.findIndex(x=>x.id===req.params.id); if(i<0)return res.status(404).json({error:'not found'}); const c=items[i].comments.find(c=>c.id===req.params.commentId); if(!c)return res.status(404).json({error:'not found'}); c.replies=c.replies.filter(r=>r.id!==req.params.replyId); await writeWebtoons(items); res.status(204).send();}));

app.use((err,_req,res,_next)=>res.status(500).json({error:'internal server error'}));
app.listen(PORT,()=>console.log(`http://localhost:${PORT}`));
