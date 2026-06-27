#!/usr/bin/env node
// ClipFarm worker — one tick, meant to run on a cron (e.g. */15 * * * *), the
// durable pattern. Refreshes the campaign board (best-effort), enqueues approved
// clips to their matching channels, and drains the queue respecting cadence.
// Live publishing still requires CLIPFARM_PUBLISH_LIVE=1 + per-account live.
import { refreshBoard } from '../src/campaigns/fetch.js';
import { loadAndRank } from '../src/campaigns/radar.js';
import { upsert } from '../src/core/store.js';
import { enqueueApproved, tick } from '../src/publish/scheduler.js';
import { submitTick } from '../src/submit/index.js';
import { PATHS } from '../src/core/config.js';
import { join } from 'node:path';
import { log } from '../src/core/log.js';

const mode = process.env.CLIPFARM_PUBLISH_LIVE === '1' ? 'live' : 'dry-run';

async function main() {
  // 1. refresh + re-rank campaigns (best-effort)
  try {
    await refreshBoard();
    const { ranked } = loadAndRank(join(PATHS.state, 'board-snapshot.md'), { minRemaining: 500 });
    ranked.slice(0, 25).forEach((c) => upsert('campaigns', {
      id: 'cmp_' + Buffer.from(c.title).toString('base64url').slice(0, 16),
      title: c.title, cpm: c.cpm, total: c.total, paid: c.paid, remaining: c.remaining,
      score: c.score, genre: c.genre, platforms: c.platforms, updatedAt: new Date().toISOString(),
    }));
  } catch (e) { log.warn('worker: campaign refresh skipped', { err: e.message }); }

  // 2. enqueue approved clips → matching channels, then drain one slot per account
  enqueueApproved();
  const r = await tick({ mode });
  log.info('worker: tick complete', { mode, ...r });
  console.log(`worker tick: posted=${r.posted} skipped=${r.skipped} mode=${mode}`);

  // 3. advance Whop submissions through their human-gated state machine
  const s = await submitTick({ live: process.env.CLIPFARM_SUBMIT_LIVE === '1' });
  log.info('worker: submit tick complete', s);
  console.log(`submit tick: advanced=${s.advanced} waiting=${s.waiting}`);
}

main().catch((e) => { log.error('worker crashed', { err: e.message }); process.exit(1); });
