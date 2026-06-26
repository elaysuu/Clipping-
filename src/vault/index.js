// Credential Vault — the audited security foundation (D2).
// AES-256-GCM envelope encryption. The master key NEVER lives in git: it comes
// from CLIPFARM_VAULT_KEY (hex, 64 chars) or a generated ~/.clipfarm/vault.key
// (0600). Plaintext secrets exist only in memory at call time; the store holds
// ciphertext only. Nothing here logs, returns, or re-renders a secret value.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { join } from 'node:path';
import { read, upsert } from '../core/store.js';

const ALGO = 'aes-256-gcm';
const KEY_DIR = process.env.CLIPFARM_KEY_DIR || join(process.env.HOME || '.', '.clipfarm');
const KEY_FILE = join(KEY_DIR, 'vault.key');
const KEY_ID = 'k1';

let _key = null;

// Load (or, for the file fallback, lazily create) the 32-byte master key.
function loadKey() {
  if (_key) return _key;
  const env = process.env.CLIPFARM_VAULT_KEY;
  if (env) {
    const buf = Buffer.from(env, 'hex');
    if (buf.length !== 32) throw new Error('CLIPFARM_VAULT_KEY must be 64 hex chars (32 bytes)');
    return (_key = buf);
  }
  if (fs.existsSync(KEY_FILE)) {
    const buf = Buffer.from(fs.readFileSync(KEY_FILE, 'utf8').trim(), 'hex');
    if (buf.length !== 32) throw new Error('vault.key is corrupt (expected 32 bytes hex)');
    return (_key = buf);
  }
  // first-run: generate a local key file with strict perms
  fs.mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 });
  const buf = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, buf.toString('hex'), { mode: 0o600 });
  return (_key = buf);
}

// Is a usable master key available? (UI shows accounts but disables publishing
// when the vault is locked.)
export function isUnlocked() {
  try { loadKey(); return true; } catch { return false; }
}

// Where is the master key coming from? (no key material exposed)
export function keyInfo() {
  if (process.env.CLIPFARM_VAULT_KEY) return { source: 'env', location: 'CLIPFARM_VAULT_KEY', present: true };
  if (fs.existsSync(KEY_FILE)) return { source: 'file', location: KEY_FILE, present: true };
  return { source: 'none', location: KEY_FILE, present: false };
}

// Explicit backup export — returns the key hex so the operator can store it in a
// password manager. Sensitive: callers must gate behind an explicit user action.
export function exportKeyHex() {
  return loadKey().toString('hex');
}

export function encrypt(plaintext) {
  const key = loadKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return {
    algorithm: ALGO, keyId: KEY_ID,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ct.toString('base64'),
  };
}

export function decrypt(rec) {
  const key = loadKey();
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(rec.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(rec.authTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(rec.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

// Non-secret recognizer the UI can show so the operator knows WHICH key/secret
// a record is, without exposing it.
export function fingerprint(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest('hex').slice(0, 8);
}

// Store a secret → returns a vault reference id. Only ciphertext touches disk.
export function putSecret({ kind, provider = null, accountId = null, oauthAppId = null }, plaintext) {
  const enc = encrypt(plaintext);
  const rec = upsert('credentialVault', {
    kind, provider, accountId, oauthAppId,
    ...enc, fingerprint: fingerprint(plaintext),
    createdAt: new Date().toISOString(), rotatedAt: null,
  });
  return rec.id;
}

// Resolve a vault reference → plaintext (memory only). Throws if missing/locked.
export function getSecret(ref) {
  const rec = read('credentialVault').find((r) => r.id === ref);
  if (!rec) throw new Error(`vault: no secret for ref ${ref}`);
  return decrypt(rec);
}

// Scrub likely secret-bearing fields before logging an object.
const SECRET_KEYS = /(secret|token|password|client_secret|refresh|authtag|ciphertext|api[_-]?key)/i;
export function redact(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SECRET_KEYS.test(k) ? '«redacted»' : (typeof v === 'object' ? redact(v) : v);
  }
  return out;
}
