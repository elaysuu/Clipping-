#!/usr/bin/env node
// ClipFarm per-source pipeline:  source -> transcript -> ranked moments -> vertical clips
// Usage: node bin/clip.js <url|file> [--top N] [--reframe fill|blur] [--no-render]
import fs from 'node:fs';
import { join } from 'node:path';
import { ingest } from '../src/ingest/download.js';
import { getTranscript } from '../src/detect/transcript.js';
import { detectMoments } from '../src/detect/moments.js';
import { forgeClip } from '../src/forge/clip.js';
import { buildCaptions } from '../src/forge/captions.js';
import { PATHS, CFG } from '../src/core/config.js';
import { log } from '../src/core/log.js';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

async function main() {
  const src = process.argv[2];
  if (!src) { console.error('usage: clip <url|file> [--top N] [--reframe fill|blur] [--no-render]'); process.exit(1); }
  const top = Number(arg('top', CFG.topMoments));
  const reframe = arg('reframe', 'fill');
  const render = arg('no-render', false) ? false : true;
  const captions = arg('no-captions', false) ? false : true;

  const source = await ingest(src);

  const segs = await getTranscript(source);
  if (!segs) {
    log.error('pipeline: no transcript (no subs + whisper unavailable) — cannot rank moments');
    process.exit(2);
  }

  const moments = await detectMoments(segs, { top });
  if (!moments.length) { log.error('pipeline: no moments detected'); process.exit(3); }

  const outDir = join(PATHS.clips, source.id);
  fs.mkdirSync(outDir, { recursive: true });

  const manifest = { source: { id: source.id, url: source.url }, createdAt: new Date().toISOString(), clips: [] };
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
          const { count } = buildCaptions(segs, { start: m.start, end: m.end }, ap);
          if (count > 0) assPath = ap;
        } catch (e) { log.warn('captions failed', { rank, err: e.message }); }
      }
      try { forged = await forgeClip({ videoPath: source.videoPath, start: m.start, end: m.end, outPath, reframe, assPath }); }
      catch (e) { log.error('forge failed', { rank, err: e.message }); }
    }
    manifest.clips.push({ rank: i + 1, ...m, file: forged ? outPath : null, dur: +(m.end - m.start).toFixed(2) });
  }

  const manifestPath = join(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  log.info('pipeline: done', { clips: manifest.clips.length, manifestPath });
  console.log(`\n✅ ${manifest.clips.filter((c) => c.file).length}/${manifest.clips.length} clips in ${outDir}`);
  for (const c of manifest.clips) console.log(`  #${c.rank} [${c.score}] ${c.dur}s  "${c.hook}"  → ${c.file ? 'rendered' : 'meta-only'}`);
}

main().catch((e) => { log.error('pipeline crashed', { err: e.message }); process.exit(1); });
