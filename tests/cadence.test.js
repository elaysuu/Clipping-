import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canPost } from '../src/publish/cadence.js';

const policy = { dailyCap: 3, minGapHours: 3 };
const now = '2026-06-26T20:00:00Z';

test('allows posting when clear', () => {
  assert.equal(canPost(policy, [], now).ok, true);
});

test('blocks when daily cap reached', () => {
  const today = ['2026-06-26T08:00:00Z', '2026-06-26T12:00:00Z', '2026-06-26T16:00:00Z'];
  const r = canPost(policy, today, now);
  assert.equal(r.ok, false);
  assert.match(r.reason, /daily cap/);
});

test('blocks when min gap not elapsed + reports nextSafeAt', () => {
  const r = canPost(policy, ['2026-06-26T19:00:00Z'], now); // 1h ago < 3h
  assert.equal(r.ok, false);
  assert.match(r.reason, /min gap/);
  assert.ok(r.nextSafeAt);
});

test('allows again after the gap elapses', () => {
  const r = canPost(policy, ['2026-06-26T16:00:00Z'], now); // 4h ago > 3h
  assert.equal(r.ok, true);
});
