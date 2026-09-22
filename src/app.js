import { extract, primaryDeadline } from './extract.js';
import { formatInZone } from './zones.js';
import { parseRepoUrl, checkRepo, matchFiles } from './repo.js';
import { SAMPLE_RULES } from './sample.js';

const KEY = 'ruleproof:v1';
const CATEGORIES = [
  ['deadline', 'Deadlines'],
  ['eligibility', 'Eligibility'],
  ['deliverable', 'Deliverables'],
  ['video', 'Video'],
  ['repository', 'Repository'],
];
const LOCAL_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const $ = (id) => document.getElementById(id);
const el = {
  input: $('rules-input'), view: $('rules-view'), extract: $('extract'), edit: $('edit-rules'),
  sample: $('load-sample'), clear: $('clear-all'), copy: $('copy-md'),
  empty: $('empty'), results: $('results'), deadline: $('deadline'), summary: $('summary'),
  repoForm: $('repo-form'), repoUrl: $('repo-url'), repoStatus: $('repo-status'), groups: $('groups'),
};

let state = emptyState();
let activeId = null;
let timer = null;

function emptyState() {
  return { rules: '', items: [], deadlines: [], ticks: {}, extracted: false, repo: { url: '', result: null, checkedAt: null } };
}

// ---------- persistence ----------

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...emptyState(), ...JSON.parse(raw) };
  } catch { state = emptyState(); }
}

// ---------- status ----------

function fileMatches() {
  const r = state.repo.result;
  if (!r || !r.ok) return null;
  const names = state.items.filter((i) => i.check.type === 'file').map((i) => i.check.name);
  return matchFiles(r.paths, names);
}

function statusOf(item, matches) {
  const r = state.repo.result;
  if (item.check.type === 'file') {
    if (!r) return { key: 'unchecked', text: 'not checked' };
    if (!r.ok) return { key: r.reason === 'not_found' ? 'missing' : 'unchecked', text: r.reason === 'not_found' ? 'no repo' : 'not checked' };
    const path = matches && matches[item.check.name];
    if (path) return { key: 'verified', text: 'found', detail: path };
    const detail = r.truncated ? 'file list was truncated by GitHub' : null;
    return item.strength === 'soft' ? { key: 'optional', text: 'not found', detail } : { key: 'missing', text: 'missing', detail };
  }
  if (item.check.type === 'public') {
    if (!r) return { key: 'unchecked', text: 'not checked' };
    if (r.ok && r.public) return { key: 'verified', text: 'public' };
    if (!r.ok && r.reason === 'not_found') return { key: 'missing', text: 'not public' };
    return { key: 'unchecked', text: 'not checked' };
  }
  if (state.ticks[item.id]) return { key: 'done', text: 'done' };
  if (item.category === 'deadline') {
    const d = state.deadlines.find((x) => x.start === item.start);
    if (d && d.epochMs !== null && d.epochMs < Date.now()) return { key: 'passed', text: 'passed' };
  }
  return item.strength === 'hard' ? { key: 'todo', text: 'to do' } : { key: 'optional', text: 'optional' };
}

const ICONS = {
  deadline: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  eligibility: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 11l2 2 4-4"/></svg>',
  deliverable: '<svg viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
  video: '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3"/></svg>',
  repository: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="8" r="2.5"/><path d="M6 8.5v7"/><path d="M18 10.5c0 4-6 3-11.5 5.5"/></svg>',
};
const TICK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const BOLT = '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>';

// ---------- rendering ----------

function render() {
  const has = state.extracted;
  el.input.hidden = has;
  el.view.hidden = !has;
  el.edit.hidden = !has;
  el.extract.hidden = has;
  el.copy.disabled = !has || !state.items.length;
  el.empty.hidden = has;
  el.results.hidden = !has;
  if (!has) {
    el.input.value = state.rules;
    clearInterval(timer);
    return;
  }
  renderRules();
  renderDeadline();
  renderRepo();
  renderGroups();
}

function renderRules() {
  const text = state.rules;
  const byRange = new Map();
  for (const item of state.items) {
    const k = `${item.start}:${item.end}`;
    if (!byRange.has(k)) byRange.set(k, { start: item.start, end: item.end, ids: [] });
    byRange.get(k).ids.push(item.id);
  }
  const ranges = [...byRange.values()].sort((a, b) => a.start - b.start);
  const frag = document.createDocumentFragment();
  let pos = 0;
  for (const r of ranges) {
    if (r.start < pos) continue;
    frag.append(text.slice(pos, r.start));
    const m = document.createElement('mark');
    m.textContent = text.slice(r.start, r.end);
    m.dataset.ids = r.ids.join(' ');
    if (r.ids.includes(activeId)) m.classList.add('active');
    frag.append(m);
    pos = r.end;
  }
  frag.append(text.slice(pos));
  el.view.replaceChildren(frag);
}

function renderDeadline() {
  clearInterval(timer);
  const d = primaryDeadline(state.deadlines);
  el.deadline.className = 'deadline';
  if (!d) {
    el.deadline.classList.add('none');
    el.deadline.innerHTML = '<div><span class="k">Submission deadline</span><span class="written">No dated deadline found. Check the Deadlines items below.</span></div>';
    return;
  }
  el.deadline.innerHTML = `
    <div>
      <span class="k">Submission deadline</span>
      <span class="written"></span>
      <span class="local"></span>
    </div>
    <div class="tiles" aria-live="off"></div>`;
  el.deadline.querySelector('.written').textContent = d.label;
  const local = el.deadline.querySelector('.local');
  if (d.epochMs !== null) {
    local.innerHTML = 'Your time: <b></b>';
    local.querySelector('b').textContent = formatInZone(d.epochMs, LOCAL_ZONE);
  } else {
    local.textContent = 'Time or time zone not stated in the rules';
  }
  const tiles = el.deadline.querySelector('.tiles');
  const tick = () => {
    if (d.epochMs === null) { tiles.remove(); return; }
    const ms = d.epochMs - Date.now();
    if (ms <= 0) {
      el.deadline.classList.add('passed');
      tiles.outerHTML = '<span class="passed-tag">Deadline passed</span>';
      clearInterval(timer);
      return;
    }
    const s = Math.floor(ms / 1000);
    const parts = [[Math.floor(s / 86400), 'days'], [Math.floor(s / 3600) % 24, 'hrs'], [Math.floor(s / 60) % 60, 'min'], [s % 60, 'sec']];
    tiles.innerHTML = parts.map(([v, u], i) => `<span class="tile"><b>${i ? String(v).padStart(2, '0') : v}</b><i>${u}</i></span>`).join('');
  };
  tick();
  timer = setInterval(tick, 1000);
}

function renderRepo() {
  el.repoUrl.value = state.repo.url;
  const r = state.repo.result;
  el.repoStatus.className = 'repo-status';
  if (!r) {
    const needs = state.items.some((i) => i.check.type !== 'manual');
    el.repoStatus.textContent = needs ? 'Paste a repo URL to verify file and visibility items.' : 'No file requirements found in these rules.';
    return;
  }
  if (!r.ok) {
    el.repoStatus.classList.add('err');
    el.repoStatus.textContent = {
      not_found: 'Not reachable publicly: the repository is private, renamed or does not exist.',
      rate_limited: 'GitHub rate limit reached (60 checks per hour). Try again later; manual ticks still work.',
      network: 'Could not reach GitHub. Check your connection and try again.',
      invalid: 'That does not look like a GitHub repository URL (https://github.com/owner/repo).',
    }[r.reason];
    return;
  }
  el.repoStatus.classList.add('ok');
  const when = state.repo.checkedAt ? new Date(state.repo.checkedAt).toLocaleString() : '';
  el.repoStatus.textContent = `Public repository · ${r.defaultBranch} · ${r.paths.length} files · checked ${when}`;
}

function renderGroups() {
  const matches = fileMatches();
  const statuses = new Map(state.items.map((i) => [i.id, statusOf(i, matches)]));
  renderSummary(statuses);

  if (!state.items.length) {
    el.groups.innerHTML = '<p class="nothing">No requirement sentences found. Is this the rules page? Use <b>Edit</b> to paste a different text.</p>';
    return;
  }
  const frag = document.createDocumentFragment();
  let index = 0;
  for (const [cat, title] of CATEGORIES) {
    const items = state.items.filter((i) => i.category === cat);
    if (!items.length) continue;
    const g = document.createElement('div');
    g.className = 'group';
    const done = items.filter((i) => ['verified', 'done'].includes(statuses.get(i.id).key)).length;
    g.innerHTML = `
      <div class="group-head">
        <span class="group-icon">${ICONS[cat]}</span>
        <h3>${title}</h3>
        <span class="group-count"><span class="mini"><span style="width:${(done / items.length) * 100}%"></span></span>${done}/${items.length}</span>
      </div>`;
    for (const item of items) g.append(renderItem(item, statuses.get(item.id), index++));
    frag.append(g);
  }
  el.groups.replaceChildren(frag);
}

function renderItem(item, st, index = 0) {
  const row = document.createElement('div');
  row.className = 'item' + (item.id === activeId ? ' active' : '');
  row.dataset.id = item.id;
  row.style.setProperty('--i', Math.min(index, 30));

  if (item.check.type === 'manual') {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'check';
    box.checked = Boolean(state.ticks[item.id]);
    box.setAttribute('aria-label', `Mark done: ${item.label}`);
    box.addEventListener('click', (e) => e.stopPropagation());
    box.addEventListener('change', () => {
      state.ticks[item.id] = box.checked;
      save();
      renderGroups();
    });
    row.append(box);
  } else {
    const auto = document.createElement('span');
    auto.className = 'auto' + (st.key === 'verified' ? ' on' : st.key === 'missing' ? ' off' : '');
    auto.title = 'Checked automatically against the repository';
    auto.innerHTML = st.key === 'verified' ? TICK : st.key === 'missing' ? CROSS : BOLT;
    row.append(auto);
  }

  const body = document.createElement('div');
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = item.label;
  if (item.strength === 'soft') {
    const tag = document.createElement('span');
    tag.className = 'soft-tag';
    tag.textContent = 'soft';
    tag.title = 'Worded as should / encouraged / optional';
    label.append(tag);
  }
  body.append(label);
  if (st.detail) {
    const meta = document.createElement('div');
    meta.className = 'meta';
    if (st.key === 'verified') {
      meta.append('found at ');
      const code = document.createElement('code');
      code.textContent = st.detail;
      meta.append(code);
    } else {
      meta.textContent = st.detail;
    }
    body.append(meta);
  }
  row.append(body);

  const pill = document.createElement('span');
  pill.className = `pill ${st.key}`;
  pill.textContent = st.text;
  row.append(pill);

  if (item.id === activeId) row.append(sourceBlock(item));
  row.addEventListener('click', () => focusItem(item.id, true));
  return row;
}

function sourceBlock(item) {
  const box = document.createElement('div');
  box.className = 'source';
  const k = document.createElement('span');
  k.className = 'src-k';
  k.textContent = 'Source sentence';
  const q = document.createElement('q');
  q.textContent = item.quote.replace(/\s+/g, ' ').trim();
  box.append(k, q);
  return box;
}

function renderSummary(statuses) {
  const all = [...statuses.values()];
  const n = all.length;
  const c = (keys) => all.filter((s) => keys.includes(s.key)).length;
  const ok = c(['verified', 'done']);
  const bad = c(['missing', 'passed']);
  const todo = c(['todo']);
  const pct = n ? Math.round((ok / n) * 100) : 0;
  el.summary.innerHTML = `
    <div class="ring" style="--p:${pct}" role="img" aria-label="${pct}% complete"><span>${pct}%</span></div>
    <div class="stats">
      <div class="stat ok"><b>${ok}</b><span>Done or verified</span></div>
      <div class="stat bad"><b>${bad}</b><span>Missing</span></div>
      <div class="stat warn"><b>${todo}</b><span>To do</span></div>
      <div class="stat"><b>${n - ok - bad - todo}</b><span>Optional</span></div>
    </div>`;
}

// Scroll a container so `target` sits in its middle, without moving the page.
function scrollWithin(container, target) {
  const c = container.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  container.scrollTo({ top: container.scrollTop + (t.top - c.top) - c.height / 2 + t.height / 2, behavior: 'smooth' });
}

function focusItem(id, scrollRules) {
  activeId = activeId === id && scrollRules ? null : id;
  for (const m of el.view.querySelectorAll('mark')) {
    const on = activeId !== null && m.dataset.ids.split(' ').includes(activeId);
    m.classList.toggle('active', on);
    if (on && scrollRules) scrollWithin(el.view, m);
  }
  for (const row of el.groups.querySelectorAll('.item')) {
    const on = row.dataset.id === activeId;
    row.classList.toggle('active', on);
    const existing = row.querySelector('.source');
    if (existing && !on) existing.remove();
    if (on && !existing) {
      const item = state.items.find((i) => i.id === activeId);
      if (item) row.append(sourceBlock(item));
    }
  }
}

// ---------- actions ----------

function runExtract() {
  const text = el.input.value;
  if (!text.trim()) { el.input.focus(); return; }
  const { items, deadlines } = extract(text);
  const ids = new Set(items.map((i) => i.id));
  const ticks = Object.fromEntries(Object.entries(state.ticks).filter(([k]) => ids.has(k)));
  state = { ...state, rules: text, items, deadlines, ticks, extracted: true };
  activeId = null;
  save();
  render();
}

async function runRepoCheck(e) {
  e.preventDefault();
  const url = el.repoUrl.value.trim();
  state.repo.url = url;
  const parsed = parseRepoUrl(url);
  if (!parsed) {
    state.repo.result = { ok: false, reason: 'invalid' };
    save();
    renderRepo();
    return;
  }
  el.repoStatus.className = 'repo-status busy';
  el.repoStatus.textContent = `Checking ${parsed.owner}/${parsed.repo}…`;
  const result = await checkRepo(parsed.owner, parsed.repo);
  state.repo = { url, result, checkedAt: new Date().toISOString() };
  save();
  renderRepo();
  renderGroups();
  if (activeId) focusItem(activeId, false);
}

function toMarkdown() {
  const matches = fileMatches();
  const lines = ['## Submission checklist (RuleProof)', ''];
  const d = primaryDeadline(state.deadlines);
  if (d) lines.push(`Deadline: ${d.label}${d.epochMs !== null ? ` (${formatInZone(d.epochMs, LOCAL_ZONE)})` : ''}`, '');
  if (state.repo.result && state.repo.result.ok) lines.push(`Repository: ${state.repo.url}`, '');
  for (const [cat, title] of CATEGORIES) {
    const items = state.items.filter((i) => i.category === cat);
    if (!items.length) continue;
    lines.push(`### ${title}`);
    for (const item of items) {
      const st = statusOf(item, matches);
      const x = ['verified', 'done'].includes(st.key) ? 'x' : ' ';
      const extra = st.detail && st.key === 'verified' ? ` — ${st.detail}` : '';
      lines.push(`- [${x}] ${item.label}${item.strength === 'soft' ? ' (soft)' : ''} — ${st.text}${extra}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function copyMarkdown() {
  const md = toMarkdown();
  try {
    await navigator.clipboard.writeText(md);
  } catch {
    const t = document.createElement('textarea');
    t.value = md;
    document.body.append(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
  toast('Checklist copied as Markdown');
}

function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    document.body.append(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

// ---------- wiring ----------

el.extract.addEventListener('click', runExtract);
el.edit.addEventListener('click', () => {
  state.extracted = false;
  save();
  render();
  el.input.focus();
});
el.sample.addEventListener('click', () => {
  el.input.value = SAMPLE_RULES;
  state.extracted = false;
  render();
  el.input.value = SAMPLE_RULES;
  runExtract();
});
el.clear.addEventListener('click', () => {
  state = emptyState();
  activeId = null;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  render();
});
el.copy.addEventListener('click', copyMarkdown);
document.getElementById('empty-sample').addEventListener('click', () => el.sample.click());
el.repoForm.addEventListener('submit', runRepoCheck);
el.view.addEventListener('click', (e) => {
  const m = e.target.closest('mark');
  if (!m) return;
  const id = m.dataset.ids.split(' ')[0];
  focusItem(id, false);
  const row = el.groups.querySelector(`.item[data-id="${id}"]`);
  if (row) {
    const r = row.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) window.scrollBy({ top: r.top - window.innerHeight / 2, behavior: 'smooth' });
  }
});
el.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runExtract();
});

load();
render();
