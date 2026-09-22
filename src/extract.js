// Turns pasted rules text into checklist items. Every item keeps the
// character range of the sentence it came from, so the UI can show it.

import { ZONE_PATTERN, toIanaZone, zonedToEpoch } from './zones.js';

const ABBREVIATIONS = new Set([
  'e.g', 'i.e', 'etc', 'a.m', 'p.m', 'u.s', 'no', 'vs', 'inc', 'ltd', 'st', 'mr', 'ms', 'dr',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'approx', 'min',
]);

// ---------- sentences ----------

export function splitSentences(text) {
  const out = [];
  const push = (start, end) => {
    while (start < end && /[\s•·*\-–—>]/.test(text[start])) start++;
    while (end > start && /\s/.test(text[end - 1])) end--;
    if (end - start >= 3) out.push({ text: text.slice(start, end), start, end });
  };
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n' || ch === '•') {
      push(start, i);
      start = i + 1;
      continue;
    }
    if (ch === '.' || ch === '!' || ch === '?' || ch === ';') {
      const next = text[i + 1];
      if (next !== undefined && !/\s/.test(next)) continue; // 1.5, file.md, example.com
      if (ch === '.') {
        const word = text.slice(start, i).match(/([A-Za-z.]+)$/);
        if (word && ABBREVIATIONS.has(word[1].toLowerCase())) continue;
        if (word && /^[A-Z]$/.test(word[1])) continue; // initials
      }
      push(start, i + 1);
      start = i + 1;
    }
  }
  push(start, text.length);
  return out;
}

// ---------- classification ----------

const HARD = /\b(must|required|requires?|requirement|shall|need to|needs to|mandatory|will not be (eligible|accepted|judged|considered|reviewed|awarded)|not (be )?eligible|is not open to|are not open to|ineligible|no later than|may not|cannot|can ?not|prohibited|not permitted|disqualif\w*|at least|only)\b/i;
const SOFT = /\b(should|encouraged|recommended|optional(ly)?|suggest(ed)?|ideally)\b/i;
const NOISE = /\b(indemnif\w*|liabilit\w*|warrant(y|ies)|governing law|arbitration|personal information|privacy policy|publicity|tax(es)?|affidavits?|sole (and absolute )?discretion|force majeure|void where|prizes? (will|shall) be|w-?[89]|likeness|promote|intellectual property|discrepanc\w*|verification requirement|required forms|judges may|official rules is|household includes?)\b/i;

const CATEGORY_TESTS = [
  ['video', /\b(video|demo(nstration)? (video|recording)|screen ?recording|youtube|vimeo|loom)\b/i],
  ['repository', /\b(repo|repository|repositories|readme|license|github|gitlab|bitbucket|source code|public code)\b/i],
  ['eligibility', /\b(eligib\w*|open to|ages? \d+|\d+\+ only|age of majority|years of age|years old|residents?|citizens?|employees? of|sanction\w*|team(s)? of up to|team size|individuals? who)\b/i],
  ['deliverable', /\b(submit\w*|submission|include|includes|provide|upload\w*|deliver\w*|description|write-?up|screenshots?|project)\b/i],
];

export function categoryOf(sentence) {
  for (const [name, re] of CATEGORY_TESTS) if (re.test(sentence)) return name;
  return null;
}

// A short line that introduces a list of requirements ("Requirements",
// "What to Submit", "Three requirements, all checked at submission:").
export function isRequirementHeading(sentence) {
  const s = sentence.trim();
  if (s.length > 90) return false;
  return /^(requirements?|submission requirements|what to (submit|build|create|include)|eligibility( requirements)?|project requirements|entry requirements|you must|must include)\b/i.test(s)
    || /\brequirements?\b[^.]*[:.]$/i.test(s);
}

function isShouting(s) {
  const letters = s.replace(/[^A-Za-z]/g, '');
  return letters.length > 15 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.7;
}

export function classify(sentence, { underHeading = false } = {}) {
  const s = sentence;
  if (s.length > 700) return null;
  if (isShouting(s)) return null; // all-caps legal banners
  if (s.length < 60 && /:$/.test(s)) return null; // list intros such as "The Hackathon IS open to:" 
  const soft = SOFT.test(s) || /\bnot (required|mandatory)\b/i.test(s);
  const hard = HARD.test(s.replace(/\bnot (required|mandatory)\b/gi, '')) || (underHeading && !soft);
  let category = categoryOf(s);
  if (!category && underHeading) category = 'deliverable';
  if (!category) return null;
  if (NOISE.test(s)) return null;
  if (!hard && !soft) return null;
  return { category, strength: hard ? 'hard' : 'soft' };
}

// ---------- files ----------

const FILE_RE = /(^|[\s("'`“‘,:])((?:[\w-]+\/)*[\w-]+(?:\.[\w-]+)*\.(md|markdown|txt|pdf|json|ya?ml|toml|py|ipynb|js|ts|csv|zip|html|docx|pptx|sh|env\.example))(?=$|[\s)"'`”’,.;:!?])/gi;
const FRAMEWORK_NAMES = /^(node|next|nuxt|vue|react|three|express|d3|chart|p5|deno|socket\.io|ember|backbone|angular|solid|svelte|alpine|htmx|tf|ml5|brain)$/i;

export function findFiles(sentence) {
  const names = [];
  for (const m of sentence.matchAll(FILE_RE)) {
    const full = m[2];
    const base = full.split('/').pop();
    const stem = base.replace(/\.[^.]+$/, '');
    const before = sentence.slice(Math.max(0, m.index - 12), m.index + m[1].length);
    if (/https?:\/\/\S*$|www\.\S*$|@\S*$/.test(before)) continue;
    if (FRAMEWORK_NAMES.test(stem)) continue;
    if (!names.some((n) => n.toLowerCase() === base.toLowerCase())) names.push(base);
  }
  if (/\b(open[- ]source )?licen[sc]e file\b/i.test(sentence) && !names.some((n) => /^licen[sc]e/i.test(n))) names.push('LICENSE');
  for (const bare of ['README', 'LICENSE']) {
    const re = new RegExp(`\\b${bare}\\b(?!\\.)`);
    if (re.test(sentence) && !names.some((n) => n.toUpperCase().startsWith(bare))) names.push(bare);
  }
  return names;
}

// ---------- video limits ----------

const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30, sixty: 60, ninety: 90 };
const NUM = '(\\d+(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|sixty|ninety)(?:\\s*\\(\\d+\\))?';
const UNIT = '(minutes?|mins?|seconds?|secs?)';

function toNumber(word) {
  const w = word.toLowerCase();
  return w in NUMBER_WORDS ? NUMBER_WORDS[w] : Number(w);
}
function toMinutes(value, unit) {
  return /^s/i.test(unit) ? value / 60 : value;
}

export function findVideoLimit(sentence, context = '') {
  if (!/\b(videos?|recordings?|demos?)\b/i.test(sentence + ' ' + context)) return null;
  let m = sentence.match(new RegExp(`\\b${NUM}\\s*(?:to|-|–|and)\\s*${NUM}\\s*${UNIT}`, 'i'));
  if (m) {
    return { minMinutes: toMinutes(toNumber(m[1]), m[3]), maxMinutes: toMinutes(toNumber(m[2]), m[3]) };
  }
  m = sentence.match(new RegExp(`\\b(less than|under|no (?:more|longer) than|not (?:to )?exceed(?:ing)?|a maximum of|maximum(?: of)?|max(?:imum)?|up to|shorter than|at most|within)\\s+${NUM}\\s*${UNIT}`, 'i'));
  if (m) return { minMinutes: null, maxMinutes: toMinutes(toNumber(m[2]), m[3]) };
  m = sentence.match(new RegExp(`\\b${NUM}[- ](minute|min|second)s?(?:\\s+or\\s+(?:less|shorter))?\\b`, 'i'));
  if (m) return { minMinutes: null, maxMinutes: toMinutes(toNumber(m[1]), m[2]) };
  return null;
}

// ---------- deadlines ----------

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?';
const DATE_RE = new RegExp(`\\b${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`, 'gi');
const TIME = '(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm|a\\.m\\.|p\\.m\\.)?';
const TIME_ZONE_AFTER = new RegExp(`^[\\s,(@at\\-–—]{0,8}${TIME}\\s*\\(?(${ZONE_PATTERN})\\b`, 'i');
const TIME_ZONE_BEFORE = new RegExp(`${TIME}\\s*\\(?(${ZONE_PATTERN})\\)?\\s*(?:on|,)?\\s*(?:\\w+day,?\\s*)?$`, 'i');

function to24(hour, ampm) {
  let h = Number(hour);
  if (!ampm) return h;
  const pm = /^p/i.test(ampm);
  if (h === 12) h = 0;
  return pm ? h + 12 : h;
}

export function findDeadlines(sentence, fallbackYear = new Date().getUTCFullYear()) {
  const found = [];
  for (const m of sentence.matchAll(DATE_RE)) {
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    const day = Number(m[2]);
    const year = m[3] ? Number(m[3]) : fallbackYear;
    if (day < 1 || day > 31) continue;
    const after = sentence.slice(m.index + m[0].length, m.index + m[0].length + 48);
    const before = sentence.slice(Math.max(0, m.index - 40), m.index);
    let t = after.match(TIME_ZONE_AFTER);
    if (!t) t = before.match(TIME_ZONE_BEFORE);
    let label = m[0];
    let epochMs = null;
    let zone = null;
    if (t) {
      const [, hh, mm, ampm, zoneText] = t;
      const hour = to24(hh, ampm);
      zone = toIanaZone(zoneText);
      if (zone && hour < 24) {
        epochMs = zonedToEpoch(year, month, day, hour, Number(mm || 0), zone);
        label = `${m[0]}, ${hh}:${mm || '00'}${ampm ? ' ' + ampm.replace(/\./g, '').toUpperCase() : ''} ${zoneText}`;
      }
    }
    found.push({ label: label.replace(/\s+/g, ' ').trim(), epochMs, zone, index: m.index });
  }
  return found;
}

const SUBMISSION_DEADLINE = /\b(deadline|submission period|submissions? (are |is )?due|due (date|by)|must be (submitted|received)|no later than|submit (by|before))\b/i;
const NOT_SUBMISSION = /\b(judging|winners?|announce\w*|registration opens|office hours|live session|webinar)\b/i;

// ---------- extract ----------

function shortLabel(text, max = 120) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}

function hashId(parts) {
  let h = 2166136261;
  for (const ch of parts.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function extract(text, { fallbackYear } = {}) {
  const sentences = splitSentences(text);
  const items = [];
  const deadlines = [];
  const seen = new Set();
  const seenFiles = new Set();
  let videoItem = null;
  let publicItem = null;
  let headingWindow = 0;

  for (let n = 0; n < sentences.length; n++) {
    const s = sentences[n];
    const key = s.text.replace(/\s+/g, ' ').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const src = { start: s.start, end: s.end, quote: s.text };
    const prevEnd = n > 0 ? sentences[n - 1].end : 0;
    if (/\n[ \t]*\n/.test(text.slice(prevEnd, s.start))) headingWindow = 0; // blank line ends a list
    if (isRequirementHeading(s.text)) { headingWindow = 6; continue; }
    if (headingWindow > 0 && s.text.length < 50 && !/[.!?:;]$/.test(s.text)) headingWindow = 0; // next section title
    const underHeading = headingWindow > 0 && s.text.length <= 240;
    if (headingWindow > 0) headingWindow--;
    const c = classify(s.text, { underHeading });

    // Deadlines: any sentence with a parsed date that talks about submitting.
    const dates = findDeadlines(s.text, fallbackYear);
    if (dates.length && (SUBMISSION_DEADLINE.test(s.text) || /\bdeadline\b/i.test(s.text)) && !NOT_SUBMISSION.test(s.text.replace(SUBMISSION_DEADLINE, ''))) {
      const timed = dates.filter((d) => d.epochMs !== null);
      const last = (timed.length ? timed : dates).reduce((a, b) => ((b.epochMs ?? 0) >= (a.epochMs ?? 0) ? b : a));
      const duplicate = last.epochMs !== null && deadlines.some((d) => d.epochMs === last.epochMs);
      deadlines.push({ label: last.label, epochMs: last.epochMs, zone: last.zone, ...src });
      if (duplicate) continue;
      items.push({
        id: hashId(['deadline', s.start, s.end]), category: 'deadline', strength: 'hard',
        label: `Submit before ${last.label}`, ...src, check: { type: 'manual' },
      });
      continue;
    }

    // Required files become one machine-checkable item each.
    const files = c ? findFiles(s.text) : [];
    for (const name of files) {
      const k = name.toLowerCase();
      if (seenFiles.has(k)) continue;
      seenFiles.add(k);
      items.push({
        id: hashId(['file', k]), category: 'repository', strength: c.strength,
        label: `Repository includes ${name}`, ...src, check: { type: 'file', name },
      });
    }

    const context = sentences.slice(Math.max(0, n - 2), n).map((x) => x.text).join(' ');
    const limit = findVideoLimit(s.text, context);
    if (limit && !videoItem) {
      const range = limit.minMinutes ? `${fmtMin(limit.minMinutes)}–${fmtMin(limit.maxMinutes)} min` : `at most ${fmtMin(limit.maxMinutes)} min`;
      videoItem = {
        id: hashId(['video-limit', s.start]), category: 'video', strength: 'hard',
        label: `Demo video length: ${range}`, ...src, check: { type: 'manual' }, limit,
      };
      items.push(videoItem);
      continue;
    }

    if (!publicItem && /\bpublic(ly)?\b[^.]{0,60}\b(repo|repository|github|gitlab|bitbucket|code)\b|\b(repo|repository)\b[^.]{0,40}\bpublic\b/i.test(s.text)) {
      publicItem = {
        id: hashId(['public', s.start]), category: 'repository', strength: 'hard',
        label: 'Repository is publicly readable', ...src, check: { type: 'public' },
      };
      items.push(publicItem);
      continue;
    }

    if (!c || files.length) continue;
    items.push({
      id: hashId([c.category, s.start, s.end]), category: c.category, strength: c.strength,
      label: shortLabel(s.text), ...src, check: { type: 'manual' },
    });
  }

  return { items, deadlines };
}

function fmtMin(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

export function primaryDeadline(deadlines, now = Date.now()) {
  const timed = deadlines.filter((d) => d.epochMs !== null);
  if (!timed.length) return deadlines[0] || null;
  const future = timed.filter((d) => d.epochMs > now);
  const pool = future.length ? future : timed;
  return pool.reduce((a, b) => (b.epochMs > a.epochMs ? b : a));
}
