const tiers=['S','A','B','C','D']; let isAdmin=false; let data=[]; let sortMode='latest';
const $=(s)=>document.querySelector(s); const api=async(u,o={})=>{const r=await fetch(u,{...o,credentials:'include'});if(!r.ok) throw new Error((await r.json().catch(()=>({}))).error||'요청실패');return r.status===204?null:r.json()};
const fmtScore=(n)=>`${Number(n||0).toFixed(1)} / 10`; const fmtTime=(iso)=>{if(!iso) return '시간 정보 없음';const d=new Date(iso);const p=(n)=>String(n).padStart(2,'0');return `${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`};
const voteKey=(id)=>`vote:${id}`;
function badge(l,d){return `<span class='muted'>좋아요 ${l||0} / 싫어요 ${d||0}</span>`}

function route(){const id=location.hash.startsWith('#/work/')?location.hash.split('/')[2]:null; if(id) renderDetail(id); else renderList();}
async function load(){data=await api('/api/webtoons');}

function renderList(){ $('#detail-view').classList.add('hidden'); $('#list-view').classList.remove('hidden'); const root=$('#tiers'); root.innerHTML='';
for(const t of tiers){const sec=document.createElement('section');sec.className=`tier tier-${t}`;sec.innerHTML=`<h3>${t} Tier</h3><div class='grid'></div>`;const g=sec.querySelector('.grid');data.filter(x=>x.tier===t).sort((a,b)=>b.score-a.score).forEach(w=>{const c=document.createElement('article');c.className='card';c.innerHTML=`<div class='cover'>${w.imageUrl?`<img src='${w.imageUrl}'/>`:'📖'}</div><h4>${w.title}</h4><p>${fmtScore(w.score)}</p>${badge(w.likeCount,w.dislikeCount)}`;c.onclick=()=>location.hash=`#/work/${w.id}`;g.appendChild(c);});root.appendChild(sec);} }

function sortedComments(comments){const arr=[...(comments||[])]; if(sortMode==='likes') return arr.sort((a,b)=>(b.likeCount||0)-(a.likeCount||0)); return arr.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));}
function renderDetail(id){const w=data.find(x=>x.id===id); if(!w){location.hash='';return;} $('#list-view').classList.add('hidden'); const v=$('#detail-view'); v.classList.remove('hidden');
const userVote=localStorage.getItem(voteKey(id));
v.innerHTML=`<button class='ghost' id='back-btn'>← 목록으로</button><section class='detail-hero'><div class='detail-cover'>${w.imageUrl?`<img src='${w.imageUrl}'/>`:'📖'}</div><div><h2>${w.title}</h2><p>${w.genre} · ${w.tier} Tier · ${fmtScore(w.score)}</p><p>${w.note||''}</p><p>${w.reviewReason||''}</p><div class='vote-row'><button id='like-btn' class='${userVote==='like'?'active':''}'>좋아요</button><button id='dislike-btn' class='${userVote==='dislike'?'active':''}'>싫어요</button>${badge(w.likeCount,w.dislikeCount)}</div></div></section>
<section class='community'><h3>이 작품에 대해 이야기해보세요</h3><label>정렬 <select id='sort-select'><option value='latest'>최신순</option><option value='likes'>추천순</option></select></label><div id='comments'>${commentHtml(w,id)}</div><form id='comment-form'><input name='nickname' placeholder='닉네임'/><input name='content' placeholder='의견을 남겨주세요' required/><button>댓글 등록</button></form></section>`;
$('#sort-select').value=sortMode; $('#sort-select').onchange=(e)=>{sortMode=e.target.value; renderDetail(id)};
$('#back-btn').onclick=()=>location.hash='';
$('#comment-form').onsubmit=async(e)=>{e.preventDefault();const fd=new FormData(e.target);await api(`/api/webtoons/${id}/comments`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:fd.get('nickname'),content:fd.get('content')})});await load();renderDetail(id);};
$('#like-btn').onclick=()=>vote(id,'like'); $('#dislike-btn').onclick=()=>vote(id,'dislike');
v.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('댓글을 삭제할까요?'))return;await api(`/api/webtoons/${id}/comments/${b.dataset.del}`,{method:'DELETE'});await load();renderDetail(id);});
v.querySelectorAll('[data-clike]').forEach(b=>b.onclick=async()=>{await api(`/api/webtoons/${id}/comments/${b.dataset.clike}/like`,{method:'POST'});await load();renderDetail(id);});
}
function commentHtml(w,id){const comments=sortedComments(w.comments); if(!comments.length)return `<p class='empty'>아직 토론이 없어요. 첫 의견을 남겨보세요.</p>`; return comments.map(c=>`<article class='comment'><div><b>${c.nickname}</b> <span class='time'>${fmtTime(c.createdAt)}</span><p>${c.content||''}</p></div><div class='c-actions'><button data-clike='${c.id}' class='ghost'>👍 ${c.likeCount||0}</button>${isAdmin?`<button data-del='${c.id}' class='ghost'>삭제</button>`:''}</div></article>`).join('');}
async function vote(id,type){const prev=localStorage.getItem(voteKey(id)); if(prev===type){localStorage.removeItem(voteKey(id));return renderDetail(id);} localStorage.setItem(voteKey(id),type); await api(`/api/webtoons/${id}/vote`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type})}); await load(); renderDetail(id);}

async function boot(){ $('#menu-btn').onclick=()=>$('#admin-drawer').classList.toggle('hidden'); $('#admin-login').onclick=async()=>{await api('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('#admin-username').value,password:$('#admin-password').value})});await refresh();}; $('#admin-logout').onclick=async()=>{await api('/api/auth/logout',{method:'POST'});await refresh();};
$('#add-form').onsubmit=async(e)=>{e.preventDefault();const fd=new FormData(e.target);await api('/api/webtoons',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(fd.entries()))});await load();route();};
window.addEventListener('hashchange',route); await refresh(); await load(); route();}
async function refresh(){const me=await api('/api/auth/me'); isAdmin=me.isAdmin; $('#add-section').classList.toggle('hidden',!isAdmin); $('#admin-status').textContent=isAdmin?'관리자 모드':'일반 모드';}
boot();
