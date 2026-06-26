#!/usr/bin/env node
// Vault master-key management. The key encrypts every OAuth secret/token — if you
// lose it, all connected channels must be reconnected. BACK IT UP.
//   node bin/vault-key.js status   → where the key lives (no key shown)
//   node bin/vault-key.js backup    → PRINT the key hex to copy into a password manager
import { keyInfo, exportKeyHex } from '../src/vault/index.js';

const cmd = process.argv[2] || 'status';

if (cmd === 'status') {
  const i = keyInfo();
  console.log(`vault key source : ${i.source}`);
  console.log(`location         : ${i.location}`);
  console.log(`present          : ${i.present}`);
  if (i.source === 'file') console.log('\n⚠  Back this up: `node bin/vault-key.js backup` → store in a password manager.');
  if (i.source === 'none') console.log('\n⚠  No key yet. Set CLIPFARM_VAULT_KEY=$(openssl rand -hex 32), or one is auto-created on first vault use.');
} else if (cmd === 'backup') {
  console.error('# SENSITIVE — store this 64-hex key in a password manager. Anyone with it can decrypt your tokens.');
  console.log(exportKeyHex());
  console.error('# Restore later with:  export CLIPFARM_VAULT_KEY=<the key above>');
} else {
  console.error('usage: vault-key.js [status|backup]');
  process.exit(1);
}
