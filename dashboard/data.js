// View-model assembly for the dashboard — pulls from the JSON store + reconciler
// and shapes plain objects the views render. Keeps views dumb and server thin.
import { read } from '../src/core/store.js';
import { reconcile } from '../src/reconcile/payouts.js';
import { latestByPost } from '../src/reconcile/metrics.js';
import { listApps, listAccounts } from '../src/accounts/index.js';
import { isUnlocked } from '../src/vault/index.js';
import { listChannels, NICHE_PRESETS } from '../src/channels/index.js';
import { matchCampaigns } from '../src/channels/match.js';

export function overview() {
  const r = reconcile();
  const posts = read('posts');
  const clips = read('clips');
  const latest = latestByPost();

  // recent posts (newest first)
  const recent = [...posts]
    .sort((a, b) => String(b.postedAt).localeCompare(String(a.postedAt)))
    .slice(0, 12)
    .map((p) => ({ ...p, views: latest.get(p.id)?.views ?? 0 }));

  // per-platform rollup
  const byPlatform = {};
  for (const p of posts) {
    const k = p.platform || 'unknown';
    byPlatform[k] = byPlatform[k] || { platform: k, posts: 0, views: 0 };
    byPlatform[k].posts++;
    byPlatform[k].views += latest.get(p.id)?.views ?? 0;
  }

  return {
    kpis: {
      campaigns: read('campaigns').length,
      sources: read('sources').length,
      clips: clips.length,
      posts: posts.length,
      views: r.totalViews,
      earned: r.totalEarned,
    },
    byCampaign: r.byCampaign,
    byPlatform: Object.values(byPlatform).sort((a, b) => b.views - a.views),
    recent,
  };
}

export function campaigns() {
  return [...read('campaigns')].sort((a, b) => (b.score || 0) - (a.score || 0));
}

export function clipsBySource() {
  const sources = new Map(read('sources').map((s) => [s.id, s]));
  const groups = new Map();
  for (const c of read('clips')) {
    const key = c.sourceId;
    if (!groups.has(key)) groups.set(key, { source: sources.get(key) || { id: key }, clips: [] });
    groups.get(key).clips.push(c);
  }
  for (const g of groups.values()) g.clips.sort((a, b) => a.rank - b.rank);
  return [...groups.values()];
}

export function analytics() {
  const r = reconcile();
  return { byCampaign: r.byCampaign, totals: { views: r.totalViews, earned: r.totalEarned, posts: r.posts } };
}

const DASH_PORT = Number(process.env.DASH_PORT || 4317);
const DASH_HOST = process.env.DASH_HOST || '127.0.0.1';

export function accountsView() {
  return {
    vaultUnlocked: isUnlocked(),
    redirectUri: `http://${DASH_HOST}:${DASH_PORT}/oauth/callback`,
    apps: listApps(),
    accounts: listAccounts(),
  };
}

export function publishView() {
  const clips = read('clips');
  const approved = clips.filter((c) => c.status === 'approved' && c.file);
  const candidates = clips.filter((c) => c.status !== 'rejected' && c.file).length;
  const accounts = listAccounts();
  const posts = read('posts');
  const scheduled = posts.filter((p) => p.status === 'planned' || p.status === 'dry-run');
  const nonCompliant = posts.filter((p) => p.compliant === false);
  const campaigns = new Map(read('campaigns').map((c) => [c.id, c]));
  const submissions = read('submissions').map((s) => ({ ...s, campaign: campaigns.get(s.campaignId)?.title || s.campaignId }));
  const queued = read('schedules').filter((s) => s.status === 'queued').length;
  return { approved, candidates, accounts, scheduled, nonCompliant, submissions, queued, totalPosts: posts.length };
}

export function channelsView() {
  const accounts = new Map(read('accounts').map((a) => [a.id, a]));
  const clips = read('clips');
  const posts = read('posts');
  const latest = latestByPost();
  return {
    niches: NICHE_PRESETS,
    accounts: listAccounts(),
    channels: listChannels().map((ch) => {
      // performance of clips routed to this channel's campaigns/niche
      const chPosts = posts.filter((p) => p.accountId && p.accountId === ch.accountId);
      const views = chPosts.reduce((s, p) => s + (latest.get(p.id)?.views ?? 0), 0);
      return {
        ...ch,
        account: ch.accountId ? accounts.get(ch.accountId) || null : null,
        research: matchCampaigns(ch, { limit: 6 }),
        stats: { posts: chPosts.length, views, clips: clips.filter((c) => c.channelId === ch.id).length },
      };
    }),
  };
}

export function settingsView() {
  return {
    vaultUnlocked: isUnlocked(),
    llmConfigured: !!(process.env.LLM_API_KEY || true), // borrowed at call time
    liveGate: process.env.CLIPFARM_PUBLISH_LIVE === '1',
    cadence: { dailyCap: 3, minGapHours: 3 },
  };
}
