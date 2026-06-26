// Publisher: platform-agnostic entry. Loads a clip from the store, builds
// metadata, routes to the platform adapter, and records a `posts` row.
// Outward action is OFF unless explicitly enabled (see youtube.js gating).
import { read, upsert } from '../core/store.js';
import { buildMetadata } from './metadata.js';
import { publishYouTube } from './youtube.js';
import { publishTikTok, publishInstagram } from './stubs.js';
import { checkCompliance, recordSubmission } from '../campaigns/compliance.js';
import { log } from '../core/log.js';

const ADAPTERS = {
  youtube: publishYouTube,
  tiktok: publishTikTok,
  instagram: publishInstagram,
};

export async function publishClip({ clipId, platform = 'youtube', account = 'default', mode = 'dry-run', privacyStatus = 'private' }) {
  const clip = read('clips').find((c) => c.id === clipId);
  if (!clip) throw new Error(`publish: clip not found: ${clipId}`);
  const campaign = clip.campaignId ? read('campaigns').find((c) => c.id === clip.campaignId) : null;

  const adapter = ADAPTERS[platform];
  if (!adapter) throw new Error(`publish: no adapter for ${platform}`);

  const meta = buildMetadata(clip, { platform, campaign });

  // Money-critical: a clip that breaks the campaign's rules earns $0. Check first.
  const compliance = checkCompliance({ clip, campaign, platform, caption: meta.description });
  if (!compliance.ok) log.warn('publish: compliance violations', { clipId, platform, violations: compliance.violations });

  const result = await adapter(clip, meta, { mode, privacyStatus });

  const post = upsert('posts', {
    id: `${clipId}_${platform}_${account}`,
    clipId, platform, account, mode, campaignId: campaign?.id || null,
    status: result.status, url: result.url || null, title: meta.title,
    compliant: compliance.ok, violations: compliance.violations,
    error: result.error || null, note: result.note || null,
    postedAt: new Date().toISOString(),
  });

  // When a real post lands with a URL, register it for campaign payout attribution.
  if (result.status === 'posted' && result.url && campaign) {
    recordSubmission({ postId: post.id, clipId, campaignId: campaign.id, url: result.url, status: 'submitted' });
  }
  log.info('publish: recorded post', { clipId, platform, status: result.status, compliant: compliance.ok });
  return { ...result, post, compliance };
}

// Fan a clip across multiple platforms (records one post each).
export async function publishClipMulti(clipId, { platforms = ['youtube', 'tiktok', 'instagram'], account = 'default', mode = 'dry-run' } = {}) {
  const out = [];
  for (const platform of platforms) out.push(await publishClip({ clipId, platform, account, mode }));
  return out;
}
