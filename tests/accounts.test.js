import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.CLIPFARM_VAULT_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

const accounts = await import('../src/accounts/index.js');
const { buildAuthUrl } = await import('../src/oauth/youtube.js');

test('addOAuthApp stores secret in vault, exposes only id+fingerprint', () => {
  const app = accounts.addOAuthApp({
    label: 'Channel A', clientId: '123.apps.googleusercontent.com',
    clientSecret: 'FAKE_TEST_SECRET_not_real', redirectUri: 'http://127.0.0.1:4317/oauth/callback',
  });
  assert.ok(app.clientSecretRef, 'secret stored by reference');
  assert.equal(app.fingerprint.length, 8);
  // the app row must NOT carry the raw secret
  assert.ok(!JSON.stringify(app).includes('FAKE_TEST_SECRET_not_real'));
  // safe listing also never leaks the secret or its ref value beyond fingerprint
  const listed = accounts.listApps().find((a) => a.id === app.id);
  assert.equal(listed.clientId, '123.apps.googleusercontent.com');
  assert.ok(!('clientSecret' in listed));
});

test('beginConnect builds a valid Google consent URL bound to a state', () => {
  const app = accounts.addOAuthApp({
    label: 'B', clientId: 'cid-b', clientSecret: 's', redirectUri: 'http://127.0.0.1:4317/oauth/callback',
  });
  const { url, state } = accounts.beginConnect(app.id);
  assert.match(url, /accounts\.google\.com\/o\/oauth2\/v2\/auth/);
  assert.match(url, /access_type=offline/);
  assert.match(url, /prompt=consent/);
  assert.ok(url.includes(encodeURIComponent('cid-b')));
  assert.ok(url.includes(state));
});

test('completeConnect rejects an unknown state', async () => {
  await assert.rejects(() => accounts.completeConnect({ state: 'bogus', code: 'x' }), /invalid\/expired/);
});

test('buildAuthUrl requests upload + readonly scopes', () => {
  const u = buildAuthUrl({ clientId: 'c', redirectUri: 'r', state: 's' });
  assert.ok(u.includes(encodeURIComponent('youtube.upload')));
  assert.ok(u.includes(encodeURIComponent('youtube.readonly')));
});
