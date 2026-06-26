import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { join } from 'node:path';

// Deterministic master key for the test (never a real one).
process.env.CLIPFARM_VAULT_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

const vault = await import('../src/vault/index.js');
const { PATHS } = await import('../src/core/config.js');

test('encrypt/decrypt round-trips', () => {
  const enc = vault.encrypt('super-secret-client-secret');
  assert.equal(enc.algorithm, 'aes-256-gcm');
  assert.equal(vault.decrypt(enc), 'super-secret-client-secret');
});

test('tampered ciphertext fails authentication (GCM)', () => {
  const enc = vault.encrypt('x');
  enc.ciphertext = Buffer.from('tampered').toString('base64');
  assert.throws(() => vault.decrypt(enc));
});

test('putSecret stores ciphertext only — no plaintext on disk', () => {
  const plain = 'PLAINTEXT_NEEDLE_' + 'abc123XYZ';
  const ref = vault.putSecret({ kind: 'oauth-client-secret', provider: 'youtube' }, plain);
  assert.ok(ref);
  assert.equal(vault.getSecret(ref), plain);
  const raw = fs.readFileSync(join(PATHS.state, 'credentialVault.json'), 'utf8');
  assert.ok(!raw.includes(plain), 'plaintext must NOT appear in the store file');
});

test('fingerprint is short, deterministic, non-reversible', () => {
  assert.equal(vault.fingerprint('abc'), vault.fingerprint('abc'));
  assert.equal(vault.fingerprint('abc').length, 8);
  assert.notEqual(vault.fingerprint('abc'), 'abc');
});

test('redact scrubs secret-bearing keys', () => {
  const r = vault.redact({ clientId: 'ok', client_secret: 'NOPE', nested: { refresh_token: 'NOPE' } });
  assert.equal(r.clientId, 'ok');
  assert.equal(r.client_secret, '«redacted»');
  assert.equal(r.nested.refresh_token, '«redacted»');
});
