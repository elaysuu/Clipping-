import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.CLIPFARM_VAULT_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

const { getRules, setRules, checkCompliance } = await import('../src/campaigns/compliance.js');

test('getRules deep-merges new universal fields with defaults', () => {
  const r = getRules({ rules: { overlays: { requiredCaptionText: 'watch full @x' } } });
  assert.equal(r.overlays.requiredCaptionText, 'watch full @x');
  assert.equal(r.overlays.watermark.position, 'br');     // default preserved
  assert.deepEqual(r.audience.tier1, ['US', 'UK', 'CA', 'AU']);
});

test('checkCompliance flags missing watermark, caption text, bio link, wrong source, ai edit', () => {
  const campaign = { rules: {
    overlays: { watermark: { url: 'wm.png' }, requiredCaptionText: 'watch full @creator' },
    bioLink: { required: true, url: 'x.com/abc', pageTypes: ['dedicated'] },
    source: { mode: 'single-video', footageUrl: 'https://yt/ALLOWED' },
    quality: { allowAiEdits: false, banned: ['opus'] },
  } };
  const res = checkCompliance({
    clip: { dur: 30 }, campaign, platform: 'youtube', caption: 'lol',
    post: { watermarkApplied: false, captionText: 'lol', bioLinkSet: false,
            isDedicatedPage: true, sourceUrl: 'https://yt/OTHER', aiEdited: true },
  });
  const rules = res.violations.map((v) => v.rule);
  assert.ok(rules.includes('watermark'));
  assert.ok(rules.includes('requiredCaptionText'));
  assert.ok(rules.includes('bioLink'));
  assert.ok(rules.includes('source'));
  assert.ok(rules.includes('quality'));
  assert.equal(res.ok, false);
});

test('checkCompliance passes a fully compliant post', () => {
  const campaign = { rules: {
    overlays: { watermark: { url: 'wm.png' }, requiredCaptionText: 'watch full @creator' },
    bioLink: { required: true, url: 'x.com/abc' },
    source: { mode: 'single-video', footageUrl: 'https://yt/ALLOWED' },
    quality: { allowAiEdits: false },
  } };
  const res = checkCompliance({
    clip: { dur: 30 }, campaign, platform: 'youtube',
    caption: 'a clip — watch full @creator',
    post: { watermarkApplied: true, captionText: 'a clip — watch full @creator',
            bioLinkSet: true, isDedicatedPage: true, sourceUrl: 'https://yt/ALLOWED', aiEdited: false },
  });
  assert.equal(res.ok, true, JSON.stringify(res.violations));
});

test('setRules persists the universal nested fields', async () => {
  setRules('cmp_test_universal', {
    minDuration: 10, overlays: { requiredCaptionText: 'watch @c' },
    source: { mode: 'single-video', footageUrl: 'https://yt/X' },
  });
  // round-trip through the store-backed getRules
  const { read } = await import('../src/core/store.js');
  const camp = read('campaigns').find((c) => c.id === 'cmp_test_universal');
  const r = getRules(camp);
  assert.equal(r.overlays.requiredCaptionText, 'watch @c');
  assert.equal(r.source.footageUrl, 'https://yt/X');
});
