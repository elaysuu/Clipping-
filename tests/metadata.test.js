import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMetadata } from '../src/publish/metadata.js';

const clip = { caption: 'A billionaire told me this life changing advice', hook: 'He said one thing' };

test('youtube metadata: title capped, #shorts present, tags derived', () => {
  const m = buildMetadata(clip, { platform: 'youtube' });
  assert.ok(m.title.length <= 100);
  assert.match(m.description, /#shorts/);
  assert.ok(m.tags.includes('billionaire'));
  assert.equal(m.platform, 'youtube');
});

test('tiktok metadata uses fyp/viral discovery tags', () => {
  const m = buildMetadata(clip, { platform: 'tiktok' });
  assert.match(m.description, /#fyp/);
});

test('genre from campaign seeds a tag', () => {
  const m = buildMetadata(clip, { platform: 'youtube', campaign: { genre: 'streamer' } });
  assert.ok(m.tags.includes('streamer'));
});
