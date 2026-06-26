// Accounts service — ties oauthApps + vault + accounts together.
// Each channel gets its OWN Client ID/Secret (1:1, per operator's choice), which
// sidesteps the YouTube per-project quota ceiling. Secrets live only in the vault.
import crypto from 'node:crypto';
import { read, upsert, write } from '../core/store.js';
import { putSecret, getSecret, fingerprint } from '../vault/index.js';
import { buildAuthUrl, exchangeCode, fetchChannel, SCOPES } from '../oauth/youtube.js';

// Register an OAuth app (one per channel). Stores the Client Secret in the vault;
// only the Client ID + a vault ref + fingerprint live in the store.
export function addOAuthApp({ provider = 'youtube', label, clientId, clientSecret, redirectUri }) {
  if (!clientId || !clientSecret || !redirectUri) throw new Error('accounts: clientId, clientSecret, redirectUri required');
  const secretRef = putSecret({ kind: 'oauth-client-secret', provider }, clientSecret);
  return upsert('oauthApps', {
    provider, label: label || clientId.slice(0, 18),
    clientId, clientSecretRef: secretRef, redirectUri, scopes: SCOPES,
    fingerprint: fingerprint(clientSecret), status: 'active',
    createdAt: new Date().toISOString(), lastUsedAt: null,
  });
}

// Step 1 of connect: make a consent URL bound to a one-time state.
export function beginConnect(appId) {
  const app = read('oauthApps').find((a) => a.id === appId);
  if (!app) throw new Error(`accounts: no oauth app ${appId}`);
  const state = crypto.randomBytes(16).toString('hex');
  upsert('oauthPending', { id: state, appId, createdAt: new Date().toISOString() });
  return { url: buildAuthUrl({ clientId: app.clientId, redirectUri: app.redirectUri, state }), state };
}

// Step 2: the OAuth callback. Validates state, exchanges the code, stores the
// refresh token in the vault, and creates the account record.
export async function completeConnect({ state, code }) {
  const pending = read('oauthPending').find((p) => p.id === state);
  if (!pending) throw new Error('accounts: invalid/expired OAuth state');
  const app = read('oauthApps').find((a) => a.id === pending.appId);
  if (!app) throw new Error('accounts: oauth app vanished');

  const clientSecret = getSecret(app.clientSecretRef);
  const tok = await exchangeCode({ clientId: app.clientId, clientSecret, code, redirectUri: app.redirectUri });
  const channel = (await fetchChannel(tok.access_token)) || {};
  const tokenRef = tok.refresh_token
    ? putSecret({ kind: 'refresh-token', provider: app.provider, oauthAppId: app.id }, tok.refresh_token)
    : null;

  const account = upsert('accounts', {
    provider: app.provider, platform: app.provider, oauthAppId: app.id,
    displayName: channel.displayName || 'YouTube channel',
    externalAccountId: channel.externalAccountId || null, handle: channel.handle || null,
    avatarUrl: channel.avatarUrl || null, tokenRef, scopes: app.scopes,
    status: tokenRef ? 'connected' : 'needs-reconnect',
    dryRunDefault: true, liveEnabled: false, dailyCap: 3,
    lastPostAt: null, nextSafePostAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });

  // consume the one-time state
  write('oauthPending', read('oauthPending').filter((p) => p.id !== state));
  upsert('oauthApps', { id: app.id, lastUsedAt: new Date().toISOString() });
  return account;
}

// Safe listings for the UI (never expose secrets/refs beyond the fingerprint).
export function listApps() {
  return read('oauthApps').map((a) => ({ id: a.id, provider: a.provider, label: a.label, clientId: a.clientId, fingerprint: a.fingerprint, status: a.status, redirectUri: a.redirectUri }));
}
export function listAccounts() {
  return read('accounts').map(({ tokenRef, ...rest }) => ({ ...rest, connected: !!tokenRef }));
}
