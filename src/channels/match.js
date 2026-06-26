// Smart campaign↔channel matching: rank the live campaigns that fit a channel's
// niche + topics, so each page gets its own research feed and clips route to the
// right channel automatically.
import { read } from '../core/store.js';

// niche → campaign genres it should pull from (radar tags genre: streamer|podcast|clip|brand|other)
const NICHE_GENRES = {
  streamers: ['streamer', 'clip'],
  gaming: ['streamer', 'clip'],
  sports: ['clip', 'brand'],
  podcasts: ['podcast', 'clip'],
  finance: ['brand', 'clip'],
  brand: ['brand'],
  general: ['clip', 'brand', 'streamer', 'podcast', 'other'],
};

function tokens(s) {
  return new Set(String(s || '').toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 3));
}

// Score how well a campaign fits a channel.
export function scoreFit(channel, campaign) {
  const genres = NICHE_GENRES[channel.niche] || NICHE_GENRES.general;
  let score = 0;
  if (genres.includes(campaign.genre)) score += 3;
  const camp = tokens(campaign.title);
  for (const t of channel.topics || []) {
    for (const w of t.split(/\s+/)) if (w.length >= 3 && camp.has(w)) score += 2;
  }
  // tie-break by ROI so a fit channel still prefers the better-paying campaign
  return score + Math.min(2, (campaign.score || 0) / 60);
}

// Ranked campaigns for one channel (its research feed).
export function matchCampaigns(channel, { limit = 10, minScore = 1 } = {}) {
  return read('campaigns')
    .map((c) => ({ ...c, fit: +scoreFit(channel, c).toFixed(2) }))
    .filter((c) => c.fit >= minScore)
    .sort((a, b) => b.fit - a.fit)
    .slice(0, limit);
}

// Given a clip (with its campaign), which channels best fit it (for routing)?
export function channelsForClip(clip) {
  const campaign = clip.campaignId ? read('campaigns').find((c) => c.id === clip.campaignId) : null;
  if (!campaign) return read('channels');
  return read('channels')
    .map((ch) => ({ channel: ch, fit: scoreFit(ch, campaign) }))
    .filter((x) => x.fit >= 1)
    .sort((a, b) => b.fit - a.fit)
    .map((x) => x.channel);
}
