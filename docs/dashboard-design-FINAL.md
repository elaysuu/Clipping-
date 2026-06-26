# ClipFarm Dashboard — FINAL synthesized design (build contract)

Synthesis of two independent expert designs (Claude = expert A, Codex/gpt-5.5 = expert B),
red-teamed before commit. Source docs: `dashboard-design-claude.md`, `dashboard-design-codex.md`.

## Consensus (both experts agreed → high confidence, build as-is)
- **IA / nav:** Overview(Command) · Accounts · Campaigns · Studio(Source→Clip review) · Publish/Queue · Analytics · Settings.
- **Read-only dashboard ships first** (value over existing store, zero security surface).
- **Vault:** AES-256-GCM, master key OUTSIDE git (`CLIPFARM_VAULT_KEY` env, else `~/.clipfarm/vault.key` 0600). Secrets never logged, never returned by an API, never re-rendered after save, never sent to the browser. Show only a **fingerprint** `sha256(secret).slice(0,8)` so the operator recognizes which key is which.
- **One clip → many posts.** Three distinct states on Publish: Approved clips · Scheduled posts · Executed posts (dry-run/posted/failed/needs-account).
- **Dry-run is the global default; live is gated** (env flag + per-account toggle + explicit confirm modal naming accounts/platform/count/times). Button says exactly what will happen ("Upload 4 live posts").
- **Conservative cadence + account lanes:** per-account daily cap (start 2–3/day), 2–4h min spacing, stagger (never simultaneous blast), no same clip twice/account, auto-pause a lane on auth/rate-limit error. Language = "cadence-safe by local rules", NOT "ban-safe".
- **Phased, each phase independently shippable** (see below).
- **Strongest rec (both):** the **Accounts + Vault foundation is the highest-risk module** — build and audit it carefully before any live publishing composes on top.

## Resolved disagreements (red-team verdicts)
1. **Tech stack → adopt Codex's: low-dependency, server-rendered + vanilla-JS islands. No React/Vite/Tailwind build for v1.**
   Red-team of Claude's SPA: a build step + larger dep tree = wider supply-chain + attack surface in a repo that may go **public**, while the riskiest part (credentials/OAuth) is *safest* when rendered server-side with secrets never reaching a client bundle. One operator doesn't need SPA reactivity. Revisit a richer client only if drag/drop scheduling or pivot analytics proves painful. **Claude concedes.**
2. **OAuth app ↔ account → default 1:1 (Elay's explicit choice): each channel gets its OWN Client ID/Secret.**
   This is also the correct *practical* call: it sidesteps the YouTube quota ceiling (one channel can't starve another) and lets each channel upload independently. Data model still *permits* 1:many, but the UI defaults to and nudges 1:1.

## Red-team — gotchas NEITHER design caught (must surface to operator in-UI)
- **🔴 OAuth consent screen must be "Published", not "Testing".** A Google OAuth app left in Testing mode issues refresh tokens that **expire in 7 days** → every channel silently disconnects weekly. The Accounts flow must instruct: set the consent screen to Published, and the dashboard must detect+alarm on token-expiry.
- **🔴 Per-channel GCP setup is real work.** 5 channels = 5 Google Cloud projects, each with YouTube Data API enabled + an OAuth consent screen + a Client ID/Secret. The connect flow must walk the operator through this with a checklist (one-time per channel).
- **🟠 API-uploaded videos may be locked to PRIVATE until the YouTube channel is phone-verified** and the app trusted. Default uploads to `private`; surface this expectation.
- **🟠 TikTok / Instagram auto-post has heavy API gates.** TikTok Content Posting API + Instagram Graph API both require business accounts + app review/audit. Honest UI state: `adapter-stub` / `needs-approval`, not a promise. Unofficial session automation = ban-risky; not default.
- **🟠 5 channels from one datacenter IP + similar content = association/ban-cluster risk** deeper than cadence can fix. Flag honestly; consider per-account posting identity later (out of scope v1).
- **🟠 Vault-locked state.** If the master key isn't present after a reboot, publishing/token-refresh must hard-disable and the dashboard must alarm clearly (not fail silently).

## Data model extensions (merged)
- `oauthApps` {id, provider, label, clientId, clientSecretRef→vault, redirectUri, scopes, fingerprint, status: active|needs-secret|revoked, createdAt, lastUsedAt}
- `accounts` {id, provider, platform, oauthAppId, displayName, externalAccountId, handle, avatarUrl, tokenRef→vault, scopes, status: connected|needs-reconnect|disabled|revoked|stub, dryRunDefault, liveEnabled, cadencePolicyId, dailyCap, lastPostAt, nextSafePostAt, createdAt, updatedAt}
- `credentialVault` {id, kind: oauth-client-secret|refresh-token|provider-token|session-secret, provider, accountId, oauthAppId, ciphertext, iv, authTag, keyId, algorithm: aes-256-gcm, createdAt, rotatedAt}  ← gitignored even though encrypted
- `schedules` {id, postId, clipId, campaignId, accountId, platform, scheduledAt, status}
- `jobs` {id, type: ingest|forge|publish|metrics, refId, status, attempts, runAt, result}  ← state machine
- `auditEvents` {id, at, actor, action, target, meta(NO secrets)}  ← every credential/account/live action
- extend `posts` with `accountId`, `scheduledFor`.

## Security (merged, hard rules)
- Server binds `127.0.0.1`/Tailscale only; a local **PIN/session** required (mandatory on Tailscale).
- OAuth: random `state` per attempt + PKCE where supported; validate state before code↔token exchange; exchange + refresh are **server-side only**; per-account refresh tokens (refresh is per-account, not global).
- `.gitignore`: `data/state/credentialVault*.json`, `data/secrets/`, `.clipfarm/`, `.env*`, `oauth-debug*.json`, `sessions/`. A pre-commit secret scan stays on.
- Redaction middleware: no secret in logs, API responses, audit meta, or post-save UI.

## Architecture shape (modules)
`dashboard/server` (routes+views+API) · `dashboard/views` (HTML template fns) · `dashboard/public` (CSS + JS islands) · `services/vault` · `services/oauth` · `services/accounts` · `services/scheduler` (cadence) · `services/jobs` (queue) · `services/analytics` (segment queries) — all on the existing JSON store.

## Phased build order (each shippable; gate each on it actually working)
- **D1 Read-only Command Center** — Overview + Campaigns + Sources/Clips + Analytics over existing data. No credential UI. *(value now, zero risk)*
- **D2 Vault + YouTube connect** — encrypted vault, paste Client ID/Secret (per channel), OAuth connect/callback, accounts grid (≤5), token-health checks, audit events. **The audited foundation.**
- **D3 Studio review/edit** — clip preview + transcript, edit hook/title/caption, approve/reject/reforge.
- **D4 Dry-run Publishing Planner** — schedules + jobs + account lanes + cadence validation + blocked-reasons/retry.
- **D5 Gated live YouTube** — wire live adapter behind env gate + per-account live toggle + live-gate UI + upload audit/failure handling.
- **D6 Metrics sync + earnings analytics** — metric sync jobs, reconciler controls, segmentation builder, saved views, CSV export.
- **D7 TikTok/Instagram readiness** — keep stubs visible; add real adapters when API approval exists; reuse the same accounts/schedules/posts model.

## Single strongest recommendation (synthesis)
Build **D1 read-only first** for immediate value at zero risk, then treat **D2 (Vault + Accounts + OAuth)** as a first-class, separately-audited security module — because pasting OAuth credentials is simultaneously the operator's #1 ask and the system's #1 risk. Get the vault, per-account token handling, audit log, and dry-run/live gates right, and every later feature composes safely on top.
