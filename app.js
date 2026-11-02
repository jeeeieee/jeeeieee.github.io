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
    leadEl.innerHTML = `<span class="label">${lead.featured ? '대표 글' : '최신 글'} · ${dot(lead.date)} · ${esc(lead.tag)}</span><h3>${esc(lead.title)}</h3><div class="body">${md(lead.body)}</div>`;
  } else {
    leadEl.hidden = false;
    leadEl.innerHTML = '<p class="empty">아직 쓴 글이 없어요.</p>';
  }
  const shown = rest.filter(match);
  $('#list').innerHTML = shown.length
    ? shown.map(n => `<li><details><summary><span class="label">${dot(n.date)} · ${esc(n.tag)}</span><strong>${esc(n.title)}</strong></summary><div class="body">${md(n.body)}</div></details></li>`).join('')
    : (rest.length ? '<li class="empty">이 주제의 글이 아직 없어요.</li>' : '');
  const tags = [...new Set(all.map(n => n.tag).filter(Boolean))];
  if (filterTag !== 'all' && !tags.includes(filterTag)) filterTag = 'all';
  $('#filter').innerHTML = ['all', ...tags].map(t => `<button type="button" data-f="${esc(t)}" aria-pressed="${t === filterTag}">${t === 'all' ? '전체' : esc(t)}</button>`).join('');
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

/* ---------- 데이터 불러오기 ---------- */
(async () => {
  const [cases, notes] = await Promise.all([load('data/cases.json', 'cases'), load('data/notes.json', 'notes')]);
  renderCases(cases);
  if (notes === null) {
    $('#lead').innerHTML = '<p class="empty">글을 불러오지 못했어요. 잠시 후 새로고침해 주세요.</p>';
    return;
  }
  NOTES = notes;
  renderNotes();
})();
