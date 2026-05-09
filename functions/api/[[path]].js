export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '');
  const method = request.method;
  const seg = path.split('/').filter(Boolean);

  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const isAdmin = request.headers.get('x-admin-password') === env.ADMIN_PASSWORD;

  const db = env.DB;
  if (!db) return json({ error: 'DB binding missing' }, 500);

  const rowsToWebtoon = (r) => ({ ...r, score: Number(r.score || 0), likeCount: Number(r.like_count || 0), dislikeCount: Number(r.dislike_count || 0), imageUrl: r.image_url || '', reviewReason: r.review_reason || '', comments: JSON.parse(r.comments_json || '[]') });

  if (seg[0] === 'auth' && seg[1] === 'me') return json({ isAdmin });

  if (seg[0] === 'webtoons' && seg.length === 1 && method === 'GET') {
    const { results } = await db.prepare('SELECT * FROM webtoons').all();
    return json(results.map(rowsToWebtoon));
  }

  if (seg[0] === 'webtoons' && seg.length === 1 && method === 'POST') {
    if (!isAdmin) return json({ error: 'admin only' }, 403);
    const b = await request.json();
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO webtoons (id,title,genre,tier,score,image_url,note,review_reason,like_count,dislike_count,comments_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id, b.title || '', b.genre || '', (b.tier || 'B').toUpperCase(), Number(b.score || 0), b.imageUrl || '', b.note || '', b.reviewReason || '', 0, 0, '[]', new Date().toISOString()).run();
    const one = await db.prepare('SELECT * FROM webtoons WHERE id=?').bind(id).first();
    return json(rowsToWebtoon(one), 201);
  }

  if (seg[0] === 'webtoons' && seg.length === 2 && method === 'PATCH') {
    if (!isAdmin) return json({ error: 'admin only' }, 403);
    const id = seg[1];
    const cur = await db.prepare('SELECT * FROM webtoons WHERE id=?').bind(id).first();
    if (!cur) return json({ error: 'not found' }, 404);
    const b = await request.json();
    await db.prepare('UPDATE webtoons SET tier=?, score=?, review_reason=? WHERE id=?').bind((b.tier || cur.tier).toUpperCase(), b.score ?? cur.score, b.reviewReason ?? cur.review_reason, id).run();
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
    comments.push({ id: crypto.randomUUID(), nickname: isAdmin ? '쪼코우유먹을래' : (b.nickname || '익명'), content: b.content || '', createdAt: new Date().toISOString(), likeCount: 0, isAdmin, replies: [] });
    await db.prepare('UPDATE webtoons SET comments_json=? WHERE id=?').bind(JSON.stringify(comments), id).run();
    return json(comments[comments.length - 1], 201);
  }

  return json({ error: 'not implemented in pages function yet', path, method }, 404);
}
