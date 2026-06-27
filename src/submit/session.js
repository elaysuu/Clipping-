// src/submit/session.js
// Per-identity browser session (cookie) store. Cookies are credentials, so they
// live only as ciphertext via the existing AES-256-GCM vault — never plaintext on disk.
import { encrypt, decrypt, fingerprint } from '../vault/index.js';
import { read, upsert } from '../core/store.js';

export function saveSession(identity, cookies) {
  const plaintext = JSON.stringify(cookies);
  const enc = encrypt(plaintext);
  const savedAt = new Date().toISOString();
  const fp = fingerprint(plaintext);
  upsert('sessions', { id: identity, enc, fingerprint: fp, savedAt });
  return { id: identity, fingerprint: fp, savedAt };
}

export function loadSession(identity) {
  const row = read('sessions').find((s) => s.id === identity);
  if (!row) return null;
  return JSON.parse(decrypt(row.enc));
}

export function listSessions() {
  return read('sessions').map(({ id, fingerprint: fp, savedAt }) => ({ id, fingerprint: fp, savedAt }));
}
