// Posting cadence — the ban-avoidance gate. Conservative by default: a per-account
// daily cap + a minimum gap between posts, with jitter so timing isn't robotic.
// "Cadence-safe by local rules" — reduces (never guarantees) platform risk.
import { read, upsert } from '../core/store.js';

export const DEFAULTS = { dailyCap: 3, minGapHours: 3, jitterMin: 20 };

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

// Pure core: can this account post at `now` given its recent post timestamps?
export function canPost({ dailyCap = DEFAULTS.dailyCap, minGapHours = DEFAULTS.minGapHours }, postTimes, now) {
  const today = postTimes.filter((t) => sameDay(t, now));
  if (today.length >= dailyCap) return { ok: false, reason: `daily cap ${dailyCap} reached`, nextSafeAt: null };
  const last = postTimes.length ? Math.max(...postTimes.map((t) => +new Date(t))) : 0;
  const gapMs = minGapHours * 3600 * 1000;
  if (last && (+new Date(now) - last) < gapMs) {
    return { ok: false, reason: `min gap ${minGapHours}h not elapsed`, nextSafeAt: new Date(last + gapMs).toISOString() };
  }
  return { ok: true, reason: 'clear', nextSafeAt: null };
}

// Store-backed: gate a real account using its recorded posts.
export function canAccountPost(account, now = new Date().toISOString()) {
  const times = read('posts')
    .filter((p) => p.accountId === account.id && p.status === 'posted' && p.postedAt)
    .map((p) => p.postedAt);
  const policy = { dailyCap: account.dailyCap || DEFAULTS.dailyCap, minGapHours: account.minGapHours || DEFAULTS.minGapHours };
  return canPost(policy, times, now);
}

// After a successful post, stamp the account so the next gap is enforced.
export function stampPosted(accountId, now = new Date().toISOString()) {
  const acc = read('accounts').find((a) => a.id === accountId);
  if (!acc) return;
  const jitter = (DEFAULTS.jitterMin + (accountId.length % 17)) * 60 * 1000; // deterministic per-account jitter
  upsert('accounts', {
    id: accountId, lastPostAt: now,
    nextSafePostAt: new Date(+new Date(now) + (acc.minGapHours || DEFAULTS.minGapHours) * 3600 * 1000 + jitter).toISOString(),
  });
}
