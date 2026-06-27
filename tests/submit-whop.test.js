import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.CLIPFARM_VAULT_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

const { buildPacket, loadSelectors, isAnalyticsRejection, SELECTOR_KEYS } = await import('../src/submit/whop.js');

test('buildPacket assembles title/link/image and required caption text', () => {
  const packet = buildPacket({
    submission: { postUrl: 'https://yt/v', analyticsScreenshotPath: '/d.png' },
    clip: { title: 'Insane moment', hook: 'wow' },
    campaign: { rules: { overlays: { requiredCaptionText: 'watch full @creator' } } },
  });
  assert.equal(packet.title, 'Insane moment');
  assert.equal(packet.link, 'https://yt/v');
  assert.equal(packet.demographicsImage, '/d.png');
  assert.ok(packet.caption.toLowerCase().includes('watch full @creator'));
});

test('loadSelectors provides every required selector key', () => {
  const sel = loadSelectors();
  for (const k of SELECTOR_KEYS) assert.ok(sel[k], `missing selector ${k}`);
});

test('isAnalyticsRejection matches the analytics-request rejection', () => {
  assert.equal(isAnalyticsRejection('Please send your full analytics / demographics'), true);
  assert.equal(isAnalyticsRejection('Approved — payout queued'), false);
});
