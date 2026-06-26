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
node bin/clip.js <url|file> [--top N] [--reframe fill|blur] [--no-captions]
```
Output: `data/clips/<source>/clip_NN.mp4` + `manifest.json` (rank, score, hook,
caption, timing per clip).

## Configuration
No secrets are committed. The LLM client reads `LLM_BASE_URL` / `LLM_API_KEY` /
`LLM_MODEL` from the environment (or a local `.env`). `data/`, `logs/`, and `.env`
are git-ignored.

## Requirements
`node >= 20`, `ffmpeg`, `yt-dlp`, and an OpenAI-compatible LLM endpoint.

## Roadmap
Multi-platform Publisher (Shorts/TikTok/Reels), per-clip view & payout
reconciliation, gradual multi-account management, and a control **Dashboard** that
connects every account, shows analytics, and posts clips. See `docs/PLAN.md`.

## License
Private / unreleased. Do not redistribute until a license is added.
