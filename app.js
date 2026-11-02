/* 이지영 포트폴리오
   - 노트, 캠페인, 소개는 data/ 폴더의 JSON에서 불러온다.
   - 글 관리 화면(/admin)에 로그인한 브라우저에서는 사이트 안에서 바로 고칠 수 있다.
     방문자 브라우저에는 로그인 정보가 없으므로 편집 버튼이 보이지 않는다. */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dot = d => String(d || '').slice(0, 10).replace(/-/g, '.');
const paras = t => String(t || '').trim().split(/\n\s*\n/).filter(Boolean).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

/* 본문(마크다운)을 안전한 HTML로 */
function md(text) {
  const t = String(text || '').trim();
  if (window.marked && window.DOMPurify) return DOMPurify.sanitize(marked.parse(t, { breaks: true }));
  return paras(t);
}

/* ================= 데이터 ================= */
const REPO = 'jeeeieee/jeeeieee.github.io', BRANCH = 'main';
const FILES = { notes: 'data/notes.json', cases: 'data/cases.json', about: 'data/about.json' };
let NOTES = [], CASES = [], ABOUT = null;

async function loadStatic(path) {
  try {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

/* ---------- 로그인 정보 (글 관리 화면이 이 브라우저에 남긴 토큰) ---------- */
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
function bytesToB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const textToB64 = str => bytesToB64(new TextEncoder().encode(str));

async function gh(method, path, body) {
  const url = `https://api.github.com/repos/${REPO}/contents/${path}` + (method === 'GET' ? `?ref=${BRANCH}` : '');
  let r;
  try {
    r = await fetch(url, {
      method,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) { throw new SaveError('network'); }
  if (method === 'GET' && r.status === 404) return null; /* 아직 없는 파일 */
  if (r.status === 401) throw new SaveError('expired');
  if (r.status === 403 || r.status === 404) throw new SaveError('forbidden');
  if (r.status === 409 || r.status === 422) throw new SaveError('conflict');
  if (r.status === 413) throw new SaveError('too_large');
  if (!r.ok) throw new SaveError('other');
  return r.json();
}
/* 저장소의 최신 파일: { data, sha } (파일이 없으면 data=null, sha=null) */
async function readLatest(path) {
  const f = await gh('GET', path);
  if (!f) return { data: null, sha: null };
  return { data: JSON.parse(b64decode(f.content || '')), sha: f.sha };
}
async function writeFile(path, data, sha, message) {
  return gh('PUT', path, { message, branch: BRANCH, content: textToB64(JSON.stringify(data, null, 2) + '\n'), ...(sha ? { sha } : {}) });
}

/* ================= 화면 그리기 ================= */
/* ---------- 캠페인 파일 ---------- */
const B = [['problem', 'BRIEF 과제'], ['insight', 'INSIGHT 인사이트'], ['idea', 'IDEA 실행'], ['result', 'RESULT 성과']];
function renderCases(failed) {
  const box = $('#cases');
  if (failed) { box.innerHTML = '<p class="empty">캠페인을 불러오지 못했어요. 잠시 후 새로고침해 주세요.</p>'; return; }
  if (!CASES.length) { box.innerHTML = '<p class="empty">아직 등록한 캠페인이 없어요.</p>'; return; }
  const last = CASES.length - 1;
  box.innerHTML = CASES.map((c, i) => `<div class="case-wrap"><details class="case" ${i === 0 ? 'open' : ''}>
  <summary>
    <span class="no"><b>FILE ${String(i + 1).padStart(2, '0')}</b>${esc(c.year)}</span>
    <div><h3>${esc(c.title)}</h3><p class="client">${esc(c.client)}</p><span class="more">브리프 보기</span></div>
    <span class="kpi"><b>${esc(c.kpi)}</b><span>${esc(c.kpi_label)}</span></span>
  </summary>
  <dl class="brief">${B.filter(([k]) => c[k]).map(([k, l]) => `<div><dt>${l}</dt><dd>${esc(c[k])}</dd></div>`).join('')}</dl>
  ${(c.tags || []).length ? `<div class="tags">${c.tags.map(t => `<span>#${esc(t)}</span>`).join('')}</div>` : ''}
</details><div class="case-tools"><button type="button" data-case-move="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="위로 올리기">↑ 위로</button><button type="button" data-case-move="${i}" data-dir="1" ${i === last ? 'disabled' : ''} aria-label="아래로 내리기">↓ 아래로</button><button type="button" data-case-edit="${i}">수정</button></div></div>`).join('');
}

/* ---------- 마케팅 노트 ---------- */
let filterTag = 'all';
function renderNotes(failed) {
  if (failed) { $('#lead').innerHTML = '<p class="empty">글을 불러오지 못했어요. 잠시 후 새로고침해 주세요.</p>'; return; }
  const all = [...NOTES].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const lead = all.find(n => n.featured) || all[0];
  const rest = all.filter(n => n !== lead);
  const match = n => filterTag === 'all' || n.tag === filterTag;
  const leadEl = $('#lead');
  if (lead) {
    leadEl.hidden = !match(lead);
    leadEl.innerHTML = `<span class="label">${lead.featured ? '대표 글' : '최신 글'} · ${dot(lead.date)} · ${esc(lead.tag)}</span><button class="edit-btn" type="button" data-note-edit="${NOTES.indexOf(lead)}">수정</button><h3>${esc(lead.title)}</h3><div class="body">${md(lead.body)}</div>`;
  } else {
    leadEl.hidden = false;
    leadEl.innerHTML = '<p class="empty">아직 쓴 글이 없어요.</p>';
  }
  const shown = rest.filter(match);
  $('#list').innerHTML = shown.length
    ? shown.map(n => `<li><details><summary><span class="label">${dot(n.date)} · ${esc(n.tag)}</span><strong>${esc(n.title)}</strong></summary><div class="body">${md(n.body)}</div></details><button class="edit-btn" type="button" data-note-edit="${NOTES.indexOf(n)}">수정</button></li>`).join('')
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

/* ---------- 소개 · 연락처 ---------- */
function renderAbout() {
  const a = ABOUT;
  if (!a) return; /* 파일이 없으면 페이지에 적힌 기본 내용을 그대로 둔다 */
  $('#about-photo').innerHTML = a.photo
    ? `<img src="${esc(a.photo)}" alt="${esc(a.name || '')} 프로필 사진">`
    : '<div>프로필 사진<br>자리</div>';
  $('#about-intro').innerHTML = `<p><strong>${esc(a.name)}</strong>${a.role ? ` · ${esc(a.role)}` : ''}</p>${paras(a.intro)}`;
  $('#about-cv').innerHTML = (a.cv || []).map(r => `<li><span class="label">${esc(r.label)}</span><span>${esc(r.text)}</span></li>`).join('');
  $('#contact-title').innerHTML = esc(a.contact_title || '').replace(/\n/g, '<br>');
  $('#mail').textContent = a.email || '';
  $('#services').innerHTML = (a.services || []).map(s => `<li>${esc(s)}</li>`).join('');
}

/* ================= 페이지 전환 (메인 / 노트 / 소개) ================= */
const PAGES = { about: [$('#about-page'), $('#contact-page')], notes: [$('#notes-page')] }, home = $('#home');
function go(t, push = true) {
  if (t === 'contact') t = 'about';
  const page = PAGES[t];
  home.hidden = !!page;
  Object.entries(PAGES).forEach(([k, els]) => els.forEach(el => { el.hidden = k !== t; }));
  $$('.mast nav a[data-go]').forEach(a => {
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

/* ---------- 이메일 복사 ---------- */
const copyBtn = $('#copy');
copyBtn.addEventListener('click', () => {
  const done = () => { copyBtn.textContent = '복사됨'; setTimeout(() => { copyBtn.textContent = '주소 복사'; }, 1600); };
  const fb = () => { const r = document.createRange(); r.selectNodeContents($('#mail')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
  try { navigator.clipboard.writeText($('#mail').textContent).then(done, fb); } catch (e) { fb(); }
});

/* ================= 바로 편집 (나에게만 보임) ================= */
const SAVE_ERRORS = {
  expired: '로그인이 만료됐어요. <a href="admin/">글 관리 화면</a>에서 다시 로그인한 뒤 이 페이지를 새로고침해 주세요.',
  forbidden: '이 계정으로는 저장할 수 없어요. 토큰에 이 저장소의 Contents 쓰기 권한이 있는지 확인해 주세요.',
  conflict: '그사이 다른 곳에서 내용이 바뀌었어요. 최신 내용을 다시 불러왔으니 확인하고 한 번 더 저장해 주세요.',
  missing: '고치려던 항목을 찾을 수 없어요. 다른 곳에서 지웠거나 이름이 바뀌었을 수 있어요. 최신 내용을 다시 불러왔어요.',
  too_large: '사진이 너무 커서 올리지 못했어요. 더 작은 사진으로 다시 골라 주세요.',
  photo: '사진을 읽지 못했어요. JPG나 PNG 사진으로 다시 골라 주세요.',
  network: '인터넷 연결을 확인하고 다시 저장해 주세요.',
  other: '저장하지 못했어요. 잠시 후 다시 저장해 주세요.',
};
const STATE = { notes: v => { NOTES = v.notes || []; renderNotes(); }, cases: v => { CASES = v.cases || []; renderCases(); }, about: v => { ABOUT = v; renderAbout(); } };
const EMPTY = { notes: () => ({ notes: [] }), cases: () => ({ cases: [] }), about: () => ({}) };

let toastTimer = 0;
function toast(m) {
  const t = $('#toast');
  t.textContent = '✓ ' + m;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 4500);
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/* 편집 창 하나에 필요한 공통 동작 */
function editor(dlgSel, msgSel, saveSel, delSel) {
  const d = $(dlgSel), msg = $(msgSel), save = $(saveSel), del = delSel ? $(delSel) : null;
  const ui = {
    dlg: d,
    armed: false,
    err(html, el) { msg.innerHTML = html; if (el) el.focus(); },
    busy(b) { save.disabled = b; if (del) del.disabled = b; save.textContent = b ? '저장 중…' : '저장하기'; },
    reset() { ui.err(''); ui.busy(false); if (del) { ui.armed = false; del.classList.remove('armed'); del.textContent = '삭제'; } },
    /* 삭제는 두 번 눌러야 한다 */
    confirmDelete() {
      if (ui.armed) return true;
      ui.armed = true; del.classList.add('armed'); del.textContent = '한 번 더 누르면 삭제돼요';
      return false;
    },
    /* change(data)로 최신 파일을 고쳐 저장하고, 화면도 바로 바꾼다 */
    async commit(key, change, message, doneMsg, before) {
      ui.busy(true); ui.err('');
      try {
        if (before) await before();
        const { data, sha } = await readLatest(FILES[key]);
        const next = data || EMPTY[key]();
        change(next);
        await writeFile(FILES[key], next, sha, message);
        STATE[key](next);
        d.close();
        toast(doneMsg + ' 방문자 화면에는 1~2분 뒤 반영돼요.');
      } catch (e) {
        ui.busy(false);
        const code = e instanceof SaveError ? e.code : 'other';
        ui.err(SAVE_ERRORS[code] || SAVE_ERRORS.other);
        if (code === 'conflict' || code === 'missing') { try { const { data } = await readLatest(FILES[key]); if (data) STATE[key](data); } catch (_) {} }
      }
    },
  };
  d.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => d.close()));
  d.querySelector('form').addEventListener('input', () => ui.err(''));
  return ui;
}

/* ---------- 노트 편집 ---------- */
const noteUI = editor('#edit-dlg', '#edit-msg', '#save-btn', '#del-btn');
let noteOrig = null;
const sameNote = (a, b) => a && b && a.title === b.title && String(a.date || '') === String(b.date || '');
function openNote(i) {
  const n = i == null ? null : NOTES[i];
  noteOrig = n ? { ...n } : null;
  $('#edit-title').textContent = n ? '글 수정하기' : '새 글 쓰기';
  $('#f-title').value = n ? n.title || '' : '';
  $('#f-date').value = n ? String(n.date || '').slice(0, 10) : today();
  $('#f-tag').value = n ? n.tag || '' : '';
  $('#f-body').value = n ? n.body || '' : '';
  $('#f-featured').checked = !!(n && n.featured);
  $('#del-btn').hidden = !n;
  noteUI.reset();
  noteUI.dlg.showModal();
  $('#f-title').focus();
}
$('#edit-form').addEventListener('submit', e => {
  e.preventDefault();
  const title = $('#f-title').value.trim(), date = $('#f-date').value, tag = $('#f-tag').value.trim();
  const body = $('#f-body').value.replace(/\r/g, '').trim(), featured = $('#f-featured').checked;
  if (!title) return noteUI.err('제목을 입력해 주세요.', $('#f-title'));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return noteUI.err('날짜를 골라 주세요.', $('#f-date'));
  if (!body) return noteUI.err('본문을 입력해 주세요.', $('#f-body'));
  const orig = noteOrig;
  noteUI.commit('notes', data => {
    const list = data.notes || (data.notes = []);
    if (featured) list.forEach(n => { n.featured = false; });
    if (orig) {
      const i = list.findIndex(n => sameNote(n, orig));
      if (i < 0) throw new SaveError('missing');
      list[i] = { ...list[i], title, date, tag, featured, body };
    } else list.unshift({ title, date, tag, featured, body });
  }, `마케팅 노트 ${orig ? '수정' : '추가'}: ${title}`, orig ? '수정한 글을 저장했어요.' : '새 글을 올렸어요.');
});
$('#del-btn').addEventListener('click', () => {
  if (!noteUI.confirmDelete()) return;
  const orig = noteOrig;
  noteUI.commit('notes', data => {
    const list = data.notes || [];
    const i = list.findIndex(n => sameNote(n, orig));
    if (i < 0) throw new SaveError('missing');
    list.splice(i, 1);
  }, `마케팅 노트 삭제: ${orig.title}`, '글을 삭제했어요.');
});
$('#new-note').addEventListener('click', () => openNote(null));
$('#nav-write').addEventListener('click', e => { e.preventDefault(); go('notes'); openNote(null); });

/* ---------- 캠페인 편집 ---------- */
const caseUI = editor('#case-dlg', '#case-msg', '#case-save', '#case-del');
let caseOrig = null;
const sameCase = (a, b) => a && b && a.title === b.title && String(a.year || '') === String(b.year || '');
const CASE_FIELDS = { title: '#c-title', year: '#c-year', client: '#c-client', kpi: '#c-kpi', kpi_label: '#c-kpi-label', problem: '#c-problem', insight: '#c-insight', idea: '#c-idea', result: '#c-result' };
function openCase(i) {
  const c = i == null ? null : CASES[i];
  caseOrig = c ? { ...c } : null;
  $('#case-title').textContent = c ? '캠페인 수정하기' : '캠페인 추가';
  Object.entries(CASE_FIELDS).forEach(([k, sel]) => { $(sel).value = c ? c[k] || '' : (k === 'year' ? String(new Date().getFullYear()) : ''); });
  $('#c-tags').value = c ? (c.tags || []).join(', ') : '';
  $('#case-del').hidden = !c;
  caseUI.reset();
  caseUI.dlg.showModal();
  $('#c-title').focus();
}
$('#case-form').addEventListener('submit', e => {
  e.preventDefault();
  const rec = {};
  Object.entries(CASE_FIELDS).forEach(([k, sel]) => { rec[k] = $(sel).value.replace(/\r/g, '').trim(); });
  rec.tags = $('#c-tags').value.split(/[,，]/).map(s => s.trim().replace(/^#/, '')).filter(Boolean);
  if (!rec.title) return caseUI.err('캠페인 이름을 입력해 주세요.', $('#c-title'));
  if (!rec.kpi) return caseUI.err('대표 성과 숫자를 입력해 주세요. 예: +218%', $('#c-kpi'));
  const orig = caseOrig;
  caseUI.commit('cases', data => {
    const list = data.cases || (data.cases = []);
    if (orig) {
      const i = list.findIndex(c => sameCase(c, orig));
      if (i < 0) throw new SaveError('missing');
      list[i] = { ...list[i], ...rec };
    } else list.unshift(rec);
  }, `캠페인 파일 ${orig ? '수정' : '추가'}: ${rec.title}`, orig ? '캠페인을 저장했어요.' : '새 캠페인을 맨 위에 올렸어요.');
});
$('#case-del').addEventListener('click', () => {
  if (!caseUI.confirmDelete()) return;
  const orig = caseOrig;
  caseUI.commit('cases', data => {
    const list = data.cases || [];
    const i = list.findIndex(c => sameCase(c, orig));
    if (i < 0) throw new SaveError('missing');
    list.splice(i, 1);
  }, `캠페인 파일 삭제: ${orig.title}`, '캠페인을 삭제했어요.');
});
$('#new-case').addEventListener('click', () => openCase(null));

/* 순서 바꾸기: 편집 창 없이 바로 저장 */
let moving = false;
async function moveCase(i, dir) {
  if (moving) return;
  const c = CASES[i];
  if (!c) return;
  moving = true;
  $$('[data-case-move]').forEach(b => { b.disabled = true; });
  try {
    const { data, sha } = await readLatest(FILES.cases);
    const list = (data && data.cases) || [];
    const from = list.findIndex(x => sameCase(x, c)), to = from + dir;
    if (from < 0 || to < 0 || to >= list.length) throw new SaveError('missing');
    [list[from], list[to]] = [list[to], list[from]];
    await writeFile(FILES.cases, data, sha, `캠페인 파일 순서 변경: ${c.title}`);
    CASES = list;
    toast('순서를 바꿨어요. 방문자 화면에는 1~2분 뒤 반영돼요.');
  } catch (e) {
    const code = e instanceof SaveError ? e.code : 'other';
    toast((SAVE_ERRORS[code] || SAVE_ERRORS.other).replace(/<[^>]+>/g, ''));
    try { const { data } = await readLatest(FILES.cases); if (data) CASES = data.cases || []; } catch (_) {}
  }
  moving = false;
  renderCases();
}

/* ---------- 소개 · 연락처 편집 ---------- */
const aboutUI = editor('#about-dlg', '#about-msg', '#about-save');
let photoFile = null, photoPath = '';
function showPhotoPrev(src) {
  $('#a-photo-prev').innerHTML = src ? `<img src="${esc(src)}" alt="">` : '사진 없음';
  $('#a-photo-clear').hidden = !src;
}
/* data/about.json 이 아직 없을 때 편집 창에 채울 기본값 (페이지에 적힌 내용과 같다) */
const DEFAULT_ABOUT = {
  name: '이지영', role: '콘텐츠 마케터 & 캠페인 기획자', photo: '',
  intro: '매거진 에디터로 일을 시작해 스타트업 콘텐츠 팀을 이끌었고, 지금은 프리랜서로 브랜드 캠페인을 기획합니다.\n\n좋은 기획은 첫 장만 읽어도 결정할 수 있어야 한다고 믿습니다.',
  cv: [{ label: '2024–', text: '프리랜서 마케터 · 캠페인 기획' }, { label: '2021–24', text: '스타트업 ○○ 콘텐츠 팀 리드' }, { label: '2019–21', text: '라이프스타일 매거진 에디터' }, { label: '학력', text: '○○대학교 국어국문학과' }, { label: '도구', text: 'GA4, Meta 광고 관리자, Notion, Figma, Stibee' }],
  contact_title: '다음 캠페인을\n함께 기획해요.', email: 'hello@example.com',
  services: ['브랜드 런칭 · 캠페인 기획', '콘텐츠 전략과 채널 운영', '뉴스레터 · 카피라이팅', '마케팅 글쓰기 워크숍'],
};
function openAbout() {
  const a = ABOUT || DEFAULT_ABOUT;
  $('#a-name').value = a.name || '';
  $('#a-role').value = a.role || '';
  $('#a-intro').value = a.intro || '';
  $('#a-cv').value = (a.cv || []).map(r => `${r.label || ''} | ${r.text || ''}`).join('\n');
  $('#a-contact').value = a.contact_title || '';
  $('#a-email').value = a.email || '';
  $('#a-services').value = (a.services || []).join('\n');
  photoFile = null; photoPath = a.photo || '';
  $('#a-photo').value = '';
  showPhotoPrev(photoPath);
  aboutUI.reset();
  aboutUI.dlg.showModal();
  $('#a-name').focus();
}
$('#a-photo').addEventListener('change', () => {
  const f = $('#a-photo').files[0];
  if (!f) return;
  if (!/^image\//.test(f.type)) { aboutUI.err(SAVE_ERRORS.photo); $('#a-photo').value = ''; return; }
  photoFile = f;
  showPhotoPrev(URL.createObjectURL(f));
});
$('#a-photo-clear').addEventListener('click', () => { photoFile = null; photoPath = ''; $('#a-photo').value = ''; showPhotoPrev(''); });

/* 사진을 긴 변 1200px 이하 JPG로 줄인다 */
async function shrinkPhoto(file) {
  let img;
  try {
    img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  } catch (e) { throw new SaveError('photo'); }
  const scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.86));
  if (!blob) throw new SaveError('photo');
  return new Uint8Array(await blob.arrayBuffer());
}

$('#about-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#a-name').value.trim();
  const email = $('#a-email').value.trim();
  if (!name) return aboutUI.err('이름을 입력해 주세요.', $('#a-name'));
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return aboutUI.err('이메일 주소 형식을 확인해 주세요. 예: name@example.com', $('#a-email'));
  const cv = $('#a-cv').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const k = l.search(/[|｜]/);
    return k < 0 ? { label: '', text: l } : { label: l.slice(0, k).trim(), text: l.slice(k + 1).trim() };
  });
  const fields = {
    name,
    role: $('#a-role').value.trim(),
    intro: $('#a-intro').value.replace(/\r/g, '').trim(),
    cv,
    contact_title: $('#a-contact').value.replace(/\r/g, '').trim(),
    email,
    services: $('#a-services').value.split('\n').map(s => s.trim()).filter(Boolean),
  };
  let photo = photoPath;
  aboutUI.commit('about', data => { Object.assign(data, fields, { photo }); }, '소개 · 연락처 수정', '소개를 저장했어요.', async () => {
    if (!photoFile) return;
    /* 새 사진을 먼저 올리고, 그 주소를 소개에 적는다 */
    const bytes = await shrinkPhoto(photoFile);
    const path = `images/uploads/profile-${Date.now()}.jpg`;
    await gh('PUT', path, { message: '프로필 사진 올리기', branch: BRANCH, content: bytesToB64(bytes) });
    photo = '/' + path;
    photoFile = null; photoPath = photo;
  });
});
$('#edit-about').addEventListener('click', openAbout);

/* 편집 버튼 (목록 안의 버튼은 다시 그려지므로 위임으로 받는다) */
document.addEventListener('click', e => {
  if (!TOKEN) return;
  const n = e.target.closest('[data-note-edit]');
  if (n) return openNote(Number(n.dataset.noteEdit));
  const c = e.target.closest('[data-case-edit]');
  if (c) return openCase(Number(c.dataset.caseEdit));
  const m = e.target.closest('[data-case-move]');
  if (m) moveCase(Number(m.dataset.caseMove), Number(m.dataset.dir));
});

/* ================= 처음 불러오기 ================= */
(async () => {
  const h = location.hash.slice(1);
  if (h) go(h, false);
  const keys = Object.keys(FILES);
  let results = null;
  if (TOKEN) {
    /* 로그인한 브라우저: 방금 저장한 내용도 보이도록 저장소에서 최신 파일을 바로 읽는다 */
    try {
      results = await Promise.all(keys.map(k => readLatest(FILES[k]).then(r => r.data)));
      document.body.classList.add('owner');
    } catch (e) { results = null; }
  }
  if (!results) results = await Promise.all(keys.map(k => loadStatic(FILES[k])));
  const [notes, cases, about] = results;
  if (cases) { CASES = Array.isArray(cases.cases) ? cases.cases : []; renderCases(); } else renderCases(true);
  if (notes) { NOTES = Array.isArray(notes.notes) ? notes.notes : []; renderNotes(); } else renderNotes(true);
  if (about) { ABOUT = about; renderAbout(); }
})();
