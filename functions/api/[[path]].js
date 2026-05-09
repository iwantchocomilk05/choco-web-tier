export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '');
  const method = request.method;
  const seg = path.split('/').filter(Boolean);

  const json = (data, status = 200, headers = {}) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });

  const parseCookies = (raw) => (raw || '').split(';').filter(Boolean).reduce((a, p) => {
    const [k, ...v] = p.trim().split('=');
    a[k] = decodeURIComponent(v.join('='));
    return a;
  }, {});

  const cookies = parseCookies(request.headers.get('cookie'));
  const adminConfigured = Boolean(env.ADMIN_USERNAME && env.ADMIN_PASSWORD);
  const tokenSecret = env.ADMIN_SESSION_SECRET || env.ADMIN_PASSWORD || '';
  const isAdmin = adminConfigured && (
    request.headers.get('x-admin-password') === env.ADMIN_PASSWORD ||
    cookies.wt_admin_session === tokenSecret
  );

  const db = env.DB;
  if (!db) return json({ error: 'DB binding missing' }, 500);
  try { await db.prepare('ALTER TABLE webtoons ADD COLUMN platform TEXT').run(); } catch (_) {}

  const rowsToWebtoon = (r) => ({ ...r, score: Number(r.score || 0), likeCount: Number(r.like_count || 0), dislikeCount: Number(r.dislike_count || 0), imageUrl: r.image_url || '', platform: r.platform || '플랫폼 미정', reviewReason: r.review_reason || '', comments: JSON.parse(r.comments_json || '[]') });

  const BAD_WORDS = ['씨발','시발','병신','fuck','fucking','shit','bitch','섹스'];
  const normalizeText = (t='') => String(t).toLowerCase().replace(/[^a-z0-9가-힣\s]/g,' ').replace(/\s+/g,' ').trim();
  // 오탐 방지를 위해 문장 경계/토큰 기반으로 검사
  const containsProfanity = (t='') => {
    const n = normalizeText(t);
    if (!n) return false;
    const tokens = n.split(' ');
    return BAD_WORDS.some((w) => tokens.includes(normalizeText(w)) || n.match(new RegExp(`(^|\\s)${normalizeText(w)}($|\\s)`)));
  };

  if (seg[0] === 'auth' && seg[1] === 'login' && method === 'POST') {
    if (!adminConfigured) return json({ error: 'admin credentials not configured' }, 500);
    const b = await request.json().catch(() => ({}));
    if (b.username !== env.ADMIN_USERNAME || b.password !== env.ADMIN_PASSWORD) {
      return json({ error: 'invalid credentials' }, 401);
    }
    return json({ ok: true }, 200, {
      'Set-Cookie': `wt_admin_session=${encodeURIComponent(tokenSecret)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
    });
  }

  if (seg[0] === 'auth' && seg[1] === 'logout' && method === 'POST') {
    return json({ ok: true }, 200, {
      'Set-Cookie': 'wt_admin_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax'
    });
  }

  if (seg[0] === 'auth' && seg[1] === 'me') {
    return json({ isAdmin, adminConfigured });
  }

  if (seg[0] === 'webtoons' && seg.length === 1 && method === 'GET') {
    const { results } = await db.prepare('SELECT * FROM webtoons').all();
    return json(results.map(rowsToWebtoon));
  }

  if (seg[0] === 'webtoons' && seg.length === 1 && method === 'POST') {
    if (!isAdmin) return json({ error: 'admin only' }, 403);
    const b = await request.json();
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO webtoons (id,title,genre,tier,score,image_url,platform,note,review_reason,like_count,dislike_count,comments_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id, b.title || '', b.genre || '', (b.tier || 'B').toUpperCase(), Number(b.score || 0), b.imageUrl || '', b.platform || '', b.note || '', b.reviewReason || '', 0, 0, '[]', new Date().toISOString()).run();
    const one = await db.prepare('SELECT * FROM webtoons WHERE id=?').bind(id).first();
    return json(rowsToWebtoon(one), 201);
  }

  if (seg[0] === 'webtoons' && seg.length === 2 && method === 'PATCH') {
    if (!isAdmin) return json({ error: 'admin only' }, 403);
    const id = seg[1];
    const cur = await db.prepare('SELECT * FROM webtoons WHERE id=?').bind(id).first();
    if (!cur) return json({ error: 'not found' }, 404);
    const b = await request.json();
    await db.prepare('UPDATE webtoons SET title=?, genre=?, tier=?, score=?, image_url=?, platform=?, note=?, review_reason=? WHERE id=?').bind(b.title ?? cur.title, b.genre ?? cur.genre, (b.tier || cur.tier).toUpperCase(), b.score ?? cur.score, b.imageUrl ?? cur.image_url, b.platform ?? cur.platform, b.note ?? cur.note, b.reviewReason ?? cur.review_reason, id).run();
    const one = await db.prepare('SELECT * FROM webtoons WHERE id=?').bind(id).first();
    return json(rowsToWebtoon(one));
  }

  if (seg[0] === 'webtoons' && seg.length === 2 && method === 'DELETE') {
    if (!isAdmin) return json({ error: 'admin only' }, 403);
    await db.prepare('DELETE FROM webtoons WHERE id=?').bind(seg[1]).run();
    return new Response('', { status: 204 });
  }

  if (seg[0] === 'webtoons' && seg[2] === 'vote' && method === 'POST') {
    const id = seg[1]; const b = await request.json();
    const cur = await db.prepare('SELECT * FROM webtoons WHERE id=?').bind(id).first(); if (!cur) return json({ error: 'not found' }, 404);
    let like = Number(cur.like_count || 0), dislike = Number(cur.dislike_count || 0);
    if (b.prevVote === 'like') like = Math.max(0, like - 1); if (b.prevVote === 'dislike') dislike = Math.max(0, dislike - 1);
    if (b.vote === 'like') like += 1; if (b.vote === 'dislike') dislike += 1;
    await db.prepare('UPDATE webtoons SET like_count=?, dislike_count=? WHERE id=?').bind(like, dislike, id).run();
    return json({ likeCount: like, dislikeCount: dislike });
  }

  if (seg[0] === 'webtoons' && seg[2] === 'comments' && seg.length === 3 && method === 'POST') {
    const id = seg[1]; const b = await request.json();
    const cur = await db.prepare('SELECT * FROM webtoons WHERE id=?').bind(id).first(); if (!cur) return json({ error: 'not found' }, 404);
    const comments = JSON.parse(cur.comments_json || '[]');
    const nickname = isAdmin ? '쪼코우유먹을래' : (b.nickname || '익명');
    const content = b.content || '';
    if (containsProfanity(nickname) || containsProfanity(content)) return json({ error: '부적절한 표현이 포함되어 있어 등록할 수 없습니다.' }, 400);
    const ratingVal = b.rating===undefined||b.rating===null||b.rating==='' ? null : Number(b.rating);
    comments.push({ id: crypto.randomUUID(), nickname, content, rating: Number.isFinite(ratingVal)&&ratingVal>=0&&ratingVal<=10?ratingVal:null, createdAt: new Date().toISOString(), likeCount: 0, isAdmin, replies: [] });
    await db.prepare('UPDATE webtoons SET comments_json=? WHERE id=?').bind(JSON.stringify(comments), id).run();
    return json(comments[comments.length - 1], 201);
  }



  if (seg[0] === 'webtoons' && seg[2] === 'comments' && seg.length === 4 && method === 'DELETE') {
    if (!isAdmin) return json({ error: 'admin only' }, 403);
    const id = seg[1]; const commentId = seg[3];
    const cur = await db.prepare('SELECT * FROM webtoons WHERE id=?').bind(id).first(); if (!cur) return json({ error: 'not found' }, 404);
    const comments = JSON.parse(cur.comments_json || '[]').filter((c) => c.id !== commentId);
    await db.prepare('UPDATE webtoons SET comments_json=? WHERE id=?').bind(JSON.stringify(comments), id).run();
    return new Response('', { status: 204 });
  }

  if (seg[0] === 'webtoons' && seg[2] === 'comments' && seg[4] === 'like' && method === 'POST') {
    const id = seg[1]; const commentId = seg[3]; const b = await request.json().catch(()=>({}));
    const cur = await db.prepare('SELECT * FROM webtoons WHERE id=?').bind(id).first(); if (!cur) return json({ error: 'not found' }, 404);
    const comments = JSON.parse(cur.comments_json || '[]');
    const c = comments.find((x) => x.id === commentId); if (!c) return json({ error: 'comment not found' }, 404);
    c.likeCount = Number(c.likeCount || 0);
    c.likeCount = b.liked ? Math.max(0, c.likeCount - 1) : c.likeCount + 1;
    await db.prepare('UPDATE webtoons SET comments_json=? WHERE id=?').bind(JSON.stringify(comments), id).run();
    return json({ likeCount: c.likeCount });
  }

  if (seg[0] === 'webtoons' && seg[2] === 'comments' && seg[4] === 'replies' && method === 'POST') {
    const id = seg[1]; const commentId = seg[3]; const b = await request.json().catch(()=>({}));
    const cur = await db.prepare('SELECT * FROM webtoons WHERE id=?').bind(id).first(); if (!cur) return json({ error: 'not found' }, 404);
    const comments = JSON.parse(cur.comments_json || '[]');
    const c = comments.find((x) => x.id === commentId); if (!c) return json({ error: 'comment not found' }, 404);
    const nickname = isAdmin ? '쪼코우유먹을래' : (b.nickname || '익명');
    const content = b.content || '';
    if (containsProfanity(nickname) || containsProfanity(content)) return json({ error: '부적절한 표현이 포함되어 있어 등록할 수 없습니다.' }, 400);
    c.replies = Array.isArray(c.replies) ? c.replies : [];
    c.replies.push({ id: crypto.randomUUID(), nickname, content, createdAt: new Date().toISOString(), isAdmin });
    await db.prepare('UPDATE webtoons SET comments_json=? WHERE id=?').bind(JSON.stringify(comments), id).run();
    return json(c.replies[c.replies.length - 1], 201);
  }

  if (seg[0] === 'webtoons' && seg[2] === 'comments' && seg[4] === 'replies' && seg.length === 6 && method === 'DELETE') {
    if (!isAdmin) return json({ error: 'admin only' }, 403);
    const id = seg[1]; const commentId = seg[3]; const replyId = seg[5];
    const cur = await db.prepare('SELECT * FROM webtoons WHERE id=?').bind(id).first(); if (!cur) return json({ error: 'not found' }, 404);
    const comments = JSON.parse(cur.comments_json || '[]');
    const c = comments.find((x) => x.id === commentId); if (!c) return json({ error: 'comment not found' }, 404);
    c.replies = (c.replies || []).filter((r) => r.id !== replyId);
    await db.prepare('UPDATE webtoons SET comments_json=? WHERE id=?').bind(JSON.stringify(comments), id).run();
    return new Response('', { status: 204 });
  }

  return json({ error: 'not implemented in pages function yet', path, method }, 404);
}
