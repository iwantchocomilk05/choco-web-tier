const tiers=['S','A','B','C','D'];let isAdminUser=false;let cached=[];
const apiFetch=async(u,o={})=>{const r=await fetch(u,{...o,credentials:'include'});if(!r.ok){const b=await r.json().catch(()=>({}));throw new Error(b.error||'요청 실패')}return r.status===204?null:r.json();};
const fmt=(s)=>`${Number(s||0).toFixed(1)} / 10`;const recBadge=(r)=>r==='not_recommend'?`<span class='badge bad'>비추천</span>`:`<span class='badge good'>추천</span>`;
const setStatus=(m)=>document.getElementById('admin-status').textContent=m;
function updateAdminUI(){document.getElementById('add-section').hidden=!isAdminUser;setStatus(isAdminUser?'관리자 모드':'읽기 모드');}

async function load(){cached=await apiFetch('/api/webtoons');const w=document.getElementById('tiers');w.innerHTML='';
for(const tier of tiers){const wrap=document.createElement('section');wrap.className=`tier-box tier-${tier}`;wrap.innerHTML=`<h3>${tier} TIER</h3><div class='tier-items'></div>`;const list=wrap.querySelector('.tier-items');
cached.filter(x=>x.tier===tier).sort((a,b)=>b.score-a.score).forEach(item=>{const c=document.createElement('article');c.className='item-card';c.innerHTML=`<div class='cover-wrap'>${item.imageUrl?`<img class='cover' src='${item.imageUrl}'/>`:`<div class='placeholder'>No Cover</div>`}</div><div class='meta'><h4>${item.title}</h4>${recBadge(item.recommendation)}<p>${fmt(item.score)}</p></div>`;c.onclick=()=>openDetail(item.id);list.appendChild(c);});
w.appendChild(wrap);} }

function commentListHtml(item){const comments=item.comments||[];if(!comments.length)return `<p class='empty-msg'>아직 댓글이 없습니다.</p>`;return `<ul class='comment-list'>${comments.map(c=>`<li><div><b>${c.nickname}</b><p>${c.content||c.text||''}</p></div>${isAdminUser?`<button class='danger' data-delete-comment='${c.id}'>삭제</button>`:''}</li>`).join('')}</ul>`;}

function openDetail(id){const item=cached.find(x=>x.id===id);if(!item)return;const body=document.getElementById('detail-body');
body.innerHTML=`<h2>${item.title}</h2><p>${item.genre} · ${fmt(item.score)} · ${item.tier} Tier ${recBadge(item.recommendation)}</p><p>${item.note||''}</p><div class='cover-wrap detail-cover'>${item.imageUrl?`<img class='cover' src='${item.imageUrl}'/>`:`<div class='placeholder'>No Cover</div>`}</div>
<h3>평가 이유</h3>${isAdminUser?`<textarea id='review-edit'>${item.reviewReason||''}</textarea><div class='actions'><select id='tier-edit'>${tiers.map(t=>`<option ${t===item.tier?'selected':''}>${t}</option>`).join('')}</select><input id='score-edit' type='number' min='0' max='10' step='0.1' value='${item.score}'/><select id='rec-edit'><option value='recommend' ${item.recommendation!=='not_recommend'?'selected':''}>추천</option><option value='not_recommend' ${item.recommendation==='not_recommend'?'selected':''}>비추천</option></select><button id='save-meta'>저장</button><button id='delete-item' class='ghost'>작품삭제</button></div>`:`<p>${item.reviewReason||'아직 없음'}</p>`}
<h3>댓글</h3>${commentListHtml(item)}<form id='comment-form' class='comment-form'><input name='nickname' placeholder='닉네임'/><input name='content' placeholder='댓글 내용' required/><button>등록</button></form>`;

body.querySelector('#comment-form').onsubmit=async(e)=>{e.preventDefault();const fd=new FormData(e.target);await apiFetch(`/api/webtoons/${item.id}/comments`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:fd.get('nickname'),content:fd.get('content')})});await load();openDetail(id);};
if(isAdminUser){document.getElementById('save-meta').onclick=async()=>{await apiFetch(`/api/webtoons/${item.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({tier:document.getElementById('tier-edit').value,score:Number(document.getElementById('score-edit').value),reviewReason:document.getElementById('review-edit').value,recommendation:document.getElementById('rec-edit').value})});await load();openDetail(id);};
document.getElementById('delete-item').onclick=async()=>{if(confirm('이 작품을 삭제할까요?')){await apiFetch(`/api/webtoons/${item.id}`,{method:'DELETE'});closeModal();await load();}};
body.querySelectorAll('[data-delete-comment]').forEach((btn)=>btn.onclick=async()=>{if(!confirm('댓글을 삭제할까요?'))return;await apiFetch(`/api/webtoons/${item.id}/comments/${btn.dataset.deleteComment}`,{method:'DELETE'});await load();openDetail(id);});}

document.getElementById('detail-modal').classList.remove('hidden');}
const closeModal=()=>document.getElementById('detail-modal').classList.add('hidden');

async function refresh(){const me=await apiFetch('/api/auth/me');isAdminUser=me.isAdmin;updateAdminUI();}
async function boot(){document.getElementById('modal-close').onclick=closeModal;document.getElementById('detail-modal').onclick=(e)=>{if(e.target.id==='detail-modal')closeModal();};
document.getElementById('admin-login').onclick=async()=>{await apiFetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.getElementById('admin-username').value.trim(),password:document.getElementById('admin-password').value.trim()})});await refresh();await load();};
document.getElementById('admin-logout').onclick=async()=>{await apiFetch('/api/auth/logout',{method:'POST'});await refresh();await load();};
document.getElementById('add-form').onsubmit=async(e)=>{e.preventDefault();const fd=new FormData(e.target);await apiFetch('/api/webtoons',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:fd.get('title'),genre:fd.get('genre'),tier:fd.get('tier'),score:Number(fd.get('score')),recommendation:fd.get('recommendation'),imageUrl:fd.get('imageUrl'),note:fd.get('note'),reviewReason:fd.get('reviewReason')})});e.target.reset();await load();};
await refresh();await load();}
boot().catch(e=>setStatus(e.message));
