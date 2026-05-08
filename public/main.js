const tiers = ['S', 'A', 'B', 'C', 'D'];
let isAdminUser = false;

function stars(n) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function setStatus(message) {
  document.getElementById('admin-status').textContent = message;
}

function updateAdminUI() {
  document.getElementById('add-section').hidden = !isAdminUser;
  setStatus(isAdminUser ? '관리자 모드 활성화됨' : '읽기/댓글 모드 (공유 가능)');
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, { ...options, credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || '요청 실패');
  }
  if (res.status === 204) return null;
  return res.json();
}

async function loadWebtoons() {
  const items = await apiFetch('/api/webtoons');
  const wrapper = document.getElementById('tiers');
  wrapper.innerHTML = '';

  for (const tier of tiers) {
    const row = document.createElement('div');
    row.className = 'tier-row';
    row.innerHTML = `<h3>${tier} Tier</h3>`;

    const list = document.createElement('div');
    list.className = 'tier-items';

    const filtered = items.filter((x) => x.tier === tier).sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title));

    if (!filtered.length) list.innerHTML = '<p class="empty">아직 등록된 웹툰이 없어요.</p>';

    for (const item of filtered) {
      const card = document.createElement('article');
      card.className = 'item-card';
      card.innerHTML = `
        ${item.imageUrl ? `<img class="cover" src="${item.imageUrl}" alt="${item.title} 표지" />` : ''}
        <h4>${item.title}</h4>
        <p>${item.genre} · ${stars(item.rating)}</p>
        <p>${item.note || ''}</p>
      `;

      if (isAdminUser) {
        const actions = document.createElement('div');
        actions.className = 'actions';
        actions.innerHTML = `
          <select data-action="tier">${tiers.map((t) => `<option ${t === item.tier ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <select data-action="rating">${[5,4,3,2,1].map((r) => `<option value="${r}" ${r === item.rating ? 'selected' : ''}>${stars(r)}</option>`).join('')}</select>
          <button data-action="delete">삭제</button>
        `;

        actions.querySelector('[data-action="tier"]').addEventListener('change', async (e) => {
          await apiFetch(`/api/webtoons/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: e.target.value }) });
          await loadWebtoons();
        });
        actions.querySelector('[data-action="rating"]').addEventListener('change', async (e) => {
          await apiFetch(`/api/webtoons/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating: Number(e.target.value) }) });
          await loadWebtoons();
        });
        actions.querySelector('[data-action="delete"]').addEventListener('click', async () => {
          await apiFetch(`/api/webtoons/${item.id}`, { method: 'DELETE' });
          await loadWebtoons();
        });
        card.appendChild(actions);
      }

      const comments = document.createElement('div');
      const commentList = Array.isArray(item.comments) ? item.comments : [];
      comments.innerHTML = `<h5>댓글 (${commentList.length})</h5>`;

      const ul = document.createElement('ul');
      ul.className = 'comment-list';
      for (const c of commentList) {
        const li = document.createElement('li');
        li.textContent = `${c.nickname}: ${c.text}`;
        ul.appendChild(li);
      }
      comments.appendChild(ul);

      const form = document.createElement('form');
      form.className = 'comment-form';
      form.innerHTML = `
        <input name="nickname" placeholder="닉네임" />
        <input name="text" placeholder="댓글 작성" required />
        <button type="submit">등록</button>
      `;
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        await apiFetch(`/api/webtoons/${item.id}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nickname: fd.get('nickname'), text: fd.get('text') })
        });
        await loadWebtoons();
      });
      comments.appendChild(form);
      card.appendChild(comments);

      list.appendChild(card);
    }

    row.appendChild(list);
    wrapper.appendChild(row);
  }
}

async function refreshAuth() {
  const auth = await apiFetch('/api/auth/me');
  isAdminUser = auth.isAdmin;
  updateAdminUI();
}

async function boot() {
  document.getElementById('admin-login').addEventListener('click', async () => {
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value.trim();
    await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    await refreshAuth();
    await loadWebtoons();
  });

  document.getElementById('admin-logout').addEventListener('click', async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    await refreshAuth();
    await loadWebtoons();
  });

  document.getElementById('add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    await apiFetch('/api/webtoons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.get('title'), genre: form.get('genre'), tier: form.get('tier'), rating: Number(form.get('rating')), note: form.get('note'), imageUrl: form.get('imageUrl')
      })
    });
    e.target.reset();
    await loadWebtoons();
  });

  await refreshAuth();
  await loadWebtoons();
}

boot().catch((err) => setStatus(`초기화 실패: ${err.message}`));
