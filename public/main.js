const tiers=['S','A','B','C','D'];let isAdminUser=false;let cached=[];
const fmt=(s)=>`${Number(s).toFixed(1)} / 10`;
const apiFetch=async(u,o={})=>{const r=await fetch(u,{...o,credentials:'include'});if(!r.ok){const b=await r.json().catch(()=>({}));throw new Error(b.error||'요청 실패')}return r.status===204?null:r.json();};
const setStatus=(m)=>document.getElementById('admin-status').textContent=m;
function updateAdminUI(){document.getElementById('add-section').hidden=!isAdminUser;setStatus(isAdminUser?'관리자 모드':'읽기 모드');}

function cardHtml(item){return `<div class='cover-wrap'>${item.imageUrl?`<img class='cover' src='${item.imageUrl}' alt='${item.title} 표지'/>`:`<div class='placeholder'>No Image</div>`}</div><h4>${item.title}</h4><p>${fmt(item.score)}</p>`;}

async function load(){cached=await apiFetch('/api/webtoons');const w=document.getElementById('tiers');w.innerHTML='';
for(const tier of tiers){const sec=document.createElement('div');sec.innerHTML=`<h3>${tier} Tier</h3><div class='tier-items'></div>`;const list=sec.querySelector('.tier-items');
cached.filter(x=>x.tier===tier).sort((a,b)=>b.score-a.score).forEach(item=>{const c=document.createElement('article');c.className='item-card';c.innerHTML=cardHtml(item);c.onclick=()=>openDetail(item.id);list.appendChild(c);});w.appendChild(sec);} }

function openDetail(id){const item=cached.find(x=>x.id===id);if(!item)return;const body=document.getElementById('detail-body');
body.innerHTML=`<h2>${item.title}</h2><p>${item.genre} · ${fmt(item.score)} · ${item.tier} Tier</p><p><b>한 줄 추천:</b> ${item.note||'-'}</p>
<div class='cover-wrap' style='max-width:240px'>${item.imageUrl?`<img class='cover' src='${item.imageUrl}'/>`:`<div class='placeholder'>No Image</div>`}</div>
<h3>상세 평가 이유</h3>${isAdminUser?`<textarea id='review-edit'>${item.reviewReason||''}</textarea><button id='save-review'>저장</button>`:`<p>${item.reviewReason||'아직 없음'}</p>`}
<h3>댓글</h3><ul>${(item.comments||[]).map(c=>`<li>${c.nickname}: ${c.text}</li>`).join('')}</ul>
<form id='comment-form' class='comment-form'><input name='nickname' placeholder='닉네임'/><input name='text' placeholder='댓글' required/><button>등록</button></form>
${isAdminUser?`<div class='actions'><select id='tier-edit'>${tiers.map(t=>`<option ${t===item.tier?'selected':''}>${t}</option>`).join('')}</select><input id='score-edit' type='number' step='0.1' min='0' max='10' value='${item.score}'/><button id='save-meta'>수정저장</button><button id='delete-item' class='secondary'>삭제</button></div>`:''}`;

if(isAdminUser){document.getElementById('save-review').onclick=async()=>{await apiFetch(`/api/webtoons/${item.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({reviewReason:document.getElementById('review-edit').value})});await load();openDetail(id);};
document.getElementById('save-meta').onclick=async()=>{await apiFetch(`/api/webtoons/${item.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({tier:document.getElementById('tier-edit').value,score:Number(document.getElementById('score-edit').value)})});await load();openDetail(id);};
document.getElementById('delete-item').onclick=async()=>{await apiFetch(`/api/webtoons/${item.id}`,{method:'DELETE'});closeModal();await load();};}

document.getElementById('comment-form').onsubmit=async(e)=>{e.preventDefault();const fd=new FormData(e.target);await apiFetch(`/api/webtoons/${item.id}/comments`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:fd.get('nickname'),text:fd.get('text')})});await load();openDetail(id);};

document.getElementById('detail-modal').classList.remove('hidden');}
function closeModal(){document.getElementById('detail-modal').classList.add('hidden');}

async function boot(){document.getElementById('modal-close').onclick=closeModal;document.getElementById('detail-modal').onclick=(e)=>{if(e.target.id==='detail-modal')closeModal();};
document.getElementById('admin-login').onclick=async()=>{await apiFetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.getElementById('admin-username').value.trim(),password:document.getElementById('admin-password').value.trim()})});await refresh();await load();};
document.getElementById('admin-logout').onclick=async()=>{await apiFetch('/api/auth/logout',{method:'POST'});await refresh();await load();};
document.getElementById('add-form').onsubmit=async(e)=>{e.preventDefault();const fd=new FormData(e.target);await apiFetch('/api/webtoons',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:fd.get('title'),genre:fd.get('genre'),tier:fd.get('tier'),score:Number(fd.get('score')),imageUrl:fd.get('imageUrl'),note:fd.get('note'),reviewReason:fd.get('reviewReason')})});e.target.reset();await load();};
await refresh();await load();}
async function refresh(){const me=await apiFetch('/api/auth/me');isAdminUser=me.isAdmin;updateAdminUI();}
boot().catch(e=>setStatus(e.message));
