import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.CLIPFARM_VAULT_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

const { parseTier1, analyticsReady, captureAnalytics } = await import('../src/submit/analytics.js');

const DEMO = `Audience
United States 40%
United Kingdom 8%
Canada 6%
Australia 4%
Germany 12%`;

test('parseTier1 sums tier-1 country percentages', () => {
  assert.equal(parseTier1(DEMO), 58); // 40+8+6+4
});

test('parseTier1 returns null when no demographics present', () => {
  assert.equal(parseTier1('Overview\nViews 1234\nLikes 5'), null);
});

test('analyticsReady detects rendered demographics', () => {
  assert.equal(analyticsReady(DEMO), true);
  assert.equal(analyticsReady('still loading...'), false);
});

test('captureAnalytics uses injected render and reports tier1Pct', async () => {
  const res = await captureAnalytics({
    platform: 'youtube', postUrl: 'https://youtu.be/abc', profileDir: '/p',
    render: async () => DEMO,
  });
  assert.equal(res.ready, true);
  assert.equal(res.tier1Pct, 58);
});
