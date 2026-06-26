// Payout Reconciler: turn the latest view counts into estimated earnings using
// each clip's campaign CPM, then roll up per campaign and overall. Records a
// `payouts` snapshot row per post so earnings history is auditable.
import { read, upsert } from '../core/store.js';
import { latestByPost } from './metrics.js';

export function reconcile() {
  const clips = new Map(read('clips').map((c) => [c.id, c]));
  const campaigns = new Map(read('campaigns').map((c) => [c.id, c]));
  const posts = read('posts');
  const latest = latestByPost();

  const byCampaign = new Map();
  let totalViews = 0, totalEarned = 0;

  for (const post of posts) {
    const m = latest.get(post.id);
    if (!m) continue;
    const clip = clips.get(post.clipId);
    const campaign = clip?.campaignId ? campaigns.get(clip.campaignId) : null;
    const cpm = campaign?.cpm || 0;
    const earned = +((m.views / 1000) * cpm).toFixed(2);
    totalViews += m.views;
    totalEarned += earned;

    upsert('payouts', {
      id: `pay_${post.id}`, postId: post.id, clipId: post.clipId,
      campaignId: campaign?.id || null, views: m.views, cpm, amount: earned,
      at: new Date().toISOString(),
    });

    const key = campaign?.id || 'unattributed';
    const agg = byCampaign.get(key) || { campaign: campaign?.title || '(none)', cpm, posts: 0, views: 0, earned: 0 };
    agg.posts += 1; agg.views += m.views; agg.earned = +(agg.earned + earned).toFixed(2);
    byCampaign.set(key, agg);
  }

  return {
    totalViews,
    totalEarned: +totalEarned.toFixed(2),
    posts: posts.length,
    withMetrics: [...latest.keys()].length,
    byCampaign: [...byCampaign.values()].sort((a, b) => b.earned - a.earned),
  };
}
