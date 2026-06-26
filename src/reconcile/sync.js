// Metrics sync (D6): pull real view counts from YouTube for posted clips, then
// feed the reconciler. Requires a connected account (refresh token in vault).
// Until a channel is connected this no-ops cleanly; manual /metrics/record covers
// the gap. Zero-dep (fetch + vault + oauth refresh).
import { read } from '../core/store.js';
import { getSecret } from '../vault/index.js';
import { refreshAccessToken } from '../oauth/youtube.js';
import { recordMetric } from './metrics.js';
import { log } from '../core/log.js';

function youtubeIdFrom(post) {
  const m = String(post.url || '').match(/(?:shorts\/|v=|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : (post.externalId || null);
}

async function accessTokenFor(account) {
  const app = read('oauthApps').find((a) => a.id === account.oauthAppId);
  if (!app || !account.tokenRef) return null;
  const clientSecret = getSecret(app.clientSecretRef);
  const refreshToken = getSecret(account.tokenRef);
  const tok = await refreshAccessToken({ clientId: app.clientId, clientSecret, refreshToken });
  return tok.access_token || null;
}

export async function syncYouTubeMetrics() {
  const accounts = new Map(read('accounts').map((a) => [a.id, a]));
  const posts = read('posts').filter((p) => p.platform === 'youtube' && p.status === 'posted' && youtubeIdFrom(p));
  if (!posts.length) { log.info('sync: no posted youtube clips to sync'); return { synced: 0 }; }

  // group video ids by account so we mint one access token per account
  const byAccount = new Map();
  for (const p of posts) {
    const key = p.accountId || 'default';
    if (!byAccount.has(key)) byAccount.set(key, []);
    byAccount.get(key).push(p);
  }

  let synced = 0;
  for (const [accId, accPosts] of byAccount) {
    const account = accounts.get(accId);
    if (!account) continue;
    let token;
    try { token = await accessTokenFor(account); } catch (e) { log.warn('sync: token refresh failed', { accId, err: e.message }); continue; }
    if (!token) continue;

    const ids = accPosts.map(youtubeIdFrom);
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.join(',')}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) { log.warn('sync: stats fetch failed', { accId, status: res.status }); continue; }
    const stats = new Map((await res.json()).items?.map((it) => [it.id, it.statistics]) || []);
    for (const p of accPosts) {
      const s = stats.get(youtubeIdFrom(p));
      if (!s) continue;
      recordMetric(p.id, { views: Number(s.viewCount) || 0, likes: Number(s.likeCount) || 0, comments: Number(s.commentCount) || 0 });
      synced++;
    }
  }
  log.info('sync: done', { synced });
  return { synced };
}
