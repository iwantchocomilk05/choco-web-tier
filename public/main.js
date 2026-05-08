const tiers = ['S', 'A', 'B', 'C', 'D'];
let adminPassword = localStorage.getItem('adminPassword') || '';

function stars(n) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function setStatus(message) {
  document.getElementById('admin-status').textContent = message;
}

function isAdmin() {
  return Boolean(adminPassword);
}

function updateAdminUI() {
  document.getElementById('add-section').hidden = !isAdmin();
  setStatus(isAdmin() ? '관리자 모드 활성화됨 (작성/수정 가능)' : '읽기 전용 모드 (다른 사람에게 공유 가능)');
}

async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (isAdmin()) {
    headers['x-admin-password'] = adminPassword;
  }

  const res = await fetch(url, { ...options, headers });
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

    const filtered = items
      .filter((x) => x.tier === tier)
      .sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title));

    if (!filtered.length) {
      list.innerHTML = '<p class="empty">아직 등록된 웹툰이 없어요.</p>';
    }

    for (const item of filtered) {
      const card = document.createElement('article');
      card.className = 'item-card';
      card.innerHTML = `
        <h4>${item.title}</h4>
        <p>${item.genre} · ${stars(item.rating)}</p>
        <p>${item.note || ''}</p>
      `;

      if (isAdmin()) {
        const actions = document.createElement('div');
        actions.className = 'actions';
        actions.innerHTML = `
          <select data-action="tier">${tiers
            .map((t) => `<option ${t === item.tier ? 'selected' : ''}>${t}</option>`)
            .join('')}</select>
          <select data-action="rating">${[5, 4, 3, 2, 1]
            .map((r) => `<option value="${r}" ${r === item.rating ? 'selected' : ''}>${stars(r)}</option>`)
            .join('')}</select>
          <button data-action="delete">삭제</button>
        `;

        actions.querySelector('[data-action="tier"]').addEventListener('change', async (e) => {
          await apiFetch(`/api/webtoons/${item.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tier: e.target.value })
          });
          await loadWebtoons();
        });

        actions.querySelector('[data-action="rating"]').addEventListener('change', async (e) => {
          await apiFetch(`/api/webtoons/${item.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating: Number(e.target.value) })
          });
          await loadWebtoons();
        });

        actions.querySelector('[data-action="delete"]').addEventListener('click', async () => {
          await apiFetch(`/api/webtoons/${item.id}`, { method: 'DELETE' });
          await loadWebtoons();
        });

        card.appendChild(actions);
      }

      list.appendChild(card);
    }

    row.appendChild(list);
    wrapper.appendChild(row);
  }
}

async function boot() {
  updateAdminUI();
  await loadWebtoons();

  document.getElementById('admin-login').addEventListener('click', async () => {
    const input = document.getElementById('admin-password');
    const candidate = input.value.trim();
    if (!candidate) {
      setStatus('비밀번호를 입력해주세요.');
      return;
    }

    const backup = adminPassword;
    adminPassword = candidate;
    try {
      await apiFetch('/api/webtoons');
      localStorage.setItem('adminPassword', candidate);
      updateAdminUI();
      setStatus('관리자 로그인 성공');
      await loadWebtoons();
    } catch (_err) {
      adminPassword = backup;
      setStatus('로그인 실패: 비밀번호를 확인해주세요.');
    }
  });

  document.getElementById('admin-logout').addEventListener('click', async () => {
    adminPassword = '';
    localStorage.removeItem('adminPassword');
    updateAdminUI();
    setStatus('로그아웃 완료 (읽기 전용 모드)');
    await loadWebtoons();
  });

  document.getElementById('add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    await apiFetch('/api/webtoons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.get('title'),
        genre: form.get('genre'),
        tier: form.get('tier'),
        rating: Number(form.get('rating')),
        note: form.get('note')
      })
    });
    e.target.reset();
    await loadWebtoons();
  });
}

boot().catch((err) => {
  setStatus(`초기화 실패: ${err.message}`);
});
