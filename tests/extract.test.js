import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSentences, classify, findFiles, findVideoLimit, findDeadlines, extract, primaryDeadline } from '../src/extract.js';

test('sentences keep offsets into the original text', () => {
  const text = 'Intro line.\nYou must submit a video, e.g. on YouTube. Teams may have 4 people!';
  const parts = splitSentences(text);
  assert.deepEqual(parts.map((p) => p.text), [
    'Intro line.',
    'You must submit a video, e.g. on YouTube.',
    'Teams may have 4 people!',
  ]);
  for (const p of parts) assert.equal(text.slice(p.start, p.end), p.text);
});

test('file names and decimals do not end a sentence', () => {
  const parts = splitSentences('Include scope.md and version 1.5 of the app. Done.');
  assert.equal(parts[0].text, 'Include scope.md and version 1.5 of the app.');
});

test('hard and soft wording', () => {
  assert.deepEqual(classify('Your repository must include a README.'), { category: 'repository', strength: 'hard' });
  assert.deepEqual(classify('The video should show the app running.'), { category: 'video', strength: 'soft' });
  assert.equal(classify('We are excited to see what you build.'), null);
});

test('legal boilerplate is ignored', () => {
  assert.equal(classify('Entrants must indemnify the Sponsor against all claims arising from the submission.'), null);
});

test('files: names with extensions, README, no URLs or frameworks', () => {
  assert.deepEqual(findFiles('Your public repository must include the scope.md, prd.md, and spec.md files.'), ['scope.md', 'prd.md', 'spec.md']);
  assert.deepEqual(findFiles('Include a README with setup steps.'), ['README']);
  assert.deepEqual(findFiles('Built with Node.js, see https://example.com/guide.md for help.'), []);
});

test('video limits in several phrasings', () => {
  assert.deepEqual(findVideoLimit('The video should be less than three (3) minutes.'), { minMinutes: null, maxMinutes: 3 });
  assert.deepEqual(findVideoLimit('A short demo video (1 to 3 minutes).'), { minMinutes: 1, maxMinutes: 3 });
  assert.deepEqual(findVideoLimit('Upload a 2-minute video.'), { minMinutes: null, maxMinutes: 2 });
  assert.deepEqual(findVideoLimit('Recordings must not exceed 90 seconds.'), { minMinutes: null, maxMinutes: 1.5 });
  assert.equal(findVideoLimit('Judging takes three minutes per team.'), null);
});

test('video limit found from the line that introduces it', () => {
  const { items } = extract('The video portion of the Submission:\nshould be less than three (3) minutes\n');
  const video = items.find((i) => i.label.startsWith('Demo video length'));
  assert.ok(video);
  assert.equal(video.limit.maxMinutes, 3);
});

test('deadlines with time zones become UTC instants', () => {
  const [d] = findDeadlines('Deadline: Oct 26, 2026 @ 5:00pm EDT');
  assert.equal(new Date(d.epochMs).toISOString(), '2026-10-26T21:00:00.000Z');
  const [e] = findDeadlines('Submission Period ends at 11:59 PM PT on November 3, 2026.');
  assert.equal(new Date(e.epochMs).toISOString(), '2026-11-04T07:59:00.000Z');
  const [f] = findDeadlines('Submissions are due March 3, 2027 at 12:00 UTC.');
  assert.equal(new Date(f.epochMs).toISOString(), '2027-03-03T12:00:00.000Z');
});

test('submission period picks the end date, judging dates are not deadlines', () => {
  const text = 'Submission Period: September 22, 2026 (10:00 am Eastern Time) – October 26, 2026 (5:00 pm Eastern Time).\nJudging Period: October 27, 2026 (10:00 am Eastern Time) – October 30, 2026 (5:00 pm Eastern Time).';
  const { deadlines } = extract(text);
  assert.equal(deadlines.length, 1);
  assert.equal(new Date(deadlines[0].epochMs).toISOString(), '2026-10-26T21:00:00.000Z');
});

test('primary deadline prefers the latest future one', () => {
  const now = Date.parse('2026-10-01T00:00:00Z');
  const ds = [
    { label: 'a', epochMs: Date.parse('2026-09-01T00:00:00Z') },
    { label: 'b', epochMs: Date.parse('2026-10-26T21:00:00Z') },
  ];
  assert.equal(primaryDeadline(ds, now).label, 'b');
});

test('every extracted item points at its source sentence', () => {
  const text = [
    'Requirements',
    'New project, started from an empty folder during the submission period.',
    'Your public repository must include the scope.md, prd.md, and spec.md files.',
    'Video must be under 3 minutes.',
    'Deadline: Oct 26, 2026 @ 5:00pm EDT',
    'Hackathon Sponsors',
    'Prizes',
  ].join('\n');
  const { items } = extract(text);
  assert.ok(items.length >= 6);
  for (const item of items) {
    assert.equal(text.slice(item.start, item.end), item.quote);
    assert.ok(item.quote.length > 0);
  }
  const labels = items.map((i) => i.label);
  assert.ok(labels.includes('Repository includes spec.md'));
  assert.ok(labels.includes('Repository is publicly readable'));
  assert.ok(!labels.some((l) => /Sponsors|Prizes/.test(l)));
});

test('item ids are stable across runs', () => {
  const text = 'You must include a README.\nThe video must be under 3 minutes.';
  assert.deepEqual(extract(text).items.map((i) => i.id), extract(text).items.map((i) => i.id));
});

test('"not required" reads as soft, and LICENSE becomes a file item', () => {
  assert.deepEqual(classify('A LICENSE file is encouraged but not required.'), { category: 'repository', strength: 'soft' });
  const { items } = extract('A LICENSE file is encouraged but not required.');
  assert.equal(items[0].label, 'Repository includes LICENSE');
  assert.equal(items[0].strength, 'soft');
});

test('"open source license file" asks for a LICENSE', () => {
  assert.deepEqual(findFiles('The repository must be public and should be open source by including an open source license file.'), ['LICENSE']);
});

test('all-caps banners, list intros and text after a blank line are not requirements', () => {
  const text = 'What to Submit\nA short description of the project.\n\nNO PURCHASE OR PAYMENT NECESSARY TO ENTER OR WIN.\nThe Hackathon IS open to:\nOther news about the event.';
  const labels = extract(text).items.map((i) => i.label);
  assert.deepEqual(labels, ['A short description of the project.']);
});

test('"at least a 1-minute clip" is a minimum, not the video limit', () => {
  assert.deepEqual(findVideoLimit('Your demonstration video must include at least a 1-minute clip showing the hardware.'), { minMinutes: 1, maxMinutes: null });
  const text = 'Your demonstration video must include at least a 1-minute clip showing the hardware operating.\nUpload a 3-minute or shorter public YouTube video showing your project working.';
  const video = extract(text).items.find((i) => i.label.startsWith('Demo video length'));
  assert.equal(video.label, 'Demo video length: at most 3 min');
});
