# ClipFarm

A universal short-form **clipping engine**: ingest any long-form source, find the
viral moments, and forge ready-to-post vertical clips with burned captions —
built to feed **pay-per-view clipping campaigns** across many genres
(streamers, podcasts, creators, brands).

> Status: early. Core pipeline works end-to-end. Multi-account publishing and the
> control dashboard are in progress. See `docs/PLAN.md`.

## Why
Pay-per-view clipping campaigns (e.g. Content Rewards / Whop) pay per 1,000 views
for clipping **authorized** creator content — no platform monetization threshold
required. The leverage is *campaign selection + clip quality + volume*, so ClipFarm
automates exactly those.

## Pipeline
```
source ─▶ ingest ─▶ transcript ─▶ detect moments ─▶ forge (9:16 + captions) ─▶ clips + manifest
```

- **Ingest** — source-agnostic: local file, direct media URL, or any `yt-dlp` site
  (cookies supported for hostile sites). Pulls free subtitles when present.
- **Transcript** — parses `.vtt` subtitles for free; local Whisper fallback.
- **Detect** — an LLM ranks the transcript into viral clip windows with hooks +
  captions (OpenAI-compatible endpoint; works with low-cost providers).
- **Forge** — `ffmpeg` cuts and reframes to 1080×1920 (`fill`/`blur`) and burns
  bold, smart-wrapped short-form captions (`libass`). Zero paid tools.
- **Campaign Radar** — parses a campaign-board snapshot into ROI-ranked targets.

## Usage
```bash
# 1. Rank a campaign board snapshot into ROI-ordered targets (records to store)
node bin/radar.js [snapshot.md] [--min-remaining N] [--top N]

# 2. Clip a source into ranked vertical clips (no publishing)
node bin/clip.js <url|file> [--top N] [--reframe fill|blur] [--campaign ID] [--no-captions]

# 3. Full backend run: source -> clips -> (dry-run) publish across platforms
node bin/run.js <url|file> [--campaign ID] [--platforms youtube,tiktok,instagram] [--mode dry-run|live]

# 4. One-glance report: clips made, posts, views, estimated earnings
node bin/report.js
```
Output: `data/clips/<source>/clip_NN.mp4` + `manifest.json` (rank, score, hook,
caption, timing per clip). All runs record to the JSON store under `data/state/`.

### Safety
Publishing is **dry-run by default** — nothing is posted. A live upload requires
both `--mode live` and `CLIPFARM_PUBLISH_LIVE=1`, and defaults to `private`.
TikTok/Instagram are inert until an account is connected.

## Configuration
No secrets are committed. The LLM client reads `LLM_BASE_URL` / `LLM_API_KEY` /
`LLM_MODEL` from the environment (or a local `.env`). `data/`, `logs/`, and `.env`
are git-ignored.

## Requirements
`node >= 20`, `ffmpeg`, `yt-dlp`, and an OpenAI-compatible LLM endpoint.

## Dashboard
A zero-dep, server-rendered local control panel (binds `127.0.0.1`):
```bash
CLIPFARM_VAULT_KEY=$(openssl rand -hex 32) npm run dashboard   # http://127.0.0.1:4317
```
- **Overview** — earnings/views KPIs, platforms, recent posts.
- **Campaigns** — ROI-ranked board (sortable/filterable).
- **Channels** — each page is its own topic/niche; per-channel **auto-matched
  research feed** of fitting campaigns; plannable before connecting.
- **Studio** — review/edit clip hooks & captions, approve/reject.
- **Accounts** — paste a per-channel Client ID/Secret (→ encrypted vault,
  fingerprint shown), OAuth-connect channels, live toggle.
- **Publish** — account lanes, dry-run planner, gated live.
- **Analytics** — segmented earnings, YouTube view sync.

## Autonomy (worker)
Run the worker on a cron — it refreshes the board (best-effort), routes approved
clips to each channel's best-matching niche, and drains the queue respecting
per-account cadence (daily cap + min gap + jitter):
```cron
*/15 * * * * cd /home/ops/clipfarm && CLIPFARM_VAULT_KEY=… node bin/worker.js >> logs/worker.log 2>&1
```

## Quality + money features
- **Speaker-aware crop** — detects the dominant person and crops 9:16 around them.
- **Word-by-word karaoke captions** — each word highlights as spoken; multilingual.
- **Campaign compliance** — checks each clip vs the campaign's rules (a rule-breaking
  clip earns $0) and tracks payout **submissions** (submitted→approved→paid).

## Status
- ✅ Engine, Radar, store, Publisher (dry-run), Reconciler, Orchestrator, Worker.
- ✅ Dashboard (8 screens) + vault (AES-256-GCM) + OAuth + per-channel topics/research.
- ✅ Compliance, speaker-crop, karaoke captions, cadence scheduler. 22 unit tests.
- ⏳ Needs the operator: a Whop/Content-Rewards payout account + a Google Cloud OAuth
  app per channel to connect real channels and enable live uploads.

See `docs/PLAN.md` and `docs/dashboard-design-FINAL.md`.

## Whop / Content-Rewards Auto-Submit Bot

Universal, data-driven submission to pay-per-view clipping campaigns. Each campaign
is just a rules row (`src/campaigns/compliance.js` schema); nothing is creator-specific.

**Flow (state machine, `src/submit/state.js`):** drafted → clip-compliant → posted →
awaiting-analytics → analytics-captured → submitted → support-sent →
(approved | rejected→resend) → paid.

**Setup (one-time):**
- Import logged-in cookies per identity into the encrypted session store
  (`src/submit/session.js`, ciphertext-only via the vault).
- Set `CLIPFARM_PROXY` to a residential proxy (recommended — a datacenter IP is
  bot-check-prone). Without it the bot runs direct, with a logged warning.
- Tune `config/whop-selectors.json` if Whop's UI changes (config edit, not code).

**Run:** the worker advances submissions each tick.
`CLIPFARM_VAULT_KEY=… CLIPFARM_SUBMIT_LIVE=1 npm run worker` (omit `CLIPFARM_SUBMIT_LIVE`
for dry-run). Cron: `*/15 * * * * cd /home/ops/clipfarm && CLIPFARM_VAULT_KEY=… npm run worker`

**Honest limits:** analytics screenshots need the real posted video's demographics
(1–2 day lag, ≥ the campaign's Tier-1 %); Support-Chat review is human and may reject
pending analytics (auto re-sent); AI-edit-banning campaigns route clips to human review
instead of auto-posting.

## License
Private / unreleased. Do not redistribute until a license is added.
