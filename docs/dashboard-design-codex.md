# ClipFarm Control Dashboard - UI/UX and Architecture Design

## Executive Position

ClipFarm should become a local command center, not a generic social scheduler. The dashboard's job is to let one operator safely turn campaign opportunities into reviewed clips, scheduled posts, and earnings feedback across up to five controlled accounts.

My strongest product stance: keep the interface operationally dense and safety-first. The owner should always know four things: what campaign is worth working on, which clips are ready, which accounts are safe to publish to, and what each posted clip earned. Avoid a full SaaS-style SPA in the first version. Build a low-dependency local web dashboard on the existing Node ESM backend with progressive enhancement, encrypted credential storage, dry-run defaults, and explicit live-publish gates.

---

## 1. Information Architecture

### Top-Level Navigation

1. **Command**
   - Daily control surface: campaign opportunities, account health, publishing queue, earnings today/week, blocked actions.
   - Why: the owner should not start from raw tables; he needs an operating cockpit.

2. **Campaigns**
   - Campaign Radar, campaign details, ROI score, CPM, remaining budget, allowed platforms, linked sources/clips/posts.
   - Why: money starts at campaign selection. Everything else should inherit campaign context.

3. **Sources and Clips**
   - Source ingestion status, transcript/moment results, clip review, edit metadata, approve/reject, forge status, file preview.
   - Why: quality control lives between LLM detection and publishing; this is the highest leverage manual step.

4. **Publish**
   - Multi-account publishing planner, dry-run/live queue, schedule calendar, cadence limits, platform/account eligibility.
   - Why: publishing is risky and should be isolated from creative review with stronger safety controls.

5. **Accounts**
   - OAuth apps, connected accounts/pages/channels, token health, platform readiness, account cadence rules.
   - Why: credential management is its own high-risk domain; burying it in settings will cause mistakes.

6. **Analytics**
   - Segmentation by campaign, source, clip, post, account, platform, time window, hook, caption style, rank bucket, and earnings.
   - Why: the owner explicitly wants to play with the data; analytics should drive the next batch.

7. **System**
   - Engine jobs, local server exposure mode, env gates, vault status, export/import, audit log, backup health.
   - Why: this is a local/private tool that may become public. Operational safety needs a visible home.

### Global Layout

- Left sidebar with the seven sections above.
- Top bar with global campaign selector, dry-run/live mode indicator, vault lock status, and "Publish gate: Closed/Open".
- Right-side contextual inspector on dense screens: selected campaign, clip, post, account, or job.
- Global search over campaigns, clips, posts, accounts, URLs, hooks, captions.
- Saved views for Analytics and Publish filters.

Design tone: industrial control room, not creator studio. Use compact tables, clear status chips, timeline lanes, and preview panels. Avoid decorative visuals. The memorable design element should be the "Publish Safety Rail": a persistent, explicit control showing dry-run/live state, account cooldowns, and why a post can or cannot go live.

---

## 2. Key Screens

### 2.1 Command

**Purpose**

Give the owner a one-screen daily operating view.

**Main Components**

- KPI strip: estimated earnings, views, clips ready, posts scheduled, failed posts, accounts needing action.
- Campaign Radar panel: top campaigns by ROI score and remaining budget.
- Account grid mini-status: up to five account cards with platform, token health, cooldown, last post, today's posts.
- Queue snapshot: next scheduled posts, blocked posts, dry-run items ready for live approval.
- Alerts: vault locked, OAuth expired, live upload disabled, platform adapter stub, account cadence exceeded.

**Primary Actions**

- Pick a campaign to work.
- Resume a blocked source/clip/job.
- Open Publish planner for ready clips.
- Reconnect a failing account.
- Unlock vault for the current session.

### 2.2 Accounts / Connections

**Purpose**

Let the owner paste his own OAuth Client ID and Secret, store them safely, and connect YouTube channels through OAuth. Prepare the same mental model for TikTok and Instagram later.

**Main Components**

- **Provider Credentials Panel**
  - Provider tabs: YouTube active, TikTok later, Instagram later.
  - Fields: OAuth app label, Client ID, Client Secret, redirect URI preview, scopes required, creation/update timestamp.
  - Save button: "Encrypt and Save OAuth App".
  - Secret display policy: never show saved value; show fingerprint and "replace secret" action.

- **OAuth Connect Flow Card**
  - Step 1: verify local redirect endpoint.
  - Step 2: open provider consent URL.
  - Step 3: receive code on localhost callback.
  - Step 4: exchange code for refresh token.
  - Step 5: fetch channel identity and save account.

- **Five-Account Grid**
  - Cards for account slots 1-5.
  - Each card: avatar/name, platform, channel/page ID, connected OAuth app, token health, permissions, last upload, next safe upload time, live enabled toggle, dry-run default toggle, delete/revoke action.
  - Empty slot CTA: "Connect YouTube Channel".

- **Platform Readiness Matrix**
  - YouTube: connected/live capable.
  - TikTok: stub, needs account.
  - Instagram: stub, needs account.
  - Shows adapter state, missing secrets, missing scopes, and whether live publishing is implemented.

**Primary Actions**

- Paste Client ID/Secret and save encrypted.
- Start OAuth consent.
- Connect or reconnect a channel.
- Set per-account cadence and daily cap.
- Disable live publishing per account.
- Revoke token and remove account.

### 2.3 Campaigns

**Purpose**

Choose the best campaigns and move from opportunity to production.

**Main Components**

- Campaign table with ROI score, CPM, total, paid, remaining, genre, platforms, clip count, posted count, earnings, views, last activity.
- Radar filters: platform eligibility, CPM range, remaining budget, genre, freshness, connected-account compatibility.
- Campaign detail page:
  - Campaign economics.
  - Allowed platforms/accounts.
  - Linked sources.
  - Ready clips.
  - Published posts.
  - Performance summary.
  - "Create Source Batch" / "Review Clips" / "Plan Posts" actions.

**Primary Actions**

- Select campaign.
- Add/import source URL for campaign.
- Prioritize campaign.
- Send approved clips to Publish planner.
- Compare campaign performance.

### 2.4 Source to Clip Review / Edit

**Purpose**

Turn generated clips into publishable assets with human control over viral quality, metadata, and platform fit.

**Main Components**

- Source list: URL, local video path, transcript status, moment detection status, clips generated, errors.
- Review workspace:
  - Vertical video preview.
  - Transcript window with highlighted start/end.
  - Clip metadata editor: hook, title, caption, start, end, duration, campaign, rank, score.
  - Platform fit indicators: duration limits, caption length, title length, content policy notes.
  - Version history: original LLM suggestion, edited metadata, forged file.
  - Decision buttons: approve, reject, needs edit, reforge, split/duplicate.
- Batch review table:
  - Rank, score, hook, duration, source, campaign, file exists, publish status.
  - Bulk approve/reject and bulk assign campaign.

**Primary Actions**

- Preview clip.
- Adjust start/end and metadata.
- Reforge.
- Approve for publishing.
- Reject low-quality clip.
- Create platform-specific title/caption variants.

### 2.5 Publishing / Scheduling

**Purpose**

Safely publish approved clips across multiple accounts and platforms while avoiding spam patterns and accidental live uploads.

**Main Components**

- **Planner Board**
  - Left: approved clips waiting to publish.
  - Center: account/platform lanes for up to five accounts.
  - Right: inspector with selected post metadata, safety checks, and live gate.

- **Queue Views**
  - Calendar view: day/week schedule.
  - Lane view: one lane per account.
  - Table view: post rows with status, platform, account, campaign, clip, scheduledAt, postedAt, URL, failure reason.

- **Dry-Run vs Live Safety Rail**
  - Default state: dry-run.
  - Live requires three conditions:
    1. server env flag allows live publishing,
    2. account live toggle is enabled,
    3. user confirms selected posts or opens a timed publish window.
  - Every publish action displays resulting mode: "Dry-run plan only" or "Live upload".

- **Cadence Controls**
  - Per-account daily cap.
  - Minimum spacing between posts.
  - Platform-specific windows.
  - Duplicate protection: same clip cannot be posted twice to same account unless explicitly duplicated.
  - Campaign spread rule: avoid posting too many clips from same campaign back-to-back on one account.

- **Eligibility Checks**
  - Account connected.
  - Adapter implemented.
  - OAuth token valid.
  - Clip file exists.
  - Platform supports duration.
  - Campaign allows platform.
  - Cadence safe.

**Primary Actions**

- Drag approved clips into account lanes.
- Bulk assign clips to three or five accounts.
- Auto-schedule with cadence rules.
- Run dry-run publish.
- Promote selected dry-run posts to live.
- Pause an account lane.
- Retry failed posts.

### 2.6 Analytics / Segmentation

**Purpose**

Show what is working and convert performance into next actions.

**Main Components**

- Metrics overview: views, likes, comments, estimated earnings, RPM/CPM, posts, average views/post.
- Segment builder:
  - Dimensions: campaign, source, clip, post, account, platform, hook pattern, caption variant, rank bucket, score bucket, duration bucket, time window.
  - Measures: views, likes, comments, engagement rate, estimated earnings, payout amount, posts, success/fail rate.
- Pivot table and chart pair:
  - Table is primary for operational decisions.
  - Charts are supporting: trend line, bar comparison, scatter of LLM score vs views, earnings by campaign.
- Clip leaderboard:
  - Best clips by views and earnings.
  - Worst clips by underperformance.
  - "Make more like this" action that filters by source/campaign/hook pattern.
- Account health analytics:
  - Views/post by account.
  - Posting frequency vs views.
  - Failure and cooldown history.

**Primary Actions**

- Filter by campaign and time range.
- Compare accounts.
- Segment YouTube vs future TikTok/Instagram.
- Export CSV/JSON.
- Open source/clip/campaign from any row.
- Save analysis views.

### 2.7 System

**Purpose**

Make local safety and engine operations visible.

**Main Components**

- Vault status: locked/unlocked, key source, encrypted records count, last rotation.
- Local server binding: localhost only, Tailscale allowed hosts, remote access disabled/enabled.
- Engine jobs: ingest, transcript, detectMoments, forgeClip, publish, metrics sync, payout reconcile.
- Audit log: credentials saved/replaced, account connected/revoked, live publish attempted, post status changed.
- Backup/export controls for non-secret data and encrypted vault blob separately.

**Primary Actions**

- Lock/unlock vault.
- Rotate master key.
- Run metrics sync.
- Run payout reconciler.
- Export public-safe state.
- Inspect failed jobs.

---

## 3. Core User Flows

### 3.1 Connect a YouTube Channel with Owner Client ID/Secret

1. Owner opens **Accounts > YouTube**.
2. Dashboard shows required redirect URI, e.g. `http://127.0.0.1:PORT/oauth/youtube/callback`, and scopes needed for upload/channel identity.
3. Owner creates or selects his Google Cloud OAuth app outside ClipFarm and pastes Client ID and Client Secret into the dashboard.
4. Server validates input format lightly, never logs values, encrypts Client Secret, and stores Client ID plus encrypted secret under an OAuth app record.
5. UI shows saved app fingerprint, not the secret.
6. Owner clicks **Connect YouTube Channel**.
7. Server generates OAuth state and PKCE verifier, stores them as short-lived records, and opens/returns the consent URL.
8. Owner approves the channel in Google consent.
9. Local callback receives authorization code and state.
10. Server verifies state, exchanges code using the encrypted Client Secret, receives refresh/access tokens, and fetches channel identity.
11. Refresh token is encrypted into the vault. Access token is memory-only and discarded after use.
12. Dashboard creates an `account` record for the YouTube channel and displays it in one of five slots.
13. The new account starts with `dryRunDefault=true`, `liveEnabled=false`, conservative cadence, and token health "OK".

### 3.2 From Campaign to Posted Clips Across Three Accounts

1. Owner opens **Campaigns** and sorts by ROI score plus remaining budget.
2. Owner selects a campaign that allows YouTube, TikTok, and Instagram, but dashboard shows only YouTube accounts live-capable today; TikTok/IG lanes are marked `needs-account` or `adapter-stub`.
3. Owner adds or selects source videos for the campaign.
4. Engine runs ingest/transcript/detectMoments/forgeClip jobs.
5. Owner opens **Sources and Clips**, previews generated clips, edits hooks/titles/captions, approves the best six.
6. Owner clicks **Plan Posts**.
7. Publish planner opens with approved clips on the left and three selected YouTube account lanes in the center.
8. Owner selects "Auto-fill: spread across 3 accounts", with rules:
   - no duplicate clip on same account,
   - minimum spacing per account,
   - rotate campaigns and sources,
   - respect daily caps.
9. Planner creates scheduled `posts` in dry-run mode first.
10. Owner runs **Dry-run publish**. The system validates files, metadata, accounts, tokens, and cadence without uploading.
11. If live publishing is intended, owner opens the live gate. The UI requires explicit confirmation and shows exact post count and accounts.
12. Server publishes only eligible YouTube posts. TikTok/IG posts remain `needs-account` until adapters and accounts exist.
13. Posted rows receive URLs and `postedAt`; failed rows show reason and retry action.

### 3.3 Review Performance and Earnings per Campaign

1. Owner opens **Analytics** and selects a date range.
2. Owner groups by campaign and filters to posted clips.
3. Dashboard joins `campaigns`, `clips`, `posts`, `metrics`, and `payouts`.
4. Owner sees views, estimated earnings, paid/remaining budget, posts, earnings/post, views/post, and engagement.
5. Owner clicks a campaign row to drill into platform/account/clip breakdown.
6. Owner segments by account to see which channel performs best for that campaign.
7. Owner segments by clip rank/score to test whether LLM score predicts views.
8. Owner opens top clips, inspects hooks/captions/duration, and saves a view like "High CPM hooks under 35s".
9. Owner sends winning source/campaign patterns back to Campaigns or Sources for the next production batch.

---

## 4. Tech Stack Recommendation

### Recommendation: Low-Dependency Local Web App, Not Full SPA

Pick:

- **Server:** existing Node ESM process, still no framework initially, with small internal router modules for pages and JSON APIs.
- **Frontend:** server-rendered HTML pages plus progressive client-side islands using vanilla JS modules.
- **Styling:** static CSS with design tokens; no Tailwind build step needed for v1.
- **Tables/charts:** start with server-side tables and small client sort/filter helpers; add one vendored chart library only if analytics needs it after the first usable build.
- **State:** existing JSON store plus new JSON collections; use atomic file writes and append-only audit/job logs.
- **Security:** Node `crypto` for envelope encryption; OS env or local key file outside repo for master key.

### Why This Beats a Full SPA for ClipFarm

- The operator count is one. There is no multi-user SaaS need.
- The backend already exists as Node ESM with a JSON store. A full SPA adds build tooling, routing, auth assumptions, dependency risk, and a wider attack surface.
- Credentials are the riskiest part. Server-rendered flows keep secrets server-side and make it easier to prevent accidental client exposure.
- The data volume is likely small enough for simple page loads and filtered JSON endpoints.
- The dashboard needs auditability and clear state transitions more than reactive animation.

### Trade-Offs

- A full SPA would make drag/drop scheduling and pivot analytics smoother.
- The low-dep approach needs disciplined component structure to avoid messy templates.
- I would accept a small amount of vanilla JS for drag/drop lanes, inline clip metadata edits, and analytics filtering, but avoid React/Vite until the product proves it needs that complexity.

### Architecture Shape

- `dashboard/server`: route handling, view rendering, API endpoints.
- `dashboard/views`: HTML template functions.
- `dashboard/public`: CSS and JS modules.
- `services/vault`: encryption/decryption, key loading, secret redaction.
- `services/oauth`: provider app config, auth URL, callback, token refresh.
- `services/accounts`: account registry and token health.
- `services/scheduler`: cadence rules and schedule generation.
- `services/jobs`: job queue/state machine for ingest/forge/publish/metrics.
- `services/analytics`: joins and segment queries over JSON collections.

---

## 5. Data Model Extensions

### `oauthApps`

Stores provider app metadata and encrypted Client Secret.

Fields:

- `id`
- `provider`: `youtube|tiktok|instagram`
- `label`
- `clientId`
- `clientSecretRef`: reference into encrypted vault
- `redirectUri`
- `scopes`
- `createdAt`
- `updatedAt`
- `lastUsedAt`
- `fingerprint`: non-secret hash prefix for operator recognition
- `status`: `active|needs-secret|revoked`

### `accounts`

Represents a connected channel/page/account.

Fields:

- `id`
- `provider`
- `platform`
- `oauthAppId`
- `displayName`
- `externalAccountId`
- `handle`
- `avatarUrl`
- `tokenRef`: encrypted refresh token reference
- `scopes`
- `status`: `connected|needs-reconnect|disabled|revoked|stub`
- `dryRunDefault`
- `liveEnabled`
- `cadencePolicyId`
- `dailyCap`
- `lastPostAt`
- `nextSafePostAt`
- `createdAt`
- `updatedAt`

### `credentialVault`

Encrypted records only. This collection must be safe to commit only in the sense that ciphertext leaks no secret; still add it to `.gitignore`.

Fields:

- `id`
- `kind`: `oauth-client-secret|refresh-token|provider-token|session-secret`
- `provider`
- `accountId`
- `oauthAppId`
- `ciphertext`
- `iv`
- `authTag`
- `keyId`
- `algorithm`: `aes-256-gcm`
- `createdAt`
- `rotatedAt`

### `schedules`

Desired future posts before execution.

Fields:

- `id`
- `postId`
- `clipId`
- `campaignId`
- `accountId`
- `platform`
- `scheduledAt`
- `mode`: `dry-run|live`
- `cadenceDecision`: `safe|blocked|override`
- `createdBy`: `manual|auto-fill`
- `status`: `scheduled|paused|executed|cancelled|blocked`
- `reason`
- `createdAt`
- `updatedAt`

### `jobs`

Track long-running and retryable work.

Fields:

- `id`
- `type`: `ingest|transcript|detect-moments|forge-clip|publish|metrics-sync|payout-reconcile|oauth-refresh`
- `entityType`
- `entityId`
- `status`: `queued|running|succeeded|failed|cancelled`
- `attempts`
- `maxAttempts`
- `lastErrorCode`
- `lastErrorMessage`
- `startedAt`
- `finishedAt`
- `createdAt`

### `auditEvents`

Append-only security and publishing trace.

Fields:

- `id`
- `at`
- `actor`: `local-owner|system`
- `action`
- `entityType`
- `entityId`
- `metadata`: redacted, never secrets

### Extensions to Existing Collections

- `clips`: add `reviewStatus`, `reviewedAt`, `variants`, `policyNotes`, `forgeStatus`.
- `posts`: add `accountId`, `scheduledAt`, `mode`, `failureCode`, `failureMessage`, `publishJobId`, `metadataVariantId`.
- `metrics`: add `platform`, `accountId`, `campaignId`, `clipId` denormalized for faster analytics.
- `payouts`: add `accountId`, `platform`, `estimated`, `reconciledAt`.

---

## 6. Credential and OAuth Security Design

### Encryption at Rest

- Use Node `crypto` with AES-256-GCM.
- Generate a random data encryption key per secret record or per small batch.
- Wrap data keys with a master key.
- Store ciphertext, IV, auth tag, algorithm, and key ID in `credentialVault`.
- Master key must come from outside git:
  - preferred: `CLIPFARM_VAULT_KEY` environment variable,
  - acceptable local-only fallback: `~/.clipfarm/vault.key` with `0600` permissions,
  - never: `data/state`, `.env` committed to repo, source files, logs.

### Secret Handling Rules

- Client Secret and refresh tokens are accepted only by POST over local/private dashboard.
- Values are never logged, echoed, returned by APIs, rendered after save, or included in audit metadata.
- UI can show a fingerprint: e.g. `sha256(secret).slice(0,8)`, created server-side.
- Access tokens are memory-only and short-lived.
- Refresh tokens stay encrypted and are decrypted only inside provider adapter calls.
- On process start, vault is locked unless a key source is available. If locked, account status can be shown but publishing/token refresh is disabled.

### Multi-Account Token Handling

- One `oauthApp` can connect multiple YouTube channels.
- Each connected channel gets its own encrypted refresh token and account record.
- Token refresh is per account, not global.
- Reconnect replaces only that account's refresh token.
- Revocation clears encrypted token record and marks account `revoked`; it does not delete historical posts/metrics.

### OAuth Flow Details

- Generate a random `state` for each connect attempt.
- Use PKCE where supported even for installed/local app style flows.
- Store OAuth pending state with TTL and provider/account intent.
- Validate callback state before code exchange.
- Bind callback server to `127.0.0.1` by default.
- If Tailscale is enabled, require explicit allowed hostnames and a local dashboard passphrase/session cookie; do not expose OAuth callback to arbitrary interfaces.

### What Never Touches Git

- `.env`
- OAuth Client Secrets
- refresh tokens
- access tokens
- vault master key
- decrypted vault exports
- local session cookies/secrets
- raw provider API responses if they may include tokens
- browser profile/session files

Add `.gitignore` coverage for:

- `data/state/credentialVault*.json`
- `data/secrets/`
- `.clipfarm/`
- `.env*`
- `oauth-debug*.json`
- `sessions/`

Even encrypted vault files should be treated as private operational data and excluded from git by default.

---

## 7. Multi-Account Publishing UX

### Queue Model

The Publish screen should separate three states:

1. **Approved clips**: assets ready for placement.
2. **Scheduled posts**: planned account/platform/time rows.
3. **Executed posts**: dry-run, posted, failed, or needs-account results.

This avoids the common mistake of treating a clip as a post. One clip can become many posts across accounts/platforms, each with separate status and performance.

### Account Lanes

- One lane per account, grouped by platform.
- Up to five lanes are visible without horizontal overload.
- Each lane shows:
  - account name,
  - platform,
  - live toggle,
  - cooldown clock,
  - posts today vs cap,
  - next scheduled item,
  - token health.

### Bulk Actions

- "Spread selected clips across selected accounts"
- "Schedule next safe slots"
- "Dry-run selected"
- "Promote dry-run to live"
- "Pause selected account lanes"
- "Retry failed"
- "Duplicate to other accounts"

### Cadence and Ban-Avoidance Safety

Default cadence should be conservative:

- per-account daily cap starts low, e.g. 2-3 posts/day until manually raised;
- minimum spacing between posts, e.g. 2-4 hours;
- no same clip twice on same account;
- no more than N posts from one campaign in a row per account;
- detect identical captions/titles across accounts and warn;
- stagger multi-account posting by time, not simultaneous blast;
- failed auth/rate-limit errors automatically pause that account lane.

The dashboard should not pretend it can guarantee ban avoidance. It should say "cadence safe by local rules" rather than "ban safe".

### Dry-Run vs Live Surfacing

- Dry-run is the default global mode.
- Live mode is visually distinct and temporary.
- Every row has a `mode` chip.
- The primary button says exactly what will happen:
  - "Create dry-run posts"
  - "Validate dry-run"
  - "Upload 4 live posts"
- Live confirmation modal includes account names, platform, clip count, and scheduled times.
- Live upload remains impossible unless the backend env flag allows it.

---

## 8. Phased Build Order

### Phase 1 - Read-Only Command Center

Shippable outcome: owner can see campaigns, sources, clips, posts, metrics, payouts in one dashboard without changing engine behavior.

- Add local dashboard server.
- Add Command, Campaigns, Sources/Clips read-only views.
- Add basic Analytics campaign/account/platform filters from existing data.
- No credential UI yet.

### Phase 2 - Vault and YouTube Account Connection

Shippable outcome: owner can paste Client ID/Secret, connect YouTube channels, and see five-account grid.

- Add encrypted vault.
- Add OAuth app save/replace flow.
- Add YouTube OAuth connect/callback.
- Add accounts collection and token health checks.
- Add audit events for credential/account actions.

### Phase 3 - Review and Metadata Editing

Shippable outcome: owner can approve clips and edit publishing metadata before scheduling.

- Add clip review statuses.
- Add video preview and transcript window.
- Add hook/title/caption edits.
- Add approve/reject/reforge actions.

### Phase 4 - Dry-Run Publishing Planner

Shippable outcome: owner can schedule approved clips across accounts in dry-run mode with cadence validation.

- Add schedules and jobs.
- Add planner lanes and auto-fill.
- Add dry-run validation.
- Add blocked reasons and retry flow.

### Phase 5 - Gated Live YouTube Upload

Shippable outcome: owner can promote eligible dry-run YouTube posts to live uploads safely.

- Wire live YouTube adapter behind existing env gate.
- Add live gate UI.
- Add per-account live toggles.
- Add upload audit events and failure handling.

### Phase 6 - Metrics Sync and Earnings Analytics

Shippable outcome: owner can see campaign earnings and account/platform performance loops.

- Add metrics sync jobs.
- Add payout reconciler controls.
- Add segmentation builder.
- Add saved analytics views and CSV export.

### Phase 7 - TikTok/Instagram Adapter Readiness

Shippable outcome: UI already supports accounts/platforms; adapters can be added without redesign.

- Keep current stubs visible as `needs-account` or `adapter-stub`.
- Add provider-specific OAuth/account metadata when real adapters exist.
- Reuse schedules/posts/accounts model.

---

## 9. Top Risks

1. **Credential leakage through logs or repo artifacts**
   - Mitigation: central vault service, redaction middleware, gitignore, audit events without secret metadata, no secret reads in UI after save.

2. **Accidental live uploads**
   - Mitigation: dry-run default, env gate, account live toggle, row-level mode chips, explicit live confirmation.

3. **Account bans or throttling from aggressive posting**
   - Mitigation: conservative cadence, per-account caps, staggered schedules, pause on provider errors, language that cadence is only local risk reduction.

4. **Scope creep into a complex SaaS SPA**
   - Mitigation: server-rendered local dashboard first, small JS islands only where interaction materially improves operations.

5. **JSON store becoming hard to query for analytics**
   - Mitigation: denormalize metric records with campaignId/accountId/platform/clipId and create cached analytics snapshots before considering SQLite.

6. **Provider API divergence**
   - Mitigation: provider adapter interface and shared account/schedule/post model; platform-specific capability checks.

7. **Public repo with private local state**
   - Mitigation: strict path separation: source code public-safe, `data/state` operational, vault private, exports redacted by default.

## Single Strongest Recommendation

Build the encrypted Accounts/Vault foundation before any live publishing UX. The owner's first requirement is pasting OAuth credentials in the dashboard, but that is also the highest-risk capability. If the vault, account model, token handling, audit log, and dry-run/live gates are correct, every later feature can safely compose on top. If they are rushed, the dashboard becomes a credential leak and accidental uploader with a nice UI.

---

## Ledger Row

`2026-06-26 | clipfarm-dashboard-design | delivered RUN-NOTE.md | low-dep local dashboard, encrypted OAuth vault, five-account publishing planner, phased build plan`
