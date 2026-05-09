const tiers=['S','A','B','C','D'];let isAdmin=false;let data=[];let sortMode='latest';const ADMIN='쪼코우유먹을래';
const $=(s)=>document.querySelector(s);const voteKey=(id)=>`vote:${id}`;const clikeKey=(id,c)=>`clike:${id}:${c}`;
const api=async(u,o={})=>{const r=await fetch(u,{...o,credentials:'include'});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'err');return r.status===204?null:r.json()};
const BAD_WORDS=['씨발','시발','병신','fuck','fucking','shit','bitch','섹스'];
const normalizeText=(t='')=>String(t).toLowerCase().replace(/[^a-z0-9가-힣\s]/g,' ').replace(/\s+/g,' ').trim();
// 정상 문장 오탐을 줄이기 위해 공백 단위 토큰/문장 경계 중심으로 검사
const containsProfanity=(t='')=>{const n=normalizeText(t); if(!n) return false; const tokens=n.split(' '); return BAD_WORDS.some(w=> tokens.includes(normalizeText(w)) || n.match(new RegExp(`(^|\s)${normalizeText(w)}($|\s)`)));};
const fmt=(d)=>{if(!d)return'시간 정보 없음';const x=new Date(d),p=n=>String(n).padStart(2,'0');return `${p(x.getMonth()+1)}/${p(x.getDate())} ${p(x.getHours())}:${p(x.getMinutes())}`};
let searchQuery=''; let selectedGenre='ALL'; let genreVisible=false;
const collapsedKey='tier-collapsed';
const getCollapsed=()=>JSON.parse(localStorage.getItem(collapsedKey)||'{}');
const setCollapsed=(m)=>localStorage.setItem(collapsedKey,JSON.stringify(m));
async function load(){data=await api('/api/webtoons');}
function route(){const id=location.hash.split('/')[2];if(id)detail(id);else list();}
function list(){ $('#hero').classList.remove('hidden'); $('#list-view').classList.remove('hidden'); $('#detail-view').classList.add('hidden');
  const root=$('#tiers');
  if(!$('#search-panel')){
    const panel=document.createElement('section'); panel.className='tier'; panel.id='search-panel';
    panel.innerHTML=`<div class='search-row'><input id='search-input' placeholder='작품 제목 검색'/><button id='search-btn'>검색</button><button id='search-reset' class='ghost'>초기화</button></div><div id='genre-wrap' class='hidden'><select id='genre-select'></select></div><p id='search-empty' class='empty hidden'>검색 결과가 없습니다.</p>`;
    root.parentNode.insertBefore(panel, root);
  }
  $('#search-input').value=searchQuery;
  const runSearch=()=>{searchQuery=($('#search-input').value||'').trim().toLowerCase(); genreVisible=true; renderGenres(); list();};
  $('#search-btn').onclick=runSearch; $('#search-input').onkeydown=(e)=>{if(e.key==='Enter') runSearch();};
  $('#search-reset').onclick=()=>{searchQuery=''; selectedGenre='ALL'; genreVisible=false; list();};

  const normalized=data.map(w=>({...w,_genre:(w.genre||'기타').trim()||'기타'}));
  const filtered=normalized.filter(w=>{
    const byQ=!searchQuery || String(w.title||'').toLowerCase().includes(searchQuery);
    const byG=selectedGenre==='ALL' || w._genre===selectedGenre;
    return byQ && byG;
  });
  function renderGenres(){
    const wrap=$('#genre-wrap'); wrap.classList.toggle('hidden',!genreVisible);
    const genres=[...new Set(normalized.map(w=>w._genre))].sort();
    const sel=$('#genre-select');
    sel.innerHTML=`<option value='ALL'>전체 장르</option>`+genres.map(g=>`<option ${selectedGenre===g?'selected':''}>${g}</option>`).join('');
    sel.onchange=(e)=>{selectedGenre=e.target.value; list();};
  }
  renderGenres();

  root.innerHTML=''; const collapsed=getCollapsed(); let totalShown=0;
  tiers.forEach(t=>{const tierItems=filtered.filter(w=>w.tier===t).sort((a,b)=>{const sa=Number(a?.score),sb=Number(b?.score);const va=Number.isFinite(sa),vb=Number.isFinite(sb);if(va&&vb)return sb-sa;if(va)return -1;if(vb)return 1;return 0;}); totalShown += tierItems.length;
    const sec=document.createElement('section');sec.className='tier';sec.innerHTML=`<h3 class='tier-title' data-tier='${t}'>${t} Tier · ${tierItems.length}개 <span class='chev'>${collapsed[t]?'▸':'▾'}</span></h3><div class='grid ${collapsed[t]?'collapsed':''}'></div>`;
    const g=sec.querySelector('.grid'); tierItems.forEach(w=>{const c=document.createElement('article');c.className='card';c.innerHTML=`<div class='cover'>${w.imageUrl?`<img src='${w.imageUrl}' loading='lazy'/>`:'📖'}</div><h4>${w.title}</h4><p>${Number.isFinite(Number(w.score))?Number(w.score).toFixed(1):'-'} / 10</p><small>좋아요 ${w.likeCount||0} / 싫어요 ${w.dislikeCount||0}</small>`; c.onclick=()=>location.hash=`#/work/${w.id}`; g.appendChild(c);});
    sec.querySelector('.tier-title').onclick=()=>{const m=getCollapsed(); m[t]=!m[t]; setCollapsed(m); list();};
    root.appendChild(sec);
  });
  $('#search-empty').classList.toggle('hidden', totalShown!==0);
}

function commentNode(work,c){const adminClass=c.isAdmin?'admin-name':'';const badge=c.isAdmin?`<span class='admin-badge'>ADMIN</span>`:'';const replies=(c.replies||[]).map(r=>`<div class='reply'><b class='${r.isAdmin?'admin-name':''}'>${r.nickname}</b>${r.isAdmin?`<span class='admin-badge'>ADMIN</span>`:''}<span class='time'>${fmt(r.createdAt)}</span><p>${r.content}</p>${isAdmin?`<button data-rdel='${c.id}:${r.id}' class='ghost'>삭제</button>`:''}</div>`).join('');
return `<article class='comment'><div><b class='${adminClass}'>${c.nickname}</b>${badge}<span class='time'>${fmt(c.createdAt)}</span><p>${c.content}</p>${replies}<form class='reply-form' data-reply='${c.id}'><input name='nickname' placeholder='닉네임' ${isAdmin?'hidden':''}/><input name='content' placeholder='답글' required/><button>Reply</button></form></div><div><button data-clike='${c.id}' class='ghost'>👍 ${c.likeCount||0}</button>${isAdmin?`<button data-cdel='${c.id}' class='ghost'>삭제</button>`:''}</div></article>`}
function detail(id){const w=data.find(x=>x.id===id); if(!w){location.hash='';return;} const detailImage = w.coverImage || w.imageUrl || w.thumbnail || ''; $('#hero').classList.add('hidden'); $('#list-view').classList.add('hidden'); const d=$('#detail-view'); d.classList.remove('hidden'); const userVote=localStorage.getItem(voteKey(id)); const comments=[...(w.comments||[])]; comments.sort(sortMode==='likes'?(a,b)=>(b.likeCount||0)-(a.likeCount||0):(a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
d.innerHTML=`<button id='back' class='ghost'>← 뒤로</button><div class='cover'>${detailImage?`<img src='${detailImage}' loading='lazy' onerror="this.remove();this.parentNode.textContent='📖'"/>`:'📖'}</div><h2>${w.title}</h2><p>${w.genre} · ${w.tier} · ${Number(w.score||0).toFixed(1)}/10</p><div class='vote-row'><button id='like' class='${userVote==='like'?'active':''}'>좋아요</button><button id='dislike' class='${userVote==='dislike'?'active':''}'>싫어요</button><span>좋아요 ${w.likeCount||0} / 싫어요 ${w.dislikeCount||0}</span>${isAdmin?`<input id='score-edit' type='number' min='0' max='10' step='0.1' value='${Number(w.score||0)}' style='width:88px'/><button id='save-score' class='ghost'>평점수정</button><button id='delete-work' class='ghost'>작품삭제</button>`:''}</div><p>${w.reviewReason||''}</p><label>정렬 <select id='sort'><option value='latest'>최신순</option><option value='likes'>추천순</option></select></label><div>${comments.length?comments.map(c=>commentNode(w,c)).join(''):`<p class='empty'>아직 토론이 없어요. 첫 의견을 남겨보세요.</p>`}</div><form id='cform'><input name='nickname' placeholder='닉네임' ${isAdmin?'hidden':''}/><input name='content' placeholder='댓글' required/><button>등록</button></form>`;
$('#sort').value=sortMode; $('#sort').onchange=e=>{sortMode=e.target.value;detail(id)}; $('#back').onclick=()=>location.hash='';
$('#like').onclick=()=>toggleVote(id,'like'); $('#dislike').onclick=()=>toggleVote(id,'dislike');
if(isAdmin&&$('#save-score')) $('#save-score').onclick=async()=>{const v=Number($('#score-edit').value); if(!Number.isFinite(v)||v<0||v>10){alert('0~10 사이 점수를 입력해주세요.');return;} await api(`/api/webtoons/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({score:v})}); await load(); detail(id);};
if(isAdmin&&$('#delete-work')) $('#delete-work').onclick=async()=>{if(!confirm('작품 삭제?'))return;await api(`/api/webtoons/${id}`,{method:'DELETE'});await load();location.hash='';};
$('#cform').onsubmit=async(e)=>{e.preventDefault();const fd=new FormData(e.target);const nn=isAdmin?ADMIN:fd.get('nickname');const cc=fd.get('content');if(containsProfanity(nn)||containsProfanity(cc)){alert('부적절한 표현이 포함되어 있어 등록할 수 없습니다.');return;}await api(`/api/webtoons/${id}/comments`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:nn,content:cc})});await load();detail(id);};
d.querySelectorAll('[data-cdel]').forEach(b=>b.onclick=async()=>{if(!confirm('댓글 삭제?'))return;await api(`/api/webtoons/${id}/comments/${b.dataset.cdel}`,{method:'DELETE'});await load();detail(id);});
d.querySelectorAll('[data-clike]').forEach(b=>b.onclick=async()=>{const key=clikeKey(id,b.dataset.clike);const liked=localStorage.getItem(key)==='1';await api(`/api/webtoons/${id}/comments/${b.dataset.clike}/like`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({liked})}); if(liked)localStorage.removeItem(key); else localStorage.setItem(key,'1'); await load();detail(id);});
d.querySelectorAll('[data-reply]').forEach(f=>f.onsubmit=async(e)=>{e.preventDefault();const fd=new FormData(f);const nn=isAdmin?ADMIN:fd.get('nickname');const cc=fd.get('content');if(containsProfanity(nn)||containsProfanity(cc)){alert('부적절한 표현이 포함되어 있어 등록할 수 없습니다.');return;}await api(`/api/webtoons/${id}/comments/${f.dataset.reply}/replies`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:nn,content:cc})});await load();detail(id);});
d.querySelectorAll('[data-rdel]').forEach(b=>b.onclick=async()=>{if(!confirm('대댓글 삭제?'))return;const [cid,rid]=b.dataset.rdel.split(':');await api(`/api/webtoons/${id}/comments/${cid}/replies/${rid}`,{method:'DELETE'});await load();detail(id);});
}
async function toggleVote(id,next){const prev=localStorage.getItem(voteKey(id)); const vote=prev===next?null:next; await api(`/api/webtoons/${id}/vote`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prevVote:prev,vote})}); if(vote)localStorage.setItem(voteKey(id),vote); else localStorage.removeItem(voteKey(id)); await load();detail(id);} 
async function refresh(){const me=await api('/api/auth/me');isAdmin=me.isAdmin;$('#add-section').classList.toggle('hidden',!isAdmin);$('#admin-status').textContent=isAdmin?'관리자 모드':'일반 모드'; if(!isAdmin && $('#add-form')) $('#add-form').classList.add('hidden');}
async function boot(){const drawer=$('#admin-drawer'),btn=$('#menu-btn');btn.onclick=(e)=>{e.stopPropagation();drawer.classList.toggle('hidden')};document.addEventListener('click',(e)=>{if(!drawer.classList.contains('hidden')&&!drawer.contains(e.target)&&e.target!==btn)drawer.classList.add('hidden')});document.addEventListener('keydown',(e)=>{if(e.key==='Escape')drawer.classList.add('hidden')});drawer.addEventListener('click',(e)=>e.stopPropagation());

const toggleBtn=$('#toggle-add-form'); if(toggleBtn){toggleBtn.onclick=()=>$('#add-form').classList.toggle('hidden');}
const addForm=$('#add-form'); if(addForm){addForm.onsubmit=async(e)=>{e.preventDefault();const fd=new FormData(addForm);await api('/api/webtoons',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:fd.get('title'),genre:fd.get('genre'),tier:fd.get('tier'),score:Number(fd.get('score')),imageUrl:fd.get('imageUrl'),note:fd.get('note'),reviewReason:fd.get('reviewReason')})});addForm.reset();addForm.classList.add('hidden');await load();list();};}

$('#admin-login').onclick=async()=>{await api('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('#admin-username').value,password:$('#admin-password').value})});await refresh();};$('#admin-logout').onclick=async()=>{await api('/api/auth/logout',{method:'POST'});await refresh();};window.addEventListener('hashchange',route);await refresh();await load();route();}
boot();
