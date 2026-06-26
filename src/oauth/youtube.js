// YouTube/Google OAuth 2.0 — zero-dep (fetch only). Builds the consent URL and
// exchanges/refreshes tokens server-side. Secrets are passed in by the caller
// (resolved from the vault) and never logged here.
const AUTH_EP = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_EP = 'https://oauth2.googleapis.com/token';

// Upload + read-own-channel scopes. youtube.upload = post videos; youtube.readonly
// = read channel/video stats for the reconciler.
export const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];

export function buildAuthUrl({ clientId, redirectUri, state, scopes = SCOPES }) {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',   // get a refresh token
    prompt: 'consent',        // force refresh-token issuance on reconnect
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_EP}?${q}`;
}

export async function exchangeCode({ clientId, clientSecret, code, redirectUri }) {
  const res = await fetch(TOKEN_EP, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  if (!res.ok) throw new Error(`oauth: token exchange failed (${res.status})`);
  return res.json(); // { access_token, refresh_token, expires_in, scope, token_type }
}

export async function refreshAccessToken({ clientId, clientSecret, refreshToken }) {
  const res = await fetch(TOKEN_EP, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  if (!res.ok) throw new Error(`oauth: token refresh failed (${res.status})`);
  return res.json(); // { access_token, expires_in, scope, token_type }
}

// Fetch the connected channel's identity (to name the account card).
export async function fetchChannel(accessToken) {
  const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`oauth: channel fetch failed (${res.status})`);
  const data = await res.json();
  const ch = data.items?.[0];
  return ch ? { externalAccountId: ch.id, displayName: ch.snippet?.title, handle: ch.snippet?.customUrl, avatarUrl: ch.snippet?.thumbnails?.default?.url } : null;
}
