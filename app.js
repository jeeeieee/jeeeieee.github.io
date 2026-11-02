/* 이지영 포트폴리오 — 글과 캠페인은 data/ 폴더의 JSON에서 불러온다. 내용 수정은 /admin 의 글 관리 화면에서. */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dot = d => String(d || '').slice(0, 10).replace(/-/g, '.');

/* 본문(마크다운)을 안전한 HTML로 */
function md(text) {
  const t = String(text || '').trim();
  if (window.marked && window.DOMPurify) {
    return DOMPurify.sanitize(marked.parse(t, { breaks: true }));
  }
  return t.split(/\n\s*\n/).filter(Boolean).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
}

async function load(path, key) {
  try {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    return Array.isArray(j[key]) ? j[key] : [];
  } catch (e) {
    return null;
  }
}

/* ---------- 캠페인 파일 ---------- */
const B = [['problem', 'BRIEF 과제'], ['insight', 'INSIGHT 인사이트'], ['idea', 'IDEA 실행'], ['result', 'RESULT 성과']];
function renderCases(cases) {
  const box = $('#cases');
  if (cases === null) { box.innerHTML = '<p class="empty">캠페인을 불러오지 못했어요. 잠시 후 새로고침해 주세요.</p>'; return; }
  if (!cases.length) { box.innerHTML = '<p class="empty">아직 등록한 캠페인이 없어요.</p>'; return; }
  box.innerHTML = cases.map((c, i) => `<details class="case" ${i === 0 ? 'open' : ''}>
  <summary>
    <span class="no"><b>FILE ${String(i + 1).padStart(2, '0')}</b>${esc(c.year)}</span>
    <div><h3>${esc(c.title)}</h3><p class="client">${esc(c.client)}</p><span class="more">브리프 보기</span></div>
    <span class="kpi"><b>${esc(c.kpi)}</b><span>${esc(c.kpi_label)}</span></span>
  </summary>
  <dl class="brief">${B.filter(([k]) => c[k]).map(([k, l]) => `<div><dt>${l}</dt><dd>${esc(c[k])}</dd></div>`).join('')}</dl>
  ${(c.tags || []).length ? `<div class="tags">${c.tags.map(t => `<span>#${esc(t)}</span>`).join('')}</div>` : ''}
</details>`).join('');
}

/* ---------- 마케팅 노트 ---------- */
let NOTES = [], filterTag = 'all';
function renderNotes() {
  const all = [...NOTES].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const lead = all.find(n => n.featured) || all[0];
  const rest = all.filter(n => n !== lead);
  const match = n => filterTag === 'all' || n.tag === filterTag;
  const leadEl = $('#lead');
  if (lead) {
    leadEl.hidden = !match(lead);
    leadEl.innerHTML = `<span class="label">${lead.featured ? '대표 글' : '최신 글'} · ${dot(lead.date)} · ${esc(lead.tag)}</span><button class="edit-btn" type="button" data-edit="${NOTES.indexOf(lead)}">수정</button><h3>${esc(lead.title)}</h3><div class="body">${md(lead.body)}</div>`;
  } else {
    leadEl.hidden = false;
    leadEl.innerHTML = '<p class="empty">아직 쓴 글이 없어요.</p>';
  }
  const shown = rest.filter(match);
  $('#list').innerHTML = shown.length
    ? shown.map(n => `<li><details><summary><span class="label">${dot(n.date)} · ${esc(n.tag)}</span><strong>${esc(n.title)}</strong></summary><div class="body">${md(n.body)}</div></details><button class="edit-btn" type="button" data-edit="${NOTES.indexOf(n)}">수정</button></li>`).join('')
    : (rest.length ? '<li class="empty">이 주제의 글이 아직 없어요.</li>' : '');
  const tags = [...new Set(all.map(n => n.tag).filter(Boolean))];
  if (filterTag !== 'all' && !tags.includes(filterTag)) filterTag = 'all';
  $('#filter').innerHTML = ['all', ...tags].map(t => `<button type="button" data-f="${esc(t)}" aria-pressed="${t === filterTag}">${t === 'all' ? '전체' : esc(t)}</button>`).join('');
  $('#tag-list').innerHTML = tags.map(t => `<option value="${esc(t)}"></option>`).join('');
}
$('#filter').addEventListener('click', e => {
  const b = e.target.closest('[data-f]');
  if (!b) return;
  filterTag = b.dataset.f;
  renderNotes();
});

/* ---------- 페이지 전환 (메인 / 노트 / 소개) ---------- */
const PAGES = { about: [$('#about-page'), $('#contact-page')], notes: [$('#notes-page')] }, home = $('#home');
function go(t, push = true) {
  if (t === 'contact') t = 'about';
  const page = PAGES[t];
  home.hidden = !!page;
  Object.entries(PAGES).forEach(([k, els]) => els.forEach(el => { el.hidden = k !== t; }));
  document.querySelectorAll('.mast nav a').forEach(a => {
    if (page && a.dataset.go === t) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (push) history.replaceState(null, '', t === 'top' ? location.pathname : '#' + t);
  if (page || t === 'top') { window.scrollTo(0, 0); return; }
  const el = document.getElementById(t);
  if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-go]');
  if (!a) return;
  e.preventDefault();
  go(a.dataset.go);
});
const h = location.hash.slice(1);
if (h) go(h, false);

/* ---------- 이메일 복사 ---------- */
const btn = $('#copy');
btn.addEventListener('click', () => {
  const done = () => { btn.textContent = '복사됨'; setTimeout(() => { btn.textContent = '주소 복사'; }, 1600); };
  const fb = () => { const r = document.createRange(); r.selectNodeContents($('#mail')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
  try { navigator.clipboard.writeText($('#mail').textContent).then(done, fb); } catch (e) { fb(); }
});

/* ---------- 바로 편집 ----------
   글 관리 화면(/admin)에 로그인한 브라우저에는 그 로그인 정보가 남아 있다.
   그 정보가 있으면 이 사이트에서도 바로 글을 쓰고 고칠 수 있게 버튼을 보여주고,
   GitHub에 직접 저장한다. 방문자 브라우저에는 로그인 정보가 없으므로 아무것도 보이지 않는다. */
const REPO = 'jeeeieee/jeeeieee.github.io', BRANCH = 'main', NOTES_PATH = 'data/notes.json';
const API = `https://api.github.com/repos/${REPO}/contents/${NOTES_PATH}`;

function ownerToken() {
  try {
    const u = JSON.parse(localStorage.getItem('sveltia-cms.user') || 'null');
    const t = u && u.token;
    return typeof t === 'string' && /^[\x21-\x7e]+$/.test(t) ? t : null;
  } catch (e) { return null; }
}
const TOKEN = ownerToken();

class SaveError extends Error { constructor(code) { super(code); this.code = code; } }
const b64decode = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));
function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
async function gh(method, body) {
  let r;
  try {
    r = await fetch(method === 'GET' ? `${API}?ref=${BRANCH}` : API, {
      method,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) { throw new SaveError('network'); }
  if (r.status === 401) throw new SaveError('expired');
  if (r.status === 403 || r.status === 404) throw new SaveError('forbidden');
  if (r.status === 409 || r.status === 422) throw new SaveError('conflict');
  if (!r.ok) throw new SaveError('other');
  return r.json();
}
/* 저장소의 최신 글 파일을 읽는다: { data: {notes:[...]}, sha } */
async function readLatest() {
  const f = await gh('GET');
  const data = JSON.parse(b64decode(f.content || ''));
  if (!Array.isArray(data.notes)) data.notes = [];
  return { data, sha: f.sha };
}

const dlg = $('#edit-dlg');
let editing = null; /* 고치는 중인 글의 원래 모습 (새 글이면 null) */
let armed = false, flashTimer = 0;
const BAR_TEXT = $('#editbar-text').textContent;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const sameNote = (a, b) => a && b && a.title === b.title && String(a.date || '') === String(b.date || '');

function flash(m) {
  const el = $('#editbar-text');
  el.textContent = '✓ ' + m;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { el.textContent = BAR_TEXT; }, 5000);
}
function err(html, el) { $('#edit-msg').innerHTML = html; if (el) el.focus(); }
function busy(b) { $('#save-btn').disabled = b; $('#del-btn').disabled = b; $('#save-btn').textContent = b ? '저장 중…' : '저장하기'; }
function disarm() { armed = false; const b = $('#del-btn'); b.classList.remove('armed'); b.textContent = '삭제'; }

function openEditor(i) {
  const n = i == null ? null : NOTES[i];
  editing = n ? { ...n } : null;
  $('#edit-title').textContent = n ? '글 수정하기' : '새 글 쓰기';
  $('#f-title').value = n ? n.title || '' : '';
  $('#f-date').value = n ? String(n.date || '').slice(0, 10) : today();
  $('#f-tag').value = n ? n.tag || '' : '';
  $('#f-body').value = n ? n.body || '' : '';
  $('#f-featured').checked = !!(n && n.featured);
  $('#del-btn').hidden = !n;
  disarm(); err(''); busy(false);
  dlg.showModal();
  $('#f-title').focus();
}

const SAVE_ERRORS = {
  expired: '로그인이 만료됐어요. <a href="admin/">글 관리 화면</a>에서 다시 로그인한 뒤 이 페이지를 새로고침해 주세요.',
  forbidden: '이 계정으로는 저장할 수 없어요. 토큰에 이 저장소의 Contents 쓰기 권한이 있는지 확인해 주세요.',
  conflict: '그사이 다른 곳에서 글이 바뀌었어요. 최신 내용을 다시 불러왔으니 확인하고 한 번 더 저장해 주세요.',
  missing: '고치려던 글을 찾을 수 없어요. 다른 곳에서 지웠거나 제목이 바뀌었을 수 있어요. 최신 내용을 다시 불러왔어요.',
  network: '인터넷 연결을 확인하고 다시 저장해 주세요.',
  other: '저장하지 못했어요. 잠시 후 다시 저장해 주세요.',
};

/* change(list) 가 최신 글 목록을 고친다. 고친 목록을 GitHub에 저장하고 화면도 바로 바꾼다. */
async function commit(change, message, doneMsg) {
  busy(true); err('');
  try {
    const { data, sha } = await readLatest();
    change(data.notes);
    await gh('PUT', { message, branch: BRANCH, sha, content: b64encode(JSON.stringify(data, null, 2) + '\n') });
    NOTES = data.notes;
    renderNotes();
    dlg.close();
    flash(doneMsg + ' 방문자 화면에는 1~2분 뒤 반영돼요.');
  } catch (e) {
    busy(false);
    const code = e instanceof SaveError ? e.code : 'other';
    err(SAVE_ERRORS[code] || SAVE_ERRORS.other);
    if (code === 'conflict' || code === 'missing') { try { NOTES = (await readLatest()).data.notes; renderNotes(); } catch (_) {} }
  }
}

$('#edit-form').addEventListener('submit', e => {
  e.preventDefault();
  const title = $('#f-title').value.trim();
  const date = $('#f-date').value;
  const tag = $('#f-tag').value.trim();
  const body = $('#f-body').value.replace(/\r/g, '').trim();
  const featured = $('#f-featured').checked;
  if (!title) return err('제목을 입력해 주세요.', $('#f-title'));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err('날짜를 골라 주세요.', $('#f-date'));
  if (!body) return err('본문을 입력해 주세요.', $('#f-body'));
  const orig = editing;
  commit(list => {
    if (featured) list.forEach(n => { n.featured = false; });
    if (orig) {
      const i = list.findIndex(n => sameNote(n, orig));
      if (i < 0) throw new SaveError('missing');
      list[i] = { ...list[i], title, date, tag, featured, body };
    } else {
      list.unshift({ title, date, tag, featured, body });
    }
  }, `마케팅 노트 ${orig ? '수정' : '추가'}: ${title}`, orig ? '수정한 글을 저장했어요.' : '새 글을 올렸어요.');
});
$('#del-btn').addEventListener('click', () => {
  const b = $('#del-btn');
  if (!armed) { armed = true; b.classList.add('armed'); b.textContent = '한 번 더 누르면 삭제돼요'; return; }
  const orig = editing;
  commit(list => {
    const i = list.findIndex(n => sameNote(n, orig));
    if (i < 0) throw new SaveError('missing');
    list.splice(i, 1);
  }, `마케팅 노트 삭제: ${orig.title}`, '글을 삭제했어요.');
});
$('#cancel-btn').addEventListener('click', () => dlg.close());
$('#edit-form').addEventListener('input', () => err(''));
$('#new-note').addEventListener('click', () => openEditor(null));
$('#nav-write').addEventListener('click', e => { e.preventDefault(); go('notes'); openEditor(null); });
document.addEventListener('click', e => {
  const b = e.target.closest('[data-edit]');
  if (b && TOKEN) openEditor(Number(b.dataset.edit));
});

/* ---------- 데이터 불러오기 ---------- */
(async () => {
  const casesP = load('data/cases.json', 'cases');
  let notes = null;
  if (TOKEN) {
    /* 로그인한 브라우저: 방금 저장한 글도 보이도록 저장소에서 최신 글을 바로 읽는다 */
    try { notes = (await readLatest()).data.notes; document.body.classList.add('owner'); } catch (e) { notes = null; }
  }
  if (notes === null) notes = await load('data/notes.json', 'notes');
  renderCases(await casesP);
  if (notes === null) {
    $('#lead').innerHTML = '<p class="empty">글을 불러오지 못했어요. 잠시 후 새로고침해 주세요.</p>';
    return;
  }
  NOTES = notes;
  renderNotes();
})();
