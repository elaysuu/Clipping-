// Scheduler/queue — the worker drains this respecting cadence, so an "army" of
// accounts posts steadily over time instead of in a detectable burst.
// schedules {id, clipId, accountId, platform, status: queued|done|skipped, createdAt, postedAt}
import { read, upsert, write } from '../core/store.js';
import { listAccounts } from '../accounts/index.js';
import { channelsForClip } from '../channels/match.js';
import { canAccountPost, stampPosted } from './cadence.js';
import { publishClip } from './index.js';
import { log } from '../core/log.js';

export function enqueue(clipId, accountId, platform = 'youtube') {
  return upsert('schedules', {
    id: `sch_${clipId}_${accountId}_${platform}`, clipId, accountId, platform,
    status: 'queued', createdAt: new Date().toISOString(), postedAt: null,
  });
}

// Smart routing: each approved clip → the connected account(s) whose channel niche
// best fits the clip's campaign, queued on that account's platform.
export function enqueueApproved() {
  const accounts = new Map(read('accounts').map((a) => [a.id, a]));
  const channels = read('channels');
  let queued = 0;
  for (const clip of read('clips').filter((c) => c.status === 'approved' && c.file)) {
    const fitChannels = channelsForClip(clip).filter((ch) => ch.accountId && accounts.has(ch.accountId));
    const targets = fitChannels.length ? fitChannels : channels.filter((ch) => ch.accountId);
    for (const ch of targets) { enqueue(clip.id, ch.accountId, accounts.get(ch.accountId).platform || 'youtube'); queued++; }
  }
  log.info('scheduler: enqueued approved clips', { queued });
  return queued;
}

// One worker tick: post at most ONE queued item per eligible account (cadence-gated),
// so multi-account posting is naturally staggered across ticks.
export async function tick({ mode = 'dry-run' } = {}) {
  const queued = read('schedules').filter((s) => s.status === 'queued');
  if (!queued.length) return { posted: 0, skipped: 0 };
  const accounts = new Map(read('accounts').map((a) => [a.id, a]));

  let posted = 0, skipped = 0;
  const usedAccounts = new Set();
  for (const sch of queued) {
    if (usedAccounts.has(sch.accountId)) continue; // one per account per tick
    const account = accounts.get(sch.accountId);
    if (!account) { upsert('schedules', { id: sch.id, status: 'skipped' }); skipped++; continue; }
    const gate = canAccountPost(account);
    if (!gate.ok) { skipped++; continue; }

    try {
      const r = await publishClip({ clipId: sch.clipId, platform: sch.platform, account: account.id, mode });
      upsert('schedules', { id: sch.id, status: 'done', postedAt: new Date().toISOString() });
      if (r.status === 'posted') stampPosted(account.id);
      usedAccounts.add(sch.accountId);
      posted++;
    } catch (e) { log.warn('scheduler: post failed', { sch: sch.id, err: e.message }); skipped++; }
  }
  log.info('scheduler: tick done', { posted, skipped });
  return { posted, skipped };
}

export const listSchedules = () => read('schedules');
export const clearDone = () => write('schedules', read('schedules').filter((s) => s.status === 'queued'));
