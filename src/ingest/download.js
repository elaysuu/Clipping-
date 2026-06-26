// Source ingest: bring a source video onto disk + (free) auto-subtitles.
// Source-agnostic by design — clipping campaigns usually HAND you the raw VOD,
// so we accept three source kinds and never assume YouTube:
//   1. local file path (already on disk)
//   2. direct http(s) media URL (.mp4/.mkv/.webm/...)
//   3. yt-dlp-supported site (cookies via YTDLP_COOKIES when a site is hostile)
import fs from 'node:fs';
import { join, basename, extname } from 'node:path';
import { run } from '../core/exec.js';
import { PATHS } from '../core/config.js';
import { log } from '../core/log.js';

const YTDLP = process.env.YTDLP_BIN || `${process.env.HOME}/.local/bin/yt-dlp`;
const COOKIES = process.env.YTDLP_COOKIES || null; // path to a cookies.txt, optional

// Stable short id from the source ref for folder naming.
function idFor(ref) {
  return 'src_' + Buffer.from(ref).toString('base64url').slice(0, 16);
}

const VIDEO_EXT = /\.(mp4|mkv|webm|mov|m4v)$/i;

function classify(ref) {
  if (fs.existsSync(ref)) return 'local';
  if (/^https?:\/\//i.test(ref) && VIDEO_EXT.test(new URL(ref).pathname)) return 'direct';
  return 'ytdlp';
}

export async function ingest(url, { maxHeight = 1080 } = {}) {
  const id = idFor(url);
  const dir = join(PATHS.sources, id);
  fs.mkdirSync(dir, { recursive: true });
  const kind = classify(url);
  log.step('ingest: source', { url, id, kind });

  // --- local file: copy/link into the source dir, no network ---
  if (kind === 'local') {
    const dest = join(dir, 'source' + (extname(url) || '.mp4'));
    if (!fs.existsSync(dest)) fs.copyFileSync(url, dest);
    log.info('ingest: done (local)', { videoPath: dest });
    return { id, dir, url, videoPath: dest, subsPath: null };
  }

  // --- direct media URL: curl is more reliable than yt-dlp's generic extractor ---
  if (kind === 'direct') {
    const dest = join(dir, 'source' + (extname(new URL(url).pathname) || '.mp4'));
    await run('curl', ['-fsSL', '--max-time', '900', '-o', dest, url], { timeoutMs: 15 * 60 * 1000 });
    log.info('ingest: done (direct)', { videoPath: dest });
    return { id, dir, url, videoPath: dest, subsPath: null };
  }

  // --- yt-dlp site (YouTube/Twitch/etc.) with optional cookies ---
  const outTmpl = join(dir, 'source.%(ext)s');
  const cookieArgs = COOKIES ? ['--cookies', COOKIES] : [];
  await run(YTDLP, [
    ...cookieArgs,
    '-f', `bv*[height<=${maxHeight}]+ba/b[height<=${maxHeight}]/b`,
    '--merge-output-format', 'mp4',
    // Pull human + auto captions (free transcript when available).
    '--write-subs', '--write-auto-subs',
    '--sub-langs', 'en.*,en',
    '--sub-format', 'vtt',
    '--no-playlist',
    '-o', outTmpl,
    url,
  ], { timeoutMs: 15 * 60 * 1000, onLine: (l) => { if (/ETA|Destination|Merging/.test(l)) log.info(l.trim()); } });

  const files = fs.readdirSync(dir);
  const video = files.find((f) => f.startsWith('source.') && /\.(mp4|mkv|webm)$/.test(f));
  const subs = files.find((f) => f.endsWith('.vtt')) || null;
  if (!video) throw new Error('ingest: no video file produced');

  const videoPath = join(dir, video);
  const subsPath = subs ? join(dir, subs) : null;
  log.info('ingest: done', { videoPath, subs: !!subsPath });
  return { id, dir, url, videoPath, subsPath };
}
