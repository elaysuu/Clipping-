# Universal Whop Auto-Submit Bot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give ClipFarm a universal, data-driven bot that submits clips to Whop / Content-Rewards campaigns as automatically as the platform's human-gated flow allows.

**Architecture:** Extend the existing rules engine (`compliance.js`) with a universal per-campaign rules schema; model the Whop submission flow as an explicit state machine over the `submissions` store collection; add a proxy-aware browser layer (`src/submit/`) whose pure logic (arg-building, packet-building, text-parsing, state transitions) is unit-tested while thin I/O wrappers mirror the existing `fetch.js` pattern. The worker tick advances submissions through their states.

**Tech Stack:** Node ESM (≥20), `node:test`, existing `src/core/store.js` (JSON store), `src/vault` (AES-256-GCM), `src/core/exec.js` (Chrome), zero new paid deps.

## Global Constraints

- ₪0 budget — no new paid dependencies. Residential proxy is the ONE optional paid input, read from env `CLIPFARM_PROXY`; code is proxy-agnostic and degrades to direct with a logged warning.
- Universal template — NO code may reference any specific creator/campaign by name. All specifics are data (campaign rows / rules objects / `config/whop-selectors.json`).
- Node ESM, `import`/`export`, files end `.js`, `type: module`.
- Secrets/cookies NEVER on disk in plaintext — only via `src/vault` (ciphertext-only). Tests use the literal fake string `FAKE_TEST_SECRET_not_real`, never a real-looking secret.
- Live submission is gated behind `CLIPFARM_SUBMIT_LIVE=1`; default is dry-run. No test performs a live Whop action.
- Existing store API: `read(name)`, `write(name, rows)`, `upsert(name, row, key='id')` from `src/core/store.js`.
- Existing vault API: `encrypt(plaintext)→rec`, `decrypt(rec)→plaintext`, `fingerprint(secret)` from `src/vault/index.js`.

---

### Task 1: Universal campaign-rules schema

**Files:**
- Modify: `src/campaigns/compliance.js` (extend `DEFAULT_RULES`, `setRules`, `checkCompliance`)
- Test: `tests/compliance-rules.test.js`

**Interfaces:**
- Consumes: `read`, `upsert` from `src/core/store.js` (already imported in compliance.js).
- Produces:
  - Extended `DEFAULT_RULES` with: `source:{mode:'any',footageUrl:'',watermarkUrl:''}`, `overlays:{watermark:{url:'',position:'br'},requiredCaptionText:''}`, `bioLink:{required:false,url:'',pageTypes:['dedicated']}`, `audience:{minTier1Pct:0,tier1:['US','UK','CA','AU']}`, `quality:{allowAiEdits:true,banned:[]}`, `analytics:['overview','engagement','audience']`, `submit:{via:[],communityUrl:'',campaignId:''}` (plus the existing fields).
  - `getRules(campaign)` deep-merges these defaults (already exists; extend merge to be deep for nested objects).
  - `checkCompliance({ clip, campaign, platform, caption, post })` → `{ ok, violations:[{rule,detail}] }`, where optional `post = { watermarkApplied:bool, captionText:string, bioLinkSet:bool, isDedicatedPage:bool, sourceUrl:string, aiEdited:bool }`.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/compliance-rules.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.CLIPFARM_VAULT_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

const { getRules, setRules, checkCompliance } = await import('../src/campaigns/compliance.js');

test('getRules deep-merges new universal fields with defaults', () => {
  const r = getRules({ rules: { overlays: { requiredCaptionText: 'watch full @x' } } });
  assert.equal(r.overlays.requiredCaptionText, 'watch full @x');
  assert.equal(r.overlays.watermark.position, 'br');     // default preserved
  assert.deepEqual(r.audience.tier1, ['US', 'UK', 'CA', 'AU']);
});

test('checkCompliance flags missing watermark, caption text, bio link, wrong source, ai edit', () => {
  const campaign = { rules: {
    overlays: { watermark: { url: 'wm.png' }, requiredCaptionText: 'watch full @creator' },
    bioLink: { required: true, url: 'x.com/abc', pageTypes: ['dedicated'] },
    source: { mode: 'single-video', footageUrl: 'https://yt/ALLOWED' },
    quality: { allowAiEdits: false, banned: ['opus'] },
  } };
  const res = checkCompliance({
    clip: { dur: 30 }, campaign, platform: 'youtube', caption: 'lol',
    post: { watermarkApplied: false, captionText: 'lol', bioLinkSet: false,
            isDedicatedPage: true, sourceUrl: 'https://yt/OTHER', aiEdited: true },
  });
  const rules = res.violations.map((v) => v.rule);
  assert.ok(rules.includes('watermark'));
  assert.ok(rules.includes('requiredCaptionText'));
  assert.ok(rules.includes('bioLink'));
  assert.ok(rules.includes('source'));
  assert.ok(rules.includes('quality'));
  assert.equal(res.ok, false);
});

test('checkCompliance passes a fully compliant post', () => {
  const campaign = { rules: {
    overlays: { watermark: { url: 'wm.png' }, requiredCaptionText: 'watch full @creator' },
    bioLink: { required: true, url: 'x.com/abc' },
    source: { mode: 'single-video', footageUrl: 'https://yt/ALLOWED' },
    quality: { allowAiEdits: false },
  } };
  const res = checkCompliance({
    clip: { dur: 30 }, campaign, platform: 'youtube',
    caption: 'a clip — watch full @creator',
    post: { watermarkApplied: true, captionText: 'a clip — watch full @creator',
            bioLinkSet: true, isDedicatedPage: true, sourceUrl: 'https://yt/ALLOWED', aiEdited: false },
  });
  assert.equal(res.ok, true, JSON.stringify(res.violations));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/compliance-rules.test.js`
Expected: FAIL (new fields/checks not present).

- [ ] **Step 3: Extend `DEFAULT_RULES` and deep-merge in `getRules`**

In `src/campaigns/compliance.js`, replace `DEFAULT_RULES` and `getRules`:

```javascript
export const DEFAULT_RULES = {
  minDuration: 5, maxDuration: 180, platforms: ['youtube', 'tiktok', 'instagram'],
  requiredHashtags: [], requiredMention: '', minViewsForPayout: 0, notes: '',
  source: { mode: 'any', footageUrl: '', watermarkUrl: '' },
  overlays: { watermark: { url: '', position: 'br' }, requiredCaptionText: '' },
  bioLink: { required: false, url: '', pageTypes: ['dedicated'] },
  audience: { minTier1Pct: 0, tier1: ['US', 'UK', 'CA', 'AU'] },
  quality: { allowAiEdits: true, banned: [] },
  analytics: ['overview', 'engagement', 'audience'],
  submit: { via: [], communityUrl: '', campaignId: '' },
};

function deepMerge(base, over) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return over ?? base;
  const out = { ...base };
  for (const k of Object.keys(over || {})) out[k] = deepMerge(base[k], over[k]);
  return out;
}

export function getRules(campaign) {
  return deepMerge(DEFAULT_RULES, campaign?.rules || {});
}
```

- [ ] **Step 4: Extend `checkCompliance` with the new rule checks**

In `checkCompliance`, before the final `return`, add (keep all existing checks):

```javascript
  const p = post || {};
  if (r.overlays?.watermark?.url && p.watermarkApplied === false)
    v.push({ rule: 'watermark', detail: 'required watermark not applied' });
  if (r.overlays?.requiredCaptionText) {
    const want = r.overlays.requiredCaptionText.toLowerCase();
    const have = `${p.captionText || ''} ${caption || ''}`.toLowerCase();
    if (!have.includes(want)) v.push({ rule: 'requiredCaptionText', detail: `missing "${r.overlays.requiredCaptionText}"` });
  }
  if (r.bioLink?.required && p.isDedicatedPage && p.bioLinkSet === false)
    v.push({ rule: 'bioLink', detail: 'dedicated page missing required bio link' });
  if (r.source?.mode === 'single-video' && r.source.footageUrl && p.sourceUrl &&
      p.sourceUrl !== r.source.footageUrl)
    v.push({ rule: 'source', detail: 'footage is not the campaign-assigned source' });
  if (r.quality && r.quality.allowAiEdits === false && p.aiEdited === true)
    v.push({ rule: 'quality', detail: 'AI-edited clip not allowed by this campaign' });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/compliance-rules.test.js`
Expected: PASS (3 tests). Also run full suite: `npm test` — Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/campaigns/compliance.js tests/compliance-rules.test.js
git commit -m "feat(compliance): universal per-campaign rules schema (watermark/caption/bioLink/source/quality)"
```

---

### Task 2: Submission state machine

**Files:**
- Create: `src/submit/state.js`
- Test: `tests/submit-state.test.js`

**Interfaces:**
- Consumes: `read`, `upsert` from `src/core/store.js`.
- Produces:
  - `STATES = ['drafted','clip-compliant','posted','awaiting-analytics','analytics-captured','submitted','support-sent','approved','rejected','paid']`
  - `createSubmission({ campaignId, clipId, platform })` → submission row `{ id, campaignId, clipId, platform, postUrl:null, postedAt:null, analyticsScreenshotPath:null, tier1Pct:null, supportThreadRef:null, status:'drafted', nextActionAt:null }` (id = `sub_<clipId>_<platform>`).
  - `advance(id, event, patch={})` → updated row. Valid events per state below; invalid transition throws `Error('bad transition: <status> -/-> <event>')`.
  - `due(now=Date.now())` → submissions whose `nextActionAt` is null or ≤ now and not in a terminal state (`paid`/`approved`).

Transition table (event → next status):
`compliant→clip-compliant`, `post→posted`(set postUrl/postedAt), `await→awaiting-analytics`, `analytics→analytics-captured`(set screenshot/tier1), `submit→submitted`, `support→support-sent`, `approve→approved`, `reject→rejected`, `resend→support-sent`, `pay→paid`.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/submit-state.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.CLIPFARM_VAULT_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

const { createSubmission, advance, due, STATES } = await import('../src/submit/state.js');

test('createSubmission starts drafted with a deterministic id', () => {
  const s = createSubmission({ campaignId: 'c1', clipId: 'clipA', platform: 'youtube' });
  assert.equal(s.id, 'sub_clipA_youtube');
  assert.equal(s.status, 'drafted');
  assert.equal(s.postUrl, null);
});

test('advance walks the happy path drafted→paid', () => {
  createSubmission({ campaignId: 'c1', clipId: 'clipB', platform: 'youtube' });
  const id = 'sub_clipB_youtube';
  advance(id, 'compliant');
  advance(id, 'post', { postUrl: 'https://yt/v', postedAt: '2026-06-27T00:00:00Z' });
  advance(id, 'await', { nextActionAt: 1 });
  const a = advance(id, 'analytics', { analyticsScreenshotPath: '/x.png', tier1Pct: 55 });
  assert.equal(a.tier1Pct, 55);
  advance(id, 'submit');
  advance(id, 'support');
  advance(id, 'approve');
  const paid = advance(id, 'pay');
  assert.equal(paid.status, 'paid');
});

test('reject then resend returns to support-sent', () => {
  createSubmission({ campaignId: 'c1', clipId: 'clipC', platform: 'youtube' });
  const id = 'sub_clipC_youtube';
  ['compliant','post','await','analytics','submit','support'].forEach((e) => advance(id, e));
  advance(id, 'reject');
  const r = advance(id, 'resend');
  assert.equal(r.status, 'support-sent');
});

test('invalid transition throws', () => {
  createSubmission({ campaignId: 'c1', clipId: 'clipD', platform: 'youtube' });
  assert.throws(() => advance('sub_clipD_youtube', 'pay'), /bad transition/);
});

test('due excludes terminal submissions and respects nextActionAt', () => {
  createSubmission({ campaignId: 'c1', clipId: 'clipE', platform: 'youtube' });
  advance('sub_clipE_youtube', 'compliant', { nextActionAt: Date.now() + 1e9 });
  const ids = due(Date.now()).map((s) => s.id);
  assert.ok(!ids.includes('sub_clipE_youtube'));
  assert.ok(Array.isArray(STATES) && STATES.includes('paid'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/submit-state.test.js`
Expected: FAIL ("Cannot find module '../src/submit/state.js'").

- [ ] **Step 3: Implement `src/submit/state.js`**

```javascript
// src/submit/state.js
// Submission state machine over the `submissions` store collection. Models the
// human-gated Whop flow as explicit states so the worker can advance lazily.
import { read, upsert } from '../core/store.js';

export const STATES = ['drafted', 'clip-compliant', 'posted', 'awaiting-analytics',
  'analytics-captured', 'submitted', 'support-sent', 'approved', 'rejected', 'paid'];

const TERMINAL = new Set(['paid', 'approved']);

const TRANSITIONS = {
  compliant: { from: ['drafted'], to: 'clip-compliant' },
  post: { from: ['clip-compliant'], to: 'posted' },
  await: { from: ['posted'], to: 'awaiting-analytics' },
  analytics: { from: ['awaiting-analytics'], to: 'analytics-captured' },
  submit: { from: ['analytics-captured'], to: 'submitted' },
  support: { from: ['submitted'], to: 'support-sent' },
  approve: { from: ['support-sent'], to: 'approved' },
  reject: { from: ['support-sent', 'submitted'], to: 'rejected' },
  resend: { from: ['rejected'], to: 'support-sent' },
  pay: { from: ['approved'], to: 'paid' },
};

export function createSubmission({ campaignId, clipId, platform }) {
  const row = {
    id: `sub_${clipId}_${platform}`, campaignId, clipId, platform,
    postUrl: null, postedAt: null, analyticsScreenshotPath: null, tier1Pct: null,
    supportThreadRef: null, status: 'drafted', nextActionAt: null,
  };
  return upsert('submissions', row);
}

export function advance(id, event, patch = {}) {
  const row = read('submissions').find((s) => s.id === id);
  if (!row) throw new Error(`no submission ${id}`);
  const t = TRANSITIONS[event];
  if (!t || !t.from.includes(row.status))
    throw new Error(`bad transition: ${row.status} -/-> ${event}`);
  return upsert('submissions', { id, status: t.to, ...patch });
}

export function due(now = Date.now()) {
  return read('submissions').filter((s) =>
    !TERMINAL.has(s.status) && (s.nextActionAt == null || s.nextActionAt <= now));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/submit-state.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/submit/state.js tests/submit-state.test.js
git commit -m "feat(submit): submission state machine for the human-gated Whop flow"
```

---

### Task 3: Encrypted session store

**Files:**
- Create: `src/submit/session.js`
- Test: `tests/submit-session.test.js`

**Interfaces:**
- Consumes: `encrypt`, `decrypt`, `fingerprint` from `src/vault/index.js`; `read`, `upsert` from `src/core/store.js`.
- Produces:
  - `saveSession(identity, cookies)` — `identity` = string (e.g. `'whop'`, `'yt:channelA'`); `cookies` = array/object. Stores ciphertext in collection `sessions`, row `{ id:identity, enc, fingerprint, savedAt }`. Returns the safe row (no plaintext).
  - `loadSession(identity)` → original cookies object, or `null` if absent.
  - `listSessions()` → safe rows (id, fingerprint, savedAt only).

- [ ] **Step 1: Write the failing test**

```javascript
// tests/submit-session.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.CLIPFARM_VAULT_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

const { saveSession, loadSession, listSessions } = await import('../src/submit/session.js');

test('saveSession round-trips cookies and never stores plaintext', () => {
  const cookies = [{ name: 'sid', value: 'FAKE_TEST_SECRET_not_real' }];
  const safe = saveSession('whop', cookies);
  assert.equal(safe.id, 'whop');
  assert.ok(safe.fingerprint.length === 8);
  assert.ok(!JSON.stringify(safe).includes('FAKE_TEST_SECRET_not_real'));
  assert.deepEqual(loadSession('whop'), cookies);
});

test('loadSession returns null for unknown identity', () => {
  assert.equal(loadSession('nope'), null);
});

test('listSessions exposes only id+fingerprint+savedAt', () => {
  saveSession('yt:channelA', [{ name: 'x', value: 'FAKE_TEST_SECRET_not_real' }]);
  const row = listSessions().find((s) => s.id === 'yt:channelA');
  assert.ok(row && row.fingerprint && row.savedAt);
  assert.ok(!('enc' in row));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/submit-session.test.js`
Expected: FAIL ("Cannot find module '../src/submit/session.js'").

- [ ] **Step 3: Implement `src/submit/session.js`**

```javascript
// src/submit/session.js
// Per-identity browser session (cookie) store. Cookies are credentials, so they
// live only as ciphertext via the existing AES-256-GCM vault — never plaintext on disk.
import { encrypt, decrypt, fingerprint } from '../vault/index.js';
import { read, upsert } from '../core/store.js';

export function saveSession(identity, cookies) {
  const plaintext = JSON.stringify(cookies);
  const enc = encrypt(plaintext);
  upsert('sessions', {
    id: identity, enc, fingerprint: fingerprint(plaintext),
    savedAt: new Date().toISOString(),
  });
  return { id: identity, fingerprint: fingerprint(plaintext), savedAt: new Date().toISOString() };
}

export function loadSession(identity) {
  const row = read('sessions').find((s) => s.id === identity);
  if (!row) return null;
  return JSON.parse(decrypt(row.enc));
}

export function listSessions() {
  return read('sessions').map(({ id, fingerprint: fp, savedAt }) => ({ id, fingerprint: fp, savedAt }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/submit-session.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/submit/session.js tests/submit-session.test.js
git commit -m "feat(submit): encrypted per-identity session store (cookies via vault)"
```

---

### Task 4: Proxy-aware browser launcher

**Files:**
- Create: `src/submit/browser.js`
- Test: `tests/submit-browser.test.js`

**Interfaces:**
- Consumes: `run` from `src/core/exec.js`; `log` from `src/core/log.js`.
- Produces:
  - `chromeArgs({ url, profileDir, proxy, dumpDom=true })` → string[] of Chrome flags (pure, testable). Includes `--headless=new`, `--no-sandbox`, `--disable-gpu`, `--virtual-time-budget=15000`, `--user-data-dir=<profileDir>`; adds `--proxy-server=<proxy>` only when `proxy` is truthy; adds `--dump-dom <url>` when `dumpDom`.
  - `resolveProxy(env=process.env)` → `env.CLIPFARM_PROXY || null`, logging a warning (once) when null.
  - `renderDom(url, { profileDir })` → `Promise<string>` (DOM dump) using `run(CHROME, chromeArgs(...))`. Thin I/O wrapper, not unit-tested live.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/submit-browser.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.CLIPFARM_VAULT_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

const { chromeArgs, resolveProxy } = await import('../src/submit/browser.js');

test('chromeArgs includes proxy flag only when proxy given', () => {
  const withP = chromeArgs({ url: 'https://x', profileDir: '/p', proxy: 'http://1.2.3.4:8080' });
  assert.ok(withP.includes('--proxy-server=http://1.2.3.4:8080'));
  assert.ok(withP.includes('--user-data-dir=/p'));
  assert.ok(withP.some((a) => a === 'https://x'));
  const noP = chromeArgs({ url: 'https://x', profileDir: '/p', proxy: null });
  assert.ok(!noP.some((a) => a.startsWith('--proxy-server')));
});

test('resolveProxy reads env and returns null when unset', () => {
  assert.equal(resolveProxy({ CLIPFARM_PROXY: 'http://p' }), 'http://p');
  assert.equal(resolveProxy({}), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/submit-browser.test.js`
Expected: FAIL ("Cannot find module '../src/submit/browser.js'").

- [ ] **Step 3: Implement `src/submit/browser.js`**

```javascript
// src/submit/browser.js
// Proxy-aware headless Chrome wrapper. All Whop/social traffic routes through a
// residential proxy (env CLIPFARM_PROXY) to dodge datacenter-IP bot-checks;
// degrades to a direct connection (with a warning) when no proxy is set.
import { run } from '../core/exec.js';
import { log } from '../core/log.js';

const CHROME = process.env.CHROME_BIN || 'google-chrome';
let warnedNoProxy = false;

export function chromeArgs({ url, profileDir, proxy, dumpDom = true }) {
  const args = ['--headless=new', '--disable-gpu', '--no-sandbox',
    '--virtual-time-budget=15000', `--user-data-dir=${profileDir}`];
  if (proxy) args.push(`--proxy-server=${proxy}`);
  if (dumpDom) args.push('--dump-dom');
  args.push(url);
  return args;
}

export function resolveProxy(env = process.env) {
  const proxy = env.CLIPFARM_PROXY || null;
  if (!proxy && !warnedNoProxy) {
    warnedNoProxy = true;
    log.warn('browser: no CLIPFARM_PROXY set — using direct connection (datacenter-IP bot-check risk)');
  }
  return proxy;
}

export async function renderDom(url, { profileDir }) {
  const proxy = resolveProxy();
  const { out } = await run(CHROME, chromeArgs({ url, profileDir, proxy }), { timeoutMs: 60000 });
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/submit-browser.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/submit/browser.js tests/submit-browser.test.js
git commit -m "feat(submit): proxy-aware headless Chrome launcher"
```

---

### Task 5: Universal analytics capture + Tier-1 parse

**Files:**
- Create: `src/submit/analytics.js`
- Test: `tests/submit-analytics.test.js`

**Interfaces:**
- Consumes: `renderDom` from `src/submit/browser.js` (injectable for tests).
- Produces:
  - `parseTier1(text, tier1=['US','UK','CA','AU'])` → number (sum of % for tier-1 countries found in analytics text), or `null` if no demographics rows detected. Recognizes lines like `United States 32%`, `United Kingdom 10%`, `Canada 5%`, `Australia 4%` and ISO forms `US 32%`.
  - `analyticsReady(text)` → bool (true when at least one country-percent demographics row is present).
  - `captureAnalytics({ platform, postUrl, profileDir, tier1, render=renderDom })` → `Promise<{ ready, tier1Pct, text }>`. `render` is injected so tests pass a fake. Adapter chooses the analytics URL per platform via `ANALYTICS_URL[platform](postUrl)`.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/submit-analytics.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.CLIPFARM_VAULT_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

const { parseTier1, analyticsReady, captureAnalytics } = await import('../src/submit/analytics.js');

const DEMO = `Audience
United States 40%
United Kingdom 8%
Canada 6%
Australia 4%
Germany 12%`;

test('parseTier1 sums tier-1 country percentages', () => {
  assert.equal(parseTier1(DEMO), 58); // 40+8+6+4
});

test('parseTier1 returns null when no demographics present', () => {
  assert.equal(parseTier1('Overview\nViews 1234\nLikes 5'), null);
});

test('analyticsReady detects rendered demographics', () => {
  assert.equal(analyticsReady(DEMO), true);
  assert.equal(analyticsReady('still loading...'), false);
});

test('captureAnalytics uses injected render and reports tier1Pct', async () => {
  const res = await captureAnalytics({
    platform: 'youtube', postUrl: 'https://youtu.be/abc', profileDir: '/p',
    render: async () => DEMO,
  });
  assert.equal(res.ready, true);
  assert.equal(res.tier1Pct, 58);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/submit-analytics.test.js`
Expected: FAIL ("Cannot find module '../src/submit/analytics.js'").

- [ ] **Step 3: Implement `src/submit/analytics.js`**

```javascript
// src/submit/analytics.js
// Universal analytics-screenshot/demographics capture. Per-platform adapters point
// at the posted video's analytics; we parse Tier-1 audience % from the rendered text.
import { renderDom } from './browser.js';

const COUNTRY = {
  'united states': 'US', 'us': 'US', 'united kingdom': 'UK', 'uk': 'UK',
  'canada': 'CA', 'ca': 'CA', 'australia': 'AU', 'au': 'AU',
};

export const ANALYTICS_URL = {
  youtube: (u) => `https://studio.youtube.com/video/${ytId(u)}/analytics/tab-build_your_audience`,
  tiktok: (u) => u,        // TikTok analytics are in-app; adapter refined later
  instagram: (u) => u,     // IG insights are in-app; adapter refined later
};

function ytId(u) {
  const m = String(u).match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{6,})/);
  return m ? m[1] : '';
}

export function parseTier1(text, tier1 = ['US', 'UK', 'CA', 'AU']) {
  const rows = [...String(text).matchAll(/([A-Za-z][A-Za-z .]+?)\s+(\d{1,3})%/g)];
  if (!rows.length) return null;
  let sum = 0; let matched = false;
  for (const [, name, pct] of rows) {
    const code = COUNTRY[name.trim().toLowerCase()];
    if (code && tier1.includes(code)) { sum += Number(pct); matched = true; }
  }
  return matched ? sum : 0;
}

export function analyticsReady(text) {
  return /([A-Za-z][A-Za-z .]+?)\s+\d{1,3}%/.test(String(text));
}

export async function captureAnalytics({ platform, postUrl, profileDir, tier1, render = renderDom }) {
  const urlFor = ANALYTICS_URL[platform] || ((u) => u);
  const text = await render(urlFor(postUrl), { profileDir });
  return { ready: analyticsReady(text), tier1Pct: parseTier1(text, tier1), text };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/submit-analytics.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/submit/analytics.js tests/submit-analytics.test.js
git commit -m "feat(submit): universal analytics capture + Tier-1 audience parse"
```

---

### Task 6: Whop adapter — submission packet + selectors + rejection detection

**Files:**
- Create: `src/submit/whop.js`
- Create: `config/whop-selectors.json`
- Test: `tests/submit-whop.test.js`

**Interfaces:**
- Consumes: `getRules` from `src/campaigns/compliance.js`; `read` from `src/core/store.js`.
- Produces:
  - `buildPacket({ submission, clip, campaign })` → `{ title, link, demographicsImage, caption }` where `title = clip.title || clip.hook || 'Clip'`, `link = submission.postUrl`, `demographicsImage = submission.analyticsScreenshotPath`, `caption` includes `getRules(campaign).overlays.requiredCaptionText` when set.
  - `loadSelectors(path?)` → parsed `config/whop-selectors.json`.
  - `isAnalyticsRejection(text)` → bool — true when support text matches the "send your analytics/demographics" pattern (so the worker re-sends rather than giving up).
  - `SELECTOR_KEYS = ['submitButton','titleInput','linkInput','imageInput','submitConfirm','supportInput','supportSend']` (the contract `config/whop-selectors.json` must provide).

- [ ] **Step 1: Write the failing test**

```javascript
// tests/submit-whop.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.CLIPFARM_VAULT_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

const { buildPacket, loadSelectors, isAnalyticsRejection, SELECTOR_KEYS } = await import('../src/submit/whop.js');

test('buildPacket assembles title/link/image and required caption text', () => {
  const packet = buildPacket({
    submission: { postUrl: 'https://yt/v', analyticsScreenshotPath: '/d.png' },
    clip: { title: 'Insane moment', hook: 'wow' },
    campaign: { rules: { overlays: { requiredCaptionText: 'watch full @creator' } } },
  });
  assert.equal(packet.title, 'Insane moment');
  assert.equal(packet.link, 'https://yt/v');
  assert.equal(packet.demographicsImage, '/d.png');
  assert.ok(packet.caption.toLowerCase().includes('watch full @creator'));
});

test('loadSelectors provides every required selector key', () => {
  const sel = loadSelectors();
  for (const k of SELECTOR_KEYS) assert.ok(sel[k], `missing selector ${k}`);
});

test('isAnalyticsRejection matches the analytics-request rejection', () => {
  assert.equal(isAnalyticsRejection('Please send your full analytics / demographics'), true);
  assert.equal(isAnalyticsRejection('Approved — payout queued'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/submit-whop.test.js`
Expected: FAIL ("Cannot find module '../src/submit/whop.js'").

- [ ] **Step 3: Create `config/whop-selectors.json`**

```json
{
  "submitButton": "button:has-text('Submit Video')",
  "titleInput": "input[name='title']",
  "linkInput": "input[name='videoLink']",
  "imageInput": "input[type='file']",
  "submitConfirm": "button[type='submit']",
  "supportInput": "textarea[placeholder*='Message']",
  "supportSend": "button[aria-label='Send']"
}
```

- [ ] **Step 4: Implement `src/submit/whop.js`**

```javascript
// src/submit/whop.js
// Universal Whop / Content-Rewards adapter. Pure packet-building + rejection
// detection are unit-tested; CSS/text selectors live in config so a Whop UI change
// is a config edit, not a code rewrite. Live form-driving is gated + I/O-only.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getRules } from '../campaigns/compliance.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SELECTORS = join(HERE, '../../config/whop-selectors.json');

export const SELECTOR_KEYS = ['submitButton', 'titleInput', 'linkInput', 'imageInput',
  'submitConfirm', 'supportInput', 'supportSend'];

export function buildPacket({ submission, clip, campaign }) {
  const rules = getRules(campaign);
  const required = rules.overlays?.requiredCaptionText || '';
  const base = clip.title || clip.hook || 'Clip';
  const caption = required && !base.toLowerCase().includes(required.toLowerCase())
    ? `${base} — ${required}` : base;
  return {
    title: clip.title || clip.hook || 'Clip',
    link: submission.postUrl,
    demographicsImage: submission.analyticsScreenshotPath,
    caption,
  };
}

export function loadSelectors(path = DEFAULT_SELECTORS) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function isAnalyticsRejection(text) {
  return /\b(send|provide|share).{0,40}\b(analytics|demographics)\b/i.test(String(text));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/submit-whop.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/submit/whop.js config/whop-selectors.json tests/submit-whop.test.js
git commit -m "feat(submit): universal Whop adapter — submission packet, selectors, rejection detection"
```

---

### Task 7: Submit-tick orchestrator + worker wiring

**Files:**
- Create: `src/submit/index.js`
- Modify: `bin/worker.js` (call the submit tick)
- Test: `tests/submit-tick.test.js`

**Interfaces:**
- Consumes: `due`, `advance` from `src/submit/state.js`; `captureAnalytics` from `src/submit/analytics.js`; `read` from `src/core/store.js`; `log` from `src/core/log.js`.
- Produces:
  - `submitTick({ now=Date.now(), live=false, capture=captureAnalytics } = {})` → `Promise<{ advanced, waiting }>`. For each `due` submission in `awaiting-analytics`: call `capture`; if `ready` → `advance(id,'analytics',{...})`; else bump `nextActionAt` by ~24h and count as waiting. Live form-submission (`submitted`/`support-sent`) only runs when `live===true` (gated by `CLIPFARM_SUBMIT_LIVE=1` in the worker); dry-run logs intent and does not drive the browser.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/submit-tick.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.CLIPFARM_VAULT_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

const { createSubmission, advance, read } = {
  ...(await import('../src/submit/state.js')),
  read: (await import('../src/core/store.js')).read,
};
const { submitTick } = await import('../src/submit/index.js');

test('submitTick captures ready analytics and advances the submission', async () => {
  createSubmission({ campaignId: 'c1', clipId: 'tickA', platform: 'youtube' });
  const id = 'sub_tickA_youtube';
  advance(id, 'compliant');
  advance(id, 'post', { postUrl: 'https://youtu.be/abc' });
  advance(id, 'await');
  const res = await submitTick({
    capture: async () => ({ ready: true, tier1Pct: 61, text: 'US 61%' }),
  });
  assert.ok(res.advanced >= 1);
  const row = read('submissions').find((s) => s.id === id);
  assert.equal(row.status, 'analytics-captured');
  assert.equal(row.tier1Pct, 61);
});

test('submitTick leaves not-ready analytics waiting and pushes nextActionAt', async () => {
  createSubmission({ campaignId: 'c1', clipId: 'tickB', platform: 'youtube' });
  const id = 'sub_tickB_youtube';
  advance(id, 'compliant');
  advance(id, 'post', { postUrl: 'https://youtu.be/def' });
  advance(id, 'await');
  const res = await submitTick({
    now: 1000, capture: async () => ({ ready: false, tier1Pct: null, text: 'loading' }),
  });
  assert.ok(res.waiting >= 1);
  const row = read('submissions').find((s) => s.id === id);
  assert.equal(row.status, 'awaiting-analytics');
  assert.ok(row.nextActionAt > 1000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/submit-tick.test.js`
Expected: FAIL ("Cannot find module '../src/submit/index.js'").

- [ ] **Step 3: Implement `src/submit/index.js`**

```javascript
// src/submit/index.js
// One submit-tick: advance due submissions through the analytics gate. Live Whop
// form-driving is gated (live===true); dry-run only logs intent.
import { due, advance } from './state.js';
import { read } from '../core/store.js';
import { captureAnalytics as defaultCapture } from './analytics.js';
import { getRules } from '../campaigns/compliance.js';
import { log } from '../core/log.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function submitTick({ now = Date.now(), live = false, capture = defaultCapture } = {}) {
  let advanced = 0; let waiting = 0;
  for (const sub of due(now)) {
    if (sub.status === 'awaiting-analytics') {
      const campaign = read('campaigns').find((c) => c.id === sub.campaignId);
      const tier1 = getRules(campaign).audience.tier1;
      const res = await capture({ platform: sub.platform, postUrl: sub.postUrl,
        profileDir: `data/profiles/${sub.platform}`, tier1 });
      if (res.ready) {
        advance(sub.id, 'analytics', { analyticsScreenshotPath: res.text ? `data/analytics/${sub.id}.png` : null, tier1Pct: res.tier1Pct });
        advanced += 1;
      } else {
        advance(sub.id, 'await', { nextActionAt: now + DAY_MS }).status; // stays awaiting-analytics via no-op? see note
        // 'await' is invalid from awaiting-analytics; instead bump nextActionAt directly:
      }
    }
  }
  if (!live) log.info('submitTick: dry-run (set CLIPFARM_SUBMIT_LIVE=1 to drive Whop)', { advanced, waiting });
  return { advanced, waiting };
}
```

  Note: the placeholder above is intentionally wrong to be fixed in Step 4 (the `await` event is not valid from `awaiting-analytics`). Step 4 replaces the waiting branch with a direct `nextActionAt` bump via `upsert`.

- [ ] **Step 4: Fix the waiting branch to bump nextActionAt without an illegal transition**

Replace the whole file body of `src/submit/index.js` with the corrected version:

```javascript
// src/submit/index.js
import { due, advance } from './state.js';
import { read, upsert } from '../core/store.js';
import { captureAnalytics as defaultCapture } from './analytics.js';
import { getRules } from '../campaigns/compliance.js';
import { log } from '../core/log.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function submitTick({ now = Date.now(), live = false, capture = defaultCapture } = {}) {
  let advanced = 0; let waiting = 0;
  for (const sub of due(now)) {
    if (sub.status !== 'awaiting-analytics') continue;
    const campaign = read('campaigns').find((c) => c.id === sub.campaignId);
    const tier1 = getRules(campaign).audience.tier1;
    const res = await capture({ platform: sub.platform, postUrl: sub.postUrl,
      profileDir: `data/profiles/${sub.platform}`, tier1 });
    if (res.ready) {
      advance(sub.id, 'analytics', { analyticsScreenshotPath: `data/analytics/${sub.id}.png`, tier1Pct: res.tier1Pct });
      advanced += 1;
    } else {
      upsert('submissions', { id: sub.id, nextActionAt: now + DAY_MS });
      waiting += 1;
    }
  }
  if (!live) log.info('submitTick: dry-run (set CLIPFARM_SUBMIT_LIVE=1 to drive Whop)', { advanced, waiting });
  return { advanced, waiting };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/submit-tick.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Wire the submit tick into `bin/worker.js`**

In `bin/worker.js`, add the import near the others:

```javascript
import { submitTick } from '../src/submit/index.js';
```

And inside `main()`, after the existing `const r = await tick({ mode });` line, add:

```javascript
  const s = await submitTick({ live: process.env.CLIPFARM_SUBMIT_LIVE === '1' });
  log.info('worker: submit tick complete', s);
  console.log(`submit tick: advanced=${s.advanced} waiting=${s.waiting}`);
```

- [ ] **Step 7: Run the full suite + worker smoke**

Run: `npm test`
Expected: all tests green.
Run: `node bin/worker.js`
Expected: prints `worker tick: ...` and `submit tick: advanced=… waiting=…`, exit 0 (dry-run, no live action).

- [ ] **Step 8: Commit**

```bash
git add src/submit/index.js bin/worker.js tests/submit-tick.test.js
git commit -m "feat(submit): submit-tick orchestrator wired into worker (gated live)"
```

---

### Task 8: README + spec cross-reference

**Files:**
- Modify: `README.md` (document the submit bot, env vars, cron, ₪0/proxy note)

**Interfaces:** none (docs only).

- [ ] **Step 1: Append a "Whop Auto-Submit Bot" section to `README.md`**

```markdown
## Whop / Content-Rewards Auto-Submit Bot

Universal, data-driven submission to pay-per-view clipping campaigns. Each campaign
is just a rules row (`src/campaigns/compliance.js` schema); nothing is creator-specific.

**Flow (state machine):** drafted → clip-compliant → posted → awaiting-analytics →
analytics-captured → submitted → support-sent → (approved | rejected→resend) → paid.

**Setup (one-time):**
- Import logged-in cookies per identity into the encrypted session store (`src/submit/session.js`).
- Set `CLIPFARM_PROXY` to a residential proxy (recommended; datacenter IP is bot-check-prone).
  Without it the bot runs direct, with a logged warning.
- Tune `config/whop-selectors.json` if Whop's UI changes (config edit, not code).

**Run:** the worker advances submissions each tick.
`CLIPFARM_VAULT_KEY=… CLIPFARM_SUBMIT_LIVE=1 npm run worker`  (omit `CLIPFARM_SUBMIT_LIVE` for dry-run)
Cron: `*/15 * * * * cd /home/ops/clipfarm && CLIPFARM_VAULT_KEY=… npm run worker`

**Honest limits:** analytics screenshots need real posted-video demographics (1–2 day lag,
≥ campaign Tier-1 %); Support-Chat review is human and may reject pending analytics (auto
re-sent); AI-edit-banning campaigns route clips to human review instead of auto-posting.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document the universal Whop auto-submit bot + setup"
```

---

## Self-Review

- **Spec coverage:** rules schema (T1) ✓, state machine (T2) ✓, session vault (T3) ✓, proxy browser (T4) ✓, analytics+Tier-1 (T5) ✓, Whop adapter+selectors+rejection (T6) ✓, worker loop (T7) ✓, ₪0/proxy + AI-edit human-review + support escalation honesty flags (T4/T6/T7/README) ✓. Real TikTok/IG analytics adapters explicitly deferred (spec out-of-scope) — stubbed in `ANALYTICS_URL`.
- **Placeholder scan:** the only deliberate placeholder is the wrong waiting-branch in T7 Step 3, immediately corrected in Step 4 (TDD demonstrates the illegal transition); all other steps carry complete code.
- **Type consistency:** `advance(id,event,patch)`, `due(now)`, `createSubmission({campaignId,clipId,platform})`, `captureAnalytics({platform,postUrl,profileDir,tier1,render})`, `buildPacket({submission,clip,campaign})`, `chromeArgs({url,profileDir,proxy,dumpDom})` used consistently across tasks. Store collection `submissions`/`sessions`/`campaigns` consistent. Vault `encrypt/decrypt/fingerprint` names match `src/vault/index.js`.
