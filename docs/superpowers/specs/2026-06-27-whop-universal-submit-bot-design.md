# ClipFarm — Universal Whop / Content-Rewards Auto-Submit Bot

**Date:** 2026-06-27
**Status:** Approved (Elay), ready for implementation plan
**Repo:** `/home/ops/clipfarm` (Node ESM, zero-paid-dep, ₪0 toolchain)

## Goal

Make ClipFarm able to **submit clips to pay-per-view clipping campaigns (Whop / Content
Rewards) as automatically as the platform allows**, after a one-time setup. The platform's
submit+payout half is deliberately human-gated (demographics screenshots from real posted
videos, daily Support-Chat human review, per-creator quality rules). So we build a **full
auto-submit bot whose human gates are modeled as explicit states**, not as failures — it
automates to the edge of each gate, waits/retries/escalates correctly, and never pretends a
gate doesn't exist.

**Hard requirement — universal template.** Nothing in the code references any specific
creator. A campaign (e.g. "John Malek") is only a row of rules-data. All creator/campaign
specifics live in `data` + a per-campaign rules object, never in code.

## Non-goals (YAGNI)

- No open-ended human conversation in Support-Chat — templated replies only, else escalate.
- No paid clip tools. No new runtime deps beyond Chrome (already present) + the existing vault.
- Not solving the "real bottleneck" (Tier-1 views from aged accounts) here — that is a
  separate concern; this spec is the submit/interface layer only.

## Reality map (why the design is shaped this way)

Whop's "Content Rewards" submission flow (observed from a real campaign brief) has three
human gates that cannot be cleanly bypassed:

1. **Demographics/analytics screenshots** must come from the *already-posted* video's
   analytics (YouTube/TikTok/IG), which take 1–2 days to populate and must show ≥40% Tier-1
   audience (US/UK/CA/AU). Cannot be faked or pre-generated.
2. **Support-Chat review** — a human on the creator's team reviews daily and routinely
   *rejects pending analytics*; you re-send full analytics. A chat, not an API.
3. **Per-campaign quality rules** — some creators explicitly ban AI edits (Opus Clips /
   CapCut AI captions / AI voice). A naive full-AI clipper gets rejected on quality.

Plus the real per-campaign rules are richer than today's generic `compliance.js`: required
watermark overlay, exact caption text, bio deep-link on dedicated pages, single-source
footage only, Tier-1 audience threshold.

## Architecture

Built on existing modules: `src/campaigns/compliance.js`, `src/vault/`, `bin/worker.js`,
`src/core/store.js`. New work lives under `src/submit/`.

### 1. Universal campaign-rules schema (extend `compliance.js`)

Extend `DEFAULT_RULES` + `getRules`/`setRules` with optional, per-campaign fields. All
backward-compatible (every field optional, sensible defaults):

```
rules {
  source:   { mode: 'single-video' | 'any', footageUrl, watermarkUrl }
  overlays: { watermark: { url, position }, requiredCaptionText }
  bioLink:  { required: bool, url, pageTypes: ['dedicated'] }
  audience: { minTier1Pct: 40, tier1: ['US','UK','CA','AU'] }
  quality:  { allowAiEdits: bool, banned: ['opus','capcut-ai','ai-voice'] }
  platforms[], minDuration, maxDuration, cpm, maxPerClip
  analytics: ['overview','reach','engagement','audience']   // panels Support requires
  submit:   { via: ['whop-form','support-chat'], communityUrl, campaignId }
}
```

### 2. Submission state machine (extend the existing submission lifecycle)

Today: `draft|ready|submitted|approved|rejected|paid`. Extend to model Whop reality:

```
drafted → clip-compliant → posted → awaiting-analytics → analytics-captured
        → submitted → support-sent → (approved | rejected → resend-analytics) → paid
```

Each submission row gains: `campaignId, clipId, platform, postUrl, postedAt,
analyticsScreenshotPath, tier1Pct, supportThreadRef, status, nextActionAt`.
`nextActionAt` lets the worker poll lazily (e.g. don't re-check analytics for ~24h).

### 3. Browser-driver layer — `src/submit/` (new)

Runs on CLAW, all Whop/social traffic routed through a **residential proxy** (env
`CLIPFARM_PROXY`). Proxy-agnostic: no proxy → direct connection with a logged warning.

- `src/submit/browser.js` — launches Chrome (`CHROME_BIN`, headed-capable) with the proxy
  and a persistent profile per identity. One small wrapper over the existing `exec`/
  chrome-devtools approach already used by `src/campaigns/fetch.js`.
- `src/submit/session.js` — per-identity cookie/session store, **encrypted via the existing
  `src/vault`** (AES-256-GCM, ciphertext-only on disk). Sessions imported once (operator
  logs in / imports cookies on first run), then re-used — avoids repeated logins that trip
  bot-checks. One identity per Whop account and per social account.
- `src/submit/analytics.js` — universal analytics-screenshot capture. Per-platform adapters
  (`youtube|tiktok|instagram`) navigate to the posted video's analytics, wait for the
  demographics panel to render, screenshot the required panels, and parse Tier-1 %. Returns
  `{ ready, tier1Pct, screenshotPath }`. Not ready → submission stays `awaiting-analytics`,
  `nextActionAt` pushed ~24h.
- `src/submit/whop.js` — universal Whop adapter. Opens community → campaign → "Submit
  Video" → fills `{ title, link, demographics image }` → submits; then Support-Chat:
  attaches analytics + sends; handles the "send your analytics" rejection by re-sending.
  **All CSS/text selectors live in `config/whop-selectors.json`** so a Whop UI change is a
  config edit, not a code rewrite.

### 4. Hard pre-post compliance gate

Before a clip is ever posted, `checkCompliance` must pass the FULL universal ruleset:
watermark applied, exact caption text present, bio-link configured (dedicated pages),
footage from the allowed single source, duration ok. If `quality.allowAiEdits === false`,
the clip is **not** auto-posted — it is routed to a human-review queue in the dashboard.
Tier-1 audience is enforced later at the analytics stage. A non-compliant clip never
consumes a submission slot.

### 5. Worker loop (extend `bin/worker.js`)

Each cron tick advances every submission's state machine: post due clips, poll
analytics-readiness for `awaiting-analytics` rows, capture+submit when ready, watch support
threads, handle rejections, mark `paid` on reconcile. Existing daily-cap + min-gap + jitter
guards are reused. Off-script Support replies → Telegram escalation via `notify-telegram.sh`.

## Error handling & honesty flags

- **₪0 vs residential proxy:** good residential proxies cost money, conflicting with the
  standing ₪0 rule. Architecture is proxy-agnostic (env-var); runs with a proxy when Elay
  funds one, degrades to direct/his-machine session otherwise. **This is the one decision
  requiring spend** — flagged, never silently assumed.
- **AI-edit-banning campaigns:** routed to human review, not auto-posted. Universal per-campaign flag.
- **Support-Chat:** templated, minimal replies only; anything off-script escalates to Telegram.
- **Datacenter-IP bot-checks:** the documented silent-bounce risk (IG/YT from CLAW IP) is
  mitigated by (a) the residential proxy and (b) import-once-reuse sessions instead of
  repeated logins.
- **Selector drift:** Whop UI changes are absorbed by `config/whop-selectors.json`; a parse
  failure logs + escalates rather than silently submitting garbage.

## Testing

- Unit: rules-schema normalization (`setRules`/`getRules` round-trip), compliance checks for
  each new rule (watermark/caption/bioLink/source/quality), state-machine transitions.
- Integration (offline, no live submit): a fake campaign + fake posted-clip drive the state
  machine through to `support-sent` against mocked browser/analytics adapters.
- No live Whop submission in tests — dry-run default, live gated behind an explicit env flag.

## Out-of-scope follow-ups

- Real TikTok/IG analytics adapters may need per-platform UI work (parallels the existing
  TikTok/IG publish stubs).
- The actual money bottleneck (real Tier-1 views, account warming, anti-ban) is tracked
  separately.
