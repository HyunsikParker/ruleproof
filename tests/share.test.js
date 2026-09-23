import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookmarklet, parseImport, deadlineIcs } from '../src/share.js';

test('bookmarklet is a javascript: URL that targets the app with src and rules', () => {
  const b = bookmarklet('https://example.org/app/');
  assert.ok(b.startsWith('javascript:'));
  const code = decodeURIComponent(b.slice('javascript:'.length));
  assert.match(code, /https:\/\/example\.org\/app\/"\+'#src='/);
  assert.match(code, /document\.body\.innerText/);
  assert.doesNotThrow(() => new Function(code));
});

test('import hash round-trips long rules text with special characters', () => {
  const rules = 'Deadline: Oct 26, 2026 @ 5:00pm EDT\nMust include scope.md & prd.md; 100% original.\n#hashtag';
  const hash = '#src=' + encodeURIComponent('https://x.devpost.com/rules') + '&rules=' + encodeURIComponent(rules);
  assert.deepEqual(parseImport(hash), { rules, src: 'https://x.devpost.com/rules' });
  assert.equal(parseImport('#other=1'), null);
  assert.equal(parseImport(''), null);
});

test('ics: event ends at the deadline in UTC with 24 h and 2 h alarms', () => {
  const ics = deadlineIcs({ epochMs: Date.parse('2026-10-26T21:00:00Z'), label: 'Oct 26, 2026, 5:00 PM EDT', title: 'Build With AI; Basics', url: 'https://learn-ai-basics.devpost.com/rules', now: Date.parse('2026-09-23T00:00:00Z') });
  assert.match(ics, /DTEND:20261026T210000Z\r\n/);
  assert.match(ics, /DTSTART:20261026T203000Z\r\n/);
  assert.match(ics, /TRIGGER:-PT24H/);
  assert.match(ics, /TRIGGER:-PT2H/);
  assert.match(ics, /SUMMARY:Deadline: Build With AI\; Basics/);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal(deadlineIcs({ epochMs: null, label: 'x' }), null);
});

test('running the bookmarklet opens the app with the page URL and text', () => {
  const code = decodeURIComponent(bookmarklet('https://example.org/app/').slice('javascript:'.length));
  let opened = null;
  const run = new Function('document', 'location', 'window', code);
  run({ body: { innerText: 'You must include README.md' } }, { href: 'https://x.devpost.com/rules' }, { open: (u) => { opened = u; } });
  assert.ok(opened.startsWith('https://example.org/app/#src='));
  assert.deepEqual(parseImport(opened.slice(opened.indexOf('#'))), { rules: 'You must include README.md', src: 'https://x.devpost.com/rules' });
});
