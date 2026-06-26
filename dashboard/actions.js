// Dashboard write-actions: form POSTs + the OAuth connect/callback. Thin glue
// over the services; never logs or echoes secrets.
import { addOAuthApp, beginConnect, completeConnect } from '../src/accounts/index.js';
import { read, upsert } from '../src/core/store.js';
import { publishClipMulti } from '../src/publish/index.js';
import { recordMetric } from '../src/reconcile/metrics.js';
import { log } from '../src/core/log.js';

// GET /accounts/connect?appId=  → bounce to Google consent
export function connect(url, redirect, res) {
  const appId = url.searchParams.get('appId');
  const { url: authUrl } = beginConnect(appId);
  return redirect(res, authUrl);
}

// GET /oauth/callback?code=&state= → finish the connection
export async function oauthCallback(url, redirect, res) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return redirect(res, '/accounts?err=missing_code');
  try {
    const acct = await completeConnect({ state, code });
    log.info('accounts: connected', { account: acct.id, name: acct.displayName });
    return redirect(res, '/accounts?ok=connected');
  } catch (e) {
    log.error('accounts: connect failed', { err: e.message });
    return redirect(res, '/accounts?err=' + encodeURIComponent(e.message.slice(0, 60)));
  }
}

export const POST = {
  // Register a per-channel OAuth app (Client ID/Secret → vault).
  '/accounts/app': (b) => {
    addOAuthApp({ provider: 'youtube', label: b.label, clientId: b.clientId, clientSecret: b.clientSecret, redirectUri: b.redirectUri });
    return '/accounts?ok=app_added';
  },

  // Edit a clip's hook/caption + set review status.
  '/studio/clip': (b) => {
    const patch = { id: b.id };
    if (b.hook != null) patch.hook = b.hook;
    if (b.caption != null) patch.caption = b.caption;
    if (b.status) patch.status = b.status; // candidate|approved|rejected
    upsert('clips', patch);
    return '/studio';
  },

  // Plan dry-run posts for approved clips across selected accounts/platforms.
  '/publish/plan': async (b) => {
    const platforms = (b.platforms ? String(b.platforms).split(',') : ['youtube']).filter(Boolean);
    const approved = read('clips').filter((c) => c.status === 'approved' && c.file);
    for (const clip of approved) await publishClipMulti(clip.id, { platforms, mode: 'dry-run' });
    return '/publish?ok=planned';
  },

  // Toggle an account's live-enabled flag (UI affordance; live still env-gated).
  '/accounts/live': (b) => {
    upsert('accounts', { id: b.id, liveEnabled: b.on === '1' });
    return '/accounts';
  },

  // Manually record a view metric for a post (until auto-sync lands).
  '/metrics/record': (b) => {
    recordMetric(b.postId, { views: Number(b.views) || 0, likes: Number(b.likes) || 0, comments: Number(b.comments) || 0 });
    return '/analytics';
  },
};
