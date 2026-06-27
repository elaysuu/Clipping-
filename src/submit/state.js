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
