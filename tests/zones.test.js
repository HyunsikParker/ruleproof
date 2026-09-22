import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toIanaZone, zonedToEpoch } from '../src/zones.js';

test('zone names map to IANA zones', () => {
  assert.equal(toIanaZone('EDT'), 'America/New_York');
  assert.equal(toIanaZone('Eastern Time'), 'America/New_York');
  assert.equal(toIanaZone('PT'), 'America/Los_Angeles');
  assert.equal(toIanaZone('UTC'), 'UTC');
  assert.equal(toIanaZone('KST'), 'Asia/Seoul');
  assert.equal(toIanaZone('Mars Time'), null);
});

test('ET resolves to daylight time in summer and standard time in winter', () => {
  // Oct 26 is still EDT (UTC-4); Dec 1 is EST (UTC-5).
  assert.equal(new Date(zonedToEpoch(2026, 10, 26, 17, 0, 'America/New_York')).toISOString(), '2026-10-26T21:00:00.000Z');
  assert.equal(new Date(zonedToEpoch(2026, 12, 1, 17, 0, 'America/New_York')).toISOString(), '2026-12-01T22:00:00.000Z');
});

test('Pacific and Seoul conversions', () => {
  assert.equal(new Date(zonedToEpoch(2026, 10, 28, 13, 0, 'America/Los_Angeles')).toISOString(), '2026-10-28T20:00:00.000Z');
  assert.equal(new Date(zonedToEpoch(2026, 10, 27, 6, 0, 'Asia/Seoul')).toISOString(), '2026-10-26T21:00:00.000Z');
});
