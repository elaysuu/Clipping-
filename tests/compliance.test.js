import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCompliance, getRules, DEFAULT_RULES } from '../src/campaigns/compliance.js';

test('passes a compliant clip', () => {
  const r = checkCompliance({
    clip: { dur: 30, caption: 'great clip #coinbase' },
    campaign: { rules: { minDuration: 10, maxDuration: 60, platforms: ['youtube'], requiredHashtags: ['#coinbase'] } },
    platform: 'youtube',
  });
  assert.equal(r.ok, true);
  assert.equal(r.violations.length, 0);
});

test('flags too-short, wrong-platform, missing hashtag + mention', () => {
  const r = checkCompliance({
    clip: { dur: 3, caption: 'hi' },
    campaign: { rules: { minDuration: 10, platforms: ['tiktok'], requiredHashtags: ['#brand'], requiredMention: '@brand' } },
    platform: 'youtube',
  });
  assert.equal(r.ok, false);
  const rules = r.violations.map((v) => v.rule);
  assert.ok(rules.includes('minDuration'));
  assert.ok(rules.includes('platform'));
  assert.ok(rules.includes('requiredHashtag'));
  assert.ok(rules.includes('requiredMention'));
});

test('defaults apply when a campaign has no rules', () => {
  assert.deepEqual(getRules({}), DEFAULT_RULES);
  assert.equal(checkCompliance({ clip: { dur: 30 }, campaign: {}, platform: 'youtube' }).ok, true);
});
