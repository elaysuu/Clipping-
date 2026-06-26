# Mission: Design the ClipFarm Control Dashboard (UI/UX + architecture)

You are an independent senior product designer + full-stack architect. Design the
**control dashboard** for an existing system called **ClipFarm**. Output a complete
design document (no code). You are one of TWO independent experts; your design will
be synthesized against another. Be opinionated, concrete, and justify trade-offs.

## What ClipFarm already is (backend, done + working)
A zero-budget "universal clipping engine" that makes money via **pay-per-view
clipping campaigns** (Content Rewards / Whop): you clip an authorized creator's
long-form video into vertical short-form clips and post them across platforms;
you get paid per 1,000 views.

Backend stack (already built, Node ESM, no framework):
- Engine: `ingest` (any source) → `transcript` (subtitles or local Whisper) →
  `detectMoments` (LLM ranks viral windows + writes hook/title) → `forgeClip`
  (ffmpeg 9:16 + burned captions).
- A zero-dep JSON store (`data/state/*.json`) with collections:
  `campaigns` {id,title,cpm,total,paid,remaining,score,genre,platforms}
  `sources`   {id,url,videoPath,ingestedAt}
  `clips`     {id,sourceId,campaignId,rank,score,hook,caption,start,end,dur,file}
  `posts`     {id,clipId,platform,account,status,url,title,postedAt}  status: planned|dry-run|posted|failed|needs-account
  `metrics`   {id,postId,views,likes,comments,at}
  `payouts`   {id,campaignId,postId,views,cpm,amount,at}
- Campaign Radar (ranks a board snapshot by ROI).
- Publisher: dry-run by default; YouTube adapter via OAuth (googleapis); TikTok/IG
  are stubs ("needs-account"). Live upload is gated behind an env flag + private.
- Payout Reconciler (views × CPM → estimated earnings).

## What the dashboard must do (the owner's requirements, verbatim intent)
1. Let the owner **paste his own OAuth Client ID + Secret** (e.g. a Google Cloud
   OAuth app) IN the dashboard, and from there **connect/"set up" YouTube channels**
   via the OAuth consent flow.
2. Manage **up to ~5 "pages"/accounts** (YouTube channels now; TikTok + Instagram
   later) **with full comfort** — one place to see and control all of them.
3. **Upload/publish** clips to any connected account on any network (YouTube,
   TikTok, Instagram) easily, in a smart, organized way.
4. Be "smart and organized": campaign selection, source→clip review, scheduling,
   and **analytics/segmentation** of everything (per clip / account / platform /
   campaign — views, earnings, what's working), with the ability to control,
   edit, filter and "play with" the data.
5. The repo **may become public** → credentials/secrets must be encrypted at rest,
   never in git, and the server is local/private (localhost or Tailscale only).

## Deliver (as a structured design doc)
1. **Information architecture** — the top-level sections/navigation and why.
2. **Key screens** — for each: purpose, the main components, and the primary user
   actions. Cover at minimum: Accounts/Connections (incl. the paste-Client-ID +
   OAuth-connect flow and the 5-account grid), Campaigns, Source→Clip review/edit,
   Publishing/Scheduling (multi-account, multi-platform, dry-run vs live, safety
   cadence to avoid bans), Analytics/Segmentation.
3. **Core user flows** — step-by-step for: (a) connecting a YouTube channel with
   own Client ID/Secret, (b) going from a campaign to posted clips across 3
   accounts, (c) reviewing performance and seeing earnings per campaign.
4. **Tech stack recommendation** — front-end + server approach, justified for a
   single-operator, local, security-sensitive, possibly-public tool. Weigh a
   lean zero/low-dep stack vs a full SPA. Pick one and defend it.
5. **Data model extensions** — what new collections/fields are needed (accounts,
   credentials vault, schedules, jobs) and how secrets are encrypted at rest.
6. **Credential & OAuth security design** — exactly how Client ID/Secret + refresh
   tokens are stored, encrypted, and used; multi-account token handling; what
   NEVER touches git.
7. **Multi-account publishing UX** — queues, scheduling, per-account cadence/safety,
   bulk actions across 5 accounts, and how dry-run/live is surfaced safely.
8. **Phased build order** — smallest-first, each phase independently shippable.
9. **Top risks + your single strongest recommendation.**

Keep it practical and buildable on top of the existing Node/JSON-store backend.
Write the doc to `RUN-NOTE.md` in your dispatch directory (and echo it to stdout).
