// Written time-zone names -> IANA zones, and wall-clock -> UTC conversion.
// Abbreviations map to a region zone, so "ET" or "EST" on a summer date
// resolves to the offset actually in force that day.

const ZONE_NAMES = [
  [/^(e[sd]t|et|eastern( (standard|daylight))?( time)?)$/i, 'America/New_York'],
  [/^(c[sd]t|ct|central( (standard|daylight))?( time)?)$/i, 'America/Chicago'],
  [/^(m[sd]t|mt|mountain( (standard|daylight))?( time)?)$/i, 'America/Denver'],
  [/^(p[sd]t|pt|pacific( (standard|daylight))?( time)?)$/i, 'America/Los_Angeles'],
  [/^(utc|gmt|z|coordinated universal time)$/i, 'UTC'],
  [/^(bst|british summer time)$/i, 'Europe/London'],
  [/^(cest?|central european( summer)?( time)?)$/i, 'Europe/Paris'],
  [/^(ist|india standard time)$/i, 'Asia/Kolkata'],
  [/^(kst|korea standard time)$/i, 'Asia/Seoul'],
  [/^(jst|japan standard time)$/i, 'Asia/Tokyo'],
  [/^(sgt|singapore time)$/i, 'Asia/Singapore'],
  [/^(aest|aedt|australian eastern( (standard|daylight))?( time)?)$/i, 'Australia/Sydney'],
  [/^(aoe|anywhere on earth)$/i, 'Etc/GMT+12'],
];

// Alternation used by the deadline regex; longest names first.
export const ZONE_PATTERN =
  'Eastern (?:Standard |Daylight )?Time|Central (?:Standard |Daylight )?Time|Mountain (?:Standard |Daylight )?Time|' +
  'Pacific (?:Standard |Daylight )?Time|Eastern|Central|Mountain|Pacific|Coordinated Universal Time|' +
  'Anywhere on Earth|AoE|EDT|EST|ET|CDT|CST|CT|MDT|MST|MT|PDT|PST|PT|UTC|GMT|BST|CEST|CET|IST|KST|JST|SGT|AEST|AEDT';

export function toIanaZone(name) {
  const clean = String(name).trim().replace(/\.$/, '');
  for (const [re, zone] of ZONE_NAMES) if (re.test(clean)) return zone;
  return null;
}

// Offset of `zone` from UTC at instant `ts`, in milliseconds.
export function zoneOffset(ts, zone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ts));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(ts / 1000) * 1000;
}

// Wall-clock time in `zone` -> UTC epoch ms.
export function zonedToEpoch(year, month, day, hour, minute, zone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = zoneOffset(guess, zone);
  let ts = guess - first;
  const second = zoneOffset(ts, zone);
  if (second !== first) ts = guess - second;
  return ts;
}

export function formatInZone(ts, zone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: zone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(ts));
}
