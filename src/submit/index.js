// src/submit/index.js
// One submit-tick: advance due submissions through the analytics gate. Live Whop
// form-driving is gated (live===true); dry-run only logs intent.
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
