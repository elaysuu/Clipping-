// View-model assembly for the dashboard — pulls from the JSON store + reconciler
// and shapes plain objects the views render. Keeps views dumb and server thin.
import { read } from '../src/core/store.js';
import { reconcile } from '../src/reconcile/payouts.js';
import { latestByPost } from '../src/reconcile/metrics.js';

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
