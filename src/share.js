// Getting rules in (bookmarklet) and deadlines out (.ics).

export const APP_URL = 'https://hyunsikparker.github.io/ruleproof/';

// A bookmarklet that sends the visible text of the current page to RuleProof
// in the URL fragment. Fragments are never sent to a server.
export function bookmarklet(appUrl = APP_URL) {
  const code = `(()=>{const t=document.body.innerText;const u=${JSON.stringify(appUrl)}+'#src='+encodeURIComponent(location.href)+'&rules='+encodeURIComponent(t);window.open(u,'_blank');})()`;
  return `javascript:${encodeURIComponent(code)}`;
}

// Reads `#src=...&rules=...` written by the bookmarklet.
export function parseImport(hash) {
  if (!hash || !hash.includes('rules=')) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const rules = params.get('rules');
  if (!rules || !rules.trim()) return null;
  return { rules, src: params.get('src') || null };
}

const pad = (n) => String(n).padStart(2, '0');
const icsTime = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};
const icsText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// One-event calendar file at the deadline, with alarms 24 h and 2 h before.
export function deadlineIcs({ epochMs, label, title = 'Hackathon submission deadline', url = null, now = Date.now() }) {
  if (!Number.isFinite(epochMs)) return null;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RuleProof//Deadline//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:ruleproof-${epochMs}@hyunsikparker.github.io`,
    `DTSTAMP:${icsTime(now)}`,
    `DTSTART:${icsTime(epochMs - 30 * 60e3)}`,
    `DTEND:${icsTime(epochMs)}`,
    `SUMMARY:${icsText(`Deadline: ${title}`)}`,
    `DESCRIPTION:${icsText(`Submission deadline as written in the rules: ${label}.${url ? ` Rules: ${url}` : ''}`)}`,
    ...(url ? [`URL:${url}`] : []),
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(`${title} closes in 24 hours`)}`, 'TRIGGER;RELATED=END:-PT24H', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(`${title} closes in 2 hours`)}`, 'TRIGGER;RELATED=END:-PT2H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}
