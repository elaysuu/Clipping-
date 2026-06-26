# ClipFarm — Universal Clipping Engine (owner: Claude, for Elay)

> Elay delegated full ownership 2026-06-26. He will NOT read specs.
> This doc is the accountability record. Progress is reported to Elay in plain Hebrew + Telegram.
> Hard constraint: **₪0 budget.** No paid tools. Reuse existing free infra only.

## Decision (locked)
Build a **universal clipping engine** fed by **pay-per-view clipping campaigns** (Whop / Content Rewards / contentrewards.com).
- Money rail: per-view payouts, **no YouTube YPP needed**, content is **authorized** (creators want clips) → low ban risk.
- Rates observed (2026-06): $1–$30 per 1,000 views, no following required.
- Reject: raw reupload of sports/music (Content ID block) and YPP-dependent original channels (too slow).
- Multi-platform out: YouTube Shorts + TikTok + Instagram Reels from one clip.

## Money path = fastest + correct + ₪0
Join (free) → pick best-ROI live campaign → clip authorized source → post → get paid per view.
The money is in **campaign selection + clip quality + volume**, NOT account count.

## Zero-budget toolchain (all present/free)
- `yt-dlp` — source download (+ pull existing subtitles when present, saves transcription)
- `ffmpeg` — cut / vertical reframe / burn captions
- `@xenova/transformers` — **local Whisper transcription, free, no install** (already in Youtubeauto)
- Chutes — cheap LLM to rank viral moments (Elay's key)
- Remotion + `src/media/captions.js` — kinetic caption rendering (reuse from Youtubeauto)
- `src/upload/youtube.js` (googleapis, OAuth wired) — YT publish (reuse)
- Higgsfield — only if a campaign needs generated b-roll (Elay's credits)

## Architecture (8 components, one generic engine for all genres)
1. **Campaign Radar** — monitor campaign boards, rank live campaigns by $/effort + budget left.
2. **Source Ingest** — pull creator source (yt-dlp), grab subs if available.
3. **Moment Detection** — transcript (Whisper/subs) + audio-energy + LLM rank → 5–15 candidate clips.
4. **Clip Forge** — 9:16 reframe, speaker-track, burned captions, hook, per-platform format.
5. **Publisher** — multi-platform/multi-account scheduled posting, conservative + safe.
6. **Account Manager** — the "army"; warms/rotates/monitors. **Starts tiny, scales only after proof.**
7. **Payout Reconciler** — count views per clip/platform → map to payouts → real $ + what wins.
8. **Orchestrator** — 24/7 on CLAW, Telegram reports.

## Phasing — gate each on a REAL number, not a feeling
- **P0 Validation (Elay-in-loop):** join board, pick 1 campaign, post manual clips → **first real $1.** Only Elay can open the payout account.
- **P1 Core engine ✅ DONE+verified:** Ingest → Transcript → Detect → Forge(+captions) → ready-to-post clips. 100% free, 0 risk.
- **P2 Publisher + Reconciler:** auto-post 1 account × 3 platforms + view/payout tracking.
- **P3 Careful replication ("army"):** Account Manager, gradual accounts w/ safety, more niches.
- **P4 Control Dashboard — LAST, deprioritized (Elay 2026-06-26):** focus is purely the backend/engine
  until it is perfected; the project-specific dashboard is built only AFTER everything else is done.
  Vision (for later): one universal UI connected to EACH account, analytics/segmentation, control +
  edit + replay data, auto-post from the interface. **Do not build now.**

## Repo + public-readiness (Elay 2026-06-26)
- Remote: `git@github.com:elaysuu/Clipping-.git` (Elay's dedicated repo). Push auth verified.
- **May go PUBLIC depending on results** → secret hygiene is a hard rule: NO secret ever committed.
  LLM creds read from env / borrowed from `Youtubeauto/.env` at runtime; `.env`,`data/`,`logs/` git-ignored.

## Owner judgment / honesty
- A 50-account auto-poster for free is a ban magnet. Engine built fully; "army" scaled gradually after a proven dollar.
- WhatsApp/customer rules untouched. Only Elay's own social identities used; he connects them.
- Niche for pilot: chosen at P0 by the live campaign with the best $/effort (not pre-committed).

## Status log
- 2026-06-26: decision locked, scaffold created, toolchain verified, P1 build started.
