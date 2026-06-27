import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.CLIPFARM_VAULT_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

const { createSubmission, advance } = await import('../src/submit/state.js');
const { read } = await import('../src/core/store.js');
const { submitTick } = await import('../src/submit/index.js');

test('submitTick captures ready analytics and advances the submission', async () => {
  createSubmission({ campaignId: 'c1', clipId: 'tickA', platform: 'youtube' });
  const id = 'sub_tickA_youtube';
  advance(id, 'compliant');
  advance(id, 'post', { postUrl: 'https://youtu.be/abc' });
  advance(id, 'await');
  const res = await submitTick({
    capture: async () => ({ ready: true, tier1Pct: 61, text: 'US 61%' }),
  });
  assert.ok(res.advanced >= 1);
  const row = read('submissions').find((s) => s.id === id);
  assert.equal(row.status, 'analytics-captured');
  assert.equal(row.tier1Pct, 61);
});

test('submitTick leaves not-ready analytics waiting and pushes nextActionAt', async () => {
  createSubmission({ campaignId: 'c1', clipId: 'tickB', platform: 'youtube' });
  const id = 'sub_tickB_youtube';
  advance(id, 'compliant');
  advance(id, 'post', { postUrl: 'https://youtu.be/def' });
  advance(id, 'await');
  const res = await submitTick({
    now: 1000, capture: async () => ({ ready: false, tier1Pct: null, text: 'loading' }),
  });
  assert.ok(res.waiting >= 1);
  const row = read('submissions').find((s) => s.id === id);
  assert.equal(row.status, 'awaiting-analytics');
  assert.ok(row.nextActionAt > 1000);
});
