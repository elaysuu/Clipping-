// Record view/engagement samples for a post over time. The latest sample per
// post is what the payout reconciler multiplies by the campaign CPM.
import { read, upsert } from '../core/store.js';

export function recordMetric(postId, { views = 0, likes = 0, comments = 0 } = {}) {
  return upsert('metrics', {
    id: `${postId}_${Date.now().toString(36)}`,
    postId, views, likes, comments, at: new Date().toISOString(),
  });
}

// Latest sample per post.
export function latestByPost() {
  const byPost = new Map();
  for (const m of read('metrics')) {
    const cur = byPost.get(m.postId);
    if (!cur || m.at > cur.at) byPost.set(m.postId, m);
  }
  return byPost;
}
