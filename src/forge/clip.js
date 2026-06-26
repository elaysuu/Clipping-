// Clip Forge: cut a segment and reframe to vertical 9:16 short-form.
// Caption burning is layered on separately (needs a transcript) — kept optional
// so the cut+reframe path works with zero transcript.
import fs from 'node:fs';
import { join } from 'node:path';
import { run } from '../core/exec.js';
import { CFG, PATHS } from '../core/config.js';
import { log } from '../core/log.js';

// Reframe strategies:
//  - 'fill'  : scale to cover then center-crop (best for action / centered subject)
//  - 'blur'  : contain the source, fill the bars with a blurred copy (keeps full frame)
function reframeFilter(mode, w, h) {
  if (mode === 'blur') {
    return [
      `[0:v]split=2[bg][fg]`,
      `[bg]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=40:8[bgb]`,
      `[fg]scale=${w}:${h}:force_original_aspect_ratio=decrease[fgs]`,
      `[bgb][fgs]overlay=(W-w)/2:(H-h)/2[v]`,
    ].join(';');
  }
  // default: fill
  return `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}[v]`;
}

export async function forgeClip({
  videoPath,
  start,
  end,
  outPath,
  reframe = 'fill',
  assPath = null, // optional burned-subtitle file
}) {
  const dur = +(end - start).toFixed(2);
  if (dur <= 0) throw new Error(`forge: bad window ${start}->${end}`);
  fs.mkdirSync(join(outPath, '..'), { recursive: true });

  let vfilter = reframeFilter(reframe, CFG.outW, CFG.outH);
  let map = '[v]';
  if (assPath) {
    // chain subtitles onto the reframed stream
    vfilter += `;[v]subtitles=${assPath.replace(/:/g, '\\:').replace(/'/g, "\\'")}[vs]`;
    map = '[vs]';
  }

  const args = [
    '-y',
    '-ss', String(start),
    '-i', videoPath,
    '-t', String(dur),
    '-filter_complex', vfilter,
    '-map', map,
    '-map', '0:a?',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    '-r', '30',
    outPath,
  ];
  log.step('forge: cutting clip', { start, dur, reframe, captions: !!assPath, outPath });
  await run('ffmpeg', args, { timeoutMs: 10 * 60 * 1000 });

  const size = fs.statSync(outPath).size;
  log.info('forge: clip ready', { outPath, bytes: size });
  return { outPath, start, end, dur, bytes: size };
}
