// Campaign compliance + payout-submission model — the money-critical layer.
// A viral clip earns $0 if it breaks the campaign's rules or is never registered
// for attribution. This captures per-campaign rules, checks a clip/post against
// them, and tracks the submission lifecycle.
//
// campaign.rules {minDuration,maxDuration,platforms[],requiredHashtags[],
//                 requiredMention,minViewsForPayout,notes}
// submissions {id,postId,clipId,campaignId,url,status,checkedAt,submittedAt,paidAt}
//             status: draft|ready|submitted|approved|rejected|paid
import { read, upsert } from '../core/store.js';

// Sensible defaults so a campaign without explicit rules still gets a basic check.
export const DEFAULT_RULES = {
  minDuration: 5, maxDuration: 180, platforms: ['youtube', 'tiktok', 'instagram'],
  requiredHashtags: [], requiredMention: '', minViewsForPayout: 0, notes: '',
};

export function getRules(campaign) {
  return { ...DEFAULT_RULES, ...(campaign?.rules || {}) };
}

export function setRules(campaignId, rules) {
  const norm = {
    minDuration: Number(rules.minDuration) || DEFAULT_RULES.minDuration,
    maxDuration: Number(rules.maxDuration) || DEFAULT_RULES.maxDuration,
    platforms: Array.isArray(rules.platforms) ? rules.platforms : String(rules.platforms || '').split(',').map((s) => s.trim()).filter(Boolean),
    requiredHashtags: Array.isArray(rules.requiredHashtags) ? rules.requiredHashtags : String(rules.requiredHashtags || '').split(/[,\s]+/).filter(Boolean),
    requiredMention: String(rules.requiredMention || '').trim(),
    minViewsForPayout: Number(rules.minViewsForPayout) || 0,
    notes: String(rules.notes || '').trim(),
  };
  return upsert('campaigns', { id: campaignId, rules: norm });
}

// Check a clip (+ optional post metadata) against a campaign's rules.
// Returns { ok, violations:[{rule,detail}] }.
export function checkCompliance({ clip, campaign, platform, caption }) {
  const r = getRules(campaign);
  const v = [];
  const dur = Number(clip?.dur) || 0;
  if (dur && dur < r.minDuration) v.push({ rule: 'minDuration', detail: `${dur}s < ${r.minDuration}s min` });
  if (dur && dur > r.maxDuration) v.push({ rule: 'maxDuration', detail: `${dur}s > ${r.maxDuration}s max` });
  if (platform && r.platforms.length && !r.platforms.includes(platform))
    v.push({ rule: 'platform', detail: `${platform} not in [${r.platforms.join(', ')}]` });
  const text = `${caption || ''} ${clip?.caption || ''}`.toLowerCase();
  for (const tag of r.requiredHashtags) {
    if (!text.includes(tag.toLowerCase().replace(/^#?/, '#')) && !text.includes(tag.toLowerCase()))
      v.push({ rule: 'requiredHashtag', detail: `missing ${tag}` });
  }
  if (r.requiredMention && !text.includes(r.requiredMention.toLowerCase()))
    v.push({ rule: 'requiredMention', detail: `missing mention ${r.requiredMention}` });
  return { ok: v.length === 0, violations: v };
}

// Submission lifecycle (the actual payout registration step).
export function recordSubmission({ postId, clipId, campaignId, url, status = 'submitted' }) {
  return upsert('submissions', {
    id: `sub_${postId}`, postId, clipId, campaignId, url,
    status, submittedAt: new Date().toISOString(), paidAt: null,
  });
}

export function setSubmissionStatus(id, status) {
  const patch = { id, status };
  if (status === 'paid') patch.paidAt = new Date().toISOString();
  return upsert('submissions', patch);
}

export const listSubmissions = () => read('submissions');
