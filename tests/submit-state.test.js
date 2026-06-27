import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.CLIPFARM_VAULT_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

const { createSubmission, advance, due, STATES } = await import('../src/submit/state.js');

test('createSubmission starts drafted with a deterministic id', () => {
  const s = createSubmission({ campaignId: 'c1', clipId: 'clipA', platform: 'youtube' });
  assert.equal(s.id, 'sub_clipA_youtube');
  assert.equal(s.status, 'drafted');
  assert.equal(s.postUrl, null);
});

test('advance walks the happy path drafted→paid', () => {
  createSubmission({ campaignId: 'c1', clipId: 'clipB', platform: 'youtube' });
  const id = 'sub_clipB_youtube';
  advance(id, 'compliant');
  advance(id, 'post', { postUrl: 'https://yt/v', postedAt: '2026-06-27T00:00:00Z' });
  advance(id, 'await', { nextActionAt: 1 });
  const a = advance(id, 'analytics', { analyticsScreenshotPath: '/x.png', tier1Pct: 55 });
  assert.equal(a.tier1Pct, 55);
  advance(id, 'submit');
  advance(id, 'support');
  advance(id, 'approve');
  const paid = advance(id, 'pay');
  assert.equal(paid.status, 'paid');
});

test('reject then resend returns to support-sent', () => {
  createSubmission({ campaignId: 'c1', clipId: 'clipC', platform: 'youtube' });
  const id = 'sub_clipC_youtube';
  ['compliant', 'post', 'await', 'analytics', 'submit', 'support'].forEach((e) => advance(id, e));
  advance(id, 'reject');
  const r = advance(id, 'resend');
  assert.equal(r.status, 'support-sent');
});

test('invalid transition throws', () => {
  createSubmission({ campaignId: 'c1', clipId: 'clipD', platform: 'youtube' });
  assert.throws(() => advance('sub_clipD_youtube', 'pay'), /bad transition/);
});

test('due excludes terminal submissions and respects nextActionAt', () => {
  createSubmission({ campaignId: 'c1', clipId: 'clipE', platform: 'youtube' });
  advance('sub_clipE_youtube', 'compliant', { nextActionAt: Date.now() + 1e9 });
  const ids = due(Date.now()).map((s) => s.id);
  assert.ok(!ids.includes('sub_clipE_youtube'));
  assert.ok(Array.isArray(STATES) && STATES.includes('paid'));
});
