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

## Status
- ✅ Engine, Campaign Radar, store, Publisher (dry-run), Reconciler, Orchestrator.
- ✅ Dashboard D1–D6 + credential vault (AES-256-GCM) + OAuth + per-channel topics.
- ✅ 15 unit tests; key flows verified end-to-end + visually.
- ⏳ Needs the operator: a Whop/Content-Rewards payout account and a Google Cloud
  OAuth app per channel to connect real channels and enable live uploads.

See `docs/PLAN.md` and `docs/dashboard-design-FINAL.md`.

## License
Private / unreleased. Do not redistribute until a license is added.
