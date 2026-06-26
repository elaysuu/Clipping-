# ClipFarm Dashboard — Design (Claude, expert A)

Independent design; to be synthesized with Codex (expert B) and red-teamed before build.

## 1. Tech stack (recommendation)
**Express JSON API (on the existing JSON store) + a lean Vite+React+Tailwind SPA**, plus a tiny
chart lib (uPlot/Recharts via npm). Server-rendered HTML+htmx was considered but rejected: the
clip-review player, drag-to-schedule queue, and segmentable analytics need real client state, and
htmx makes those clunky. Next.js rejected: overkill for a single-operator local tool. The SPA stays
lean (no SSR, no auth provider) and the build step is fine for a local app. All deps are free.

Security posture: server binds `127.0.0.1`/Tailscale only; optional local PIN; **secrets never reach
the browser** (OAuth code↔token exchange is server-side).

## 2. Information architecture (top nav)
1. **Overview** — command center: today's views + est. earnings, per-account mini-cards, active
   campaigns, recent posts, alerts (token expiring, failed post, quota near limit).
2. **Accounts** — OAuth apps + connected channels grid (≤5+), per-account health, "connect new".
3. **Campaigns** — radar board, ROI-ranked, filters (genre/CPM/platform/budget), "work this".
4. **Studio** (Source→Clips) — submit source (+campaign), watch engine, review/edit clips, approve.
5. **Publish / Queue** — schedule approved clips to accounts×platforms; per-account cadence; dry-run
   vs live; bulk fan-out.
6. **Analytics** — deep segmentation by clip/account/platform/campaign/time; leaderboards; export.
7. **Settings** — LLM endpoint, safety-cadence defaults, security, data.

## 3. Key screens
**Accounts → Connect YouTube:**
- Add Connection → YouTube → Step 1 paste **Client ID + Client Secret** (his Google Cloud OAuth app);
  show the redirect URI to copy into GCP. Stored encrypted (vault). Step 2 "Connect channel" → Google
  consent → callback → channel card appears (name, avatar, subs).
- **Quota insight (smart default):** YouTube Data API = 10,000 units/day/project; an upload costs
  ~1,600 units → ~6 uploads/day per OAuth project. So to run 5 channels comfortably, recommend
  **one OAuth app (GCP project) per channel** to avoid quota starvation. The UI nudges this.
- Account card: platform, name, **health** (token valid? quota left today?), today's posts/views/$,
  queue depth, pause/disable.

**Studio clip review:** grid of generated clips; each card = playable 9:16 preview, score badge,
editable hook + caption, trim handles, reframe (fill/blur) toggle, "regenerate captions",
approve/reject; bulk-approve. Approved → Publish.

**Publish/Queue:** per-account queue/calendar; "auto-schedule (safe cadence)" or manual slot; platform
selector per clip; **dry-run default**, live requires explicit per-session arm + a clear "what will
post where" diff; bulk "fan this clip / this campaign across N accounts" with auto-stagger.

**Analytics:** filter bar (date, account, platform, campaign, genre); KPI tiles; charts (earnings over
time, views by platform, top clips/hooks); sortable/segmentable tables; "best hook patterns" insight.

## 4. Core flows
(a) **Connect YouTube w/ own creds:** Accounts → Add → paste Client ID/Secret → copy redirect URI →
Connect → consent → channel card. (b) **Campaign→posted across 3 accounts:** Campaigns → pick →
attach source in Studio → review/approve clips → Publish → select 3 accounts + platforms → arm live →
auto-staggered posts. (c) **Performance:** Analytics → filter by campaign → earnings + top clips.

## 5. Data model extensions
- `accounts` {id,platform,displayName,handle,oauthAppId,status,health,connectedAt,quotaUsedToday}
- `oauth_apps` {id,platform,label,redirectUri,clientIdRef,clientSecretRef→vault}
- `credentials` = **vault** (encrypted, gitignored): per-app client_secret; per-account refresh/access
  token+expiry. Store JSON holds only *references* (ids), never secret values.
- `schedules`/`jobs` {id,clipId,accountId,platform,runAt,status,attempts,result}
- extend `posts` with `accountId`, `scheduledFor`.

## 6. Credential & OAuth security
- `vault` encrypted with **AES-256-GCM**; master key from `CLIPFARM_VAULT_KEY` env, else a generated
  `~/.clipfarm/key` (chmod 600). Secrets decrypted in memory only at API-call time.
- Browser never sees secrets; server does the code↔token exchange and refresh.
- Bind localhost/Tailscale; optional PIN. Pre-commit secret scan. `vault`,`data/`,`logs/`,`.env`
  always gitignored → safe to open-source the repo.

## 7. Multi-account publishing UX + safety
- Per-account cadence: max/day, min gap, posting window, jitter (human-like). Conservative defaults to
  dodge spam detection.
- A queue worker (interval/cron) drains jobs respecting cadence + quota.
- Bulk fan-out guard: warns/staggers if it would breach cadence. Dry-run everywhere by default; live is
  armed per session with an explicit preview.

## 8. Phased build order (each shippable)
- **D1 Read-only dashboard** — Overview+Campaigns+Analytics over existing store. Pure value, zero
  security surface. Build first.
- **D2 Accounts + vault + YouTube OAuth connect** (1 channel end-to-end).
- **D3 Studio** clip review/edit/approve.
- **D4 Publish/Queue** (schedule + dry-run) → enable gated live YouTube.
- **D5 TikTok + Instagram** connections + adapters.
- **D6 Cadence worker + bulk + polish.**

## 9. Top risks + strongest recommendation
- Risks: (1) OAuth secret handling — biggest; (2) YouTube quota (~6 uploads/day/project → 1 project per
  channel); (3) automation ban patterns → conservative cadence + jitter.
- **Strongest recommendation:** ship **D1 read-only first** (value now, no risk), and treat the
  **credential vault as a first-class, audited module** built+tested before ANY account connects.
