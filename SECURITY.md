# Security

ClipFarm is a single-operator, locally-run tool that handles OAuth credentials.
Its design keeps secrets off the public surface.

## What never touches git
`.env*`, the credential vault, the vault master key, OAuth client secrets, refresh/
access tokens, sessions, and all of `data/` and `logs/` are git-ignored. Even the
**encrypted** vault is excluded. Verify before publishing:
```bash
git ls-files | grep -iE '\.env$|\.key$|credentialVault|vault\.key'   # must be empty
```

## Credential vault
- OAuth client secrets and refresh tokens are stored AES-256-GCM encrypted; the
  store holds only references + a non-reversible fingerprint, never plaintext.
- Master key comes from `CLIPFARM_VAULT_KEY` (preferred) or a generated
  `~/.clipfarm/vault.key` (mode 0600). It NEVER lives in the repo.
- **Back up the key** (`node bin/vault-key.js backup`) — losing it means every
  channel must be reconnected.
- Secrets are decrypted in memory only at API-call time; never logged, returned by
  an API, or rendered in the browser. A `redact()` filter scrubs logs.

## Dashboard
- Binds `127.0.0.1` by default. If you expose it (e.g. over Tailscale), set
  `CLIPFARM_PIN` to require a login. Sessions are HttpOnly, SameSite=Strict cookies.
- Security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`.

## Publishing
- Dry-run is the default everywhere. Live upload requires BOTH
  `CLIPFARM_PUBLISH_LIVE=1` and a per-account live toggle, and defaults to `private`.

## Reporting
This is a personal project; open an issue for anything that looks unsafe.
