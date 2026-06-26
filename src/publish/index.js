// Publisher: platform-agnostic entry. Loads a clip from the store, builds
// metadata, routes to the platform adapter, and records a `posts` row.
// Outward action is OFF unless explicitly enabled (see youtube.js gating).
import { read, upsert } from '../core/store.js';
import { buildMetadata } from './metadata.js';
import { publishYouTube } from './youtube.js';
import { publishTikTok, publishInstagram } from './stubs.js';
import { log } from '../core/log.js';

const ADAPTERS = {
  youtube: publishYouTube,
  tiktok: publishTikTok,
  instagram: publishInstagram,
};

export async function publishClip({ clipId, platform = 'youtube', account = 'default', mode = 'dry-run', privacyStatus = 'private' }) {
  const clip = read('clips').find((c) => c.id === clipId);
  if (!clip) throw new Error(`publish: clip not found: ${clipId}`);
  const campaign = clip.campaignId ? read('campaigns').find((c) => c.id === clipId.campaignId) : null;

  const adapter = ADAPTERS[platform];
  if (!adapter) throw new Error(`publish: no adapter for ${platform}`);

  const meta = buildMetadata(clip, { platform, campaign });
  const result = await adapter(clip, meta, { mode, privacyStatus });

  const post = upsert('posts', {
    id: `${clipId}_${platform}_${account}`,
    clipId, platform, account, mode,
    status: result.status, url: result.url || null, title: meta.title,
    error: result.error || null, note: result.note || null,
    postedAt: new Date().toISOString(),
  });
  log.info('publish: recorded post', { clipId, platform, status: result.status });
  return { ...result, post };
}

// Fan a clip across multiple platforms (records one post each).
export async function publishClipMulti(clipId, { platforms = ['youtube', 'tiktok', 'instagram'], account = 'default', mode = 'dry-run' } = {}) {
  const out = [];
  for (const platform of platforms) out.push(await publishClip({ clipId, platform, account, mode }));
  return out;
}
