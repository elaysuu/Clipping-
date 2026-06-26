// TikTok + Instagram adapters — intentionally inert until accounts are connected.
// These platforms need Elay's own account + API access (TikTok Content Posting
// API / Instagram Graph API, or an authorized session). Until then they return
// 'needs-account' so the pipeline records intent without any outward action.
import fs from 'node:fs';

function guard(clip, platform) {
  if (!clip.file || !fs.existsSync(clip.file)) return { platform, status: 'failed', error: 'clip file missing' };
  return { platform, status: 'needs-account', note: `${platform} requires a connected account + API/session (not configured)` };
}

export async function publishTikTok(clip /*, meta, opts */) { return guard(clip, 'tiktok'); }
export async function publishInstagram(clip /*, meta, opts */) { return guard(clip, 'instagram'); }
