// YouTube Shorts adapter. SAFE BY DEFAULT:
//   - mode 'dry-run' (default): validate the file + build metadata, upload NOTHING.
//   - mode 'live': actually upload — GATED behind CLIPFARM_PUBLISH_LIVE=1 AND an
//     explicit privacyStatus. Defaults to 'private' so nothing goes public by
//     accident. googleapis is lazy-imported (resolved from a sibling install).
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { log } from '../core/log.js';

const require = createRequire(import.meta.url);

async function loadGoogleapis() {
  const roots = [`${process.env.HOME}/Youtubeauto/node_modules`, `${process.env.HOME}/clipfarm/node_modules`];
  try { return (await import('googleapis')).google; } catch {}
  for (const root of roots) {
    try { return (await import(require.resolve('googleapis', { paths: [root] }))).google; } catch {}
  }
  throw new Error('googleapis not installed (live upload unavailable)');
}

function tokenPath() {
  return process.env.YT_TOKEN || `${process.env.HOME}/Youtubeauto/tokens/youtube-token.json`;
}

export async function publishYouTube(clip, meta, { mode = 'dry-run', privacyStatus = 'private' } = {}) {
  if (!clip.file || !fs.existsSync(clip.file)) {
    return { platform: 'youtube', status: 'failed', error: 'clip file missing' };
  }

  if (mode !== 'live' || process.env.CLIPFARM_PUBLISH_LIVE !== '1') {
    log.info('youtube: DRY-RUN (no upload)', { title: meta.title, privacyStatus });
    return { platform: 'youtube', status: 'dry-run', title: meta.title, privacyStatus, wouldUpload: clip.file };
  }

  // --- live upload (gated) ---
  const google = await loadGoogleapis();
  const tok = JSON.parse(fs.readFileSync(tokenPath(), 'utf8'));
  const auth = new google.auth.OAuth2(tok.client_id, tok.client_secret);
  auth.setCredentials(tok.tokens || tok);
  const yt = google.youtube({ version: 'v3', auth });
  log.step('youtube: LIVE upload', { title: meta.title, privacyStatus });
  const res = await yt.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: { title: meta.title, description: meta.description, tags: meta.tags },
      status: { privacyStatus, selfDeclaredMadeForKids: false },
    },
    media: { body: fs.createReadStream(clip.file) },
  });
  const id = res.data.id;
  return { platform: 'youtube', status: 'posted', url: `https://youtube.com/shorts/${id}`, id, privacyStatus };
}
