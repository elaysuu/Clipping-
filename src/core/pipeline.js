// Reusable per-source pipeline: source -> transcript -> moments -> clips.
// Shared by `bin/clip.js` (clips only) and `bin/run.js` (clips + publish).
import fs from 'node:fs';
import { join } from 'node:path';
import { ingest } from '../ingest/download.js';
import { getTranscript } from '../detect/transcript.js';
import { detectMoments } from '../detect/moments.js';
import { forgeClip } from '../forge/clip.js';
import { buildCaptions } from '../forge/captions.js';
import { PATHS, CFG } from './config.js';
import { upsert } from './store.js';
import { log } from './log.js';

export async function processSource(src, {
  campaignId = null, top = CFG.topMoments, reframe = 'fill', captions = true, render = true,
} = {}) {
  const source = await ingest(src);
  upsert('sources', { id: source.id, url: source.url, videoPath: source.videoPath, ingestedAt: new Date().toISOString() });

  const transcript = await getTranscript(source);
  if (!transcript) { const e = new Error('no transcript (no subs + whisper unavailable)'); e.code = 'NO_TRANSCRIPT'; throw e; }
  const segs = transcript.segments;
  const words = transcript.words;

  const moments = await detectMoments(segs, { top });
  if (!moments.length) { const e = new Error('no moments detected'); e.code = 'NO_MOMENTS'; throw e; }

  const outDir = join(PATHS.clips, source.id);
  fs.mkdirSync(outDir, { recursive: true });

  const clips = [];
  for (let i = 0; i < moments.length; i++) {
    const m = moments[i];
    const rank = String(i + 1).padStart(2, '0');
    const outPath = join(outDir, `clip_${rank}.mp4`);
    let forged = null;
    if (render) {
      let assPath = null;
      if (captions) {
        try {
          const ap = join(outDir, `clip_${rank}.ass`);
          const { count } = buildCaptions(segs, { start: m.start, end: m.end }, ap, { words });
          if (count > 0) assPath = ap;
        } catch (e) { log.warn('captions failed', { rank, err: e.message }); }
      }
      try { forged = await forgeClip({ videoPath: source.videoPath, start: m.start, end: m.end, outPath, reframe, assPath }); }
      catch (e) { log.error('forge failed', { rank, err: e.message }); }
    }
    const dur = +(m.end - m.start).toFixed(2);
    const clip = upsert('clips', {
      id: `${source.id}_${rank}`, sourceId: source.id, campaignId,
      rank: i + 1, score: m.score, hook: m.hook, caption: m.caption,
      start: m.start, end: m.end, dur, file: forged ? outPath : null,
      createdAt: new Date().toISOString(),
    });
    clips.push(clip);
  }

  const manifest = { source: { id: source.id, url: source.url }, campaignId, createdAt: new Date().toISOString(), clips };
  fs.writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  log.info('pipeline: source processed', { clips: clips.length, outDir });
  return { source, clips, outDir };
}
