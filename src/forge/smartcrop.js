// Speaker-aware vertical crop. No OpenCV available, so we use a lightweight ONNX
// object detector (transformers.js, free/offline) to locate the dominant person
// across a few sampled frames, then crop the 9:16 window around them instead of
// blind-centering. Falls back to center when no person is found (e.g. b-roll).
import fs from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import os from 'node:os';
import { run } from '../core/exec.js';
import { log } from '../core/log.js';

const require = createRequire(import.meta.url);

async function loadTransformers() {
  const roots = [`${process.env.HOME}/Youtubeauto/node_modules`, `${process.env.HOME}/clipfarm/node_modules`];
  try { return await import('@xenova/transformers'); } catch {}
  for (const r of roots) { try { return await import(require.resolve('@xenova/transformers', { paths: [r] })); } catch {} }
  throw new Error('transformers.js not installed');
}

let _det = null;
async function detector() {
  if (_det) return _det;
  const t = await loadTransformers();
  t.env.allowLocalModels = true;
  const model = process.env.SMARTCROP_MODEL || 'Xenova/yolos-tiny';
  log.step('smartcrop: loading detector', { model });
  _det = { pipe: await t.pipeline('object-detection', model), RawImage: t.RawImage };
  return _det;
}

// Sample frames in [start,end] and return the median horizontal center of the
// dominant person as a fraction 0..1 of frame width (or null if none seen).
export async function subjectXFraction(videoPath, start, end, { samples = 5 } = {}) {
  let det;
  try { det = await detector(); } catch (e) { log.warn('smartcrop: detector unavailable', { err: e.message }); return null; }
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'cf_sc_'));
  const dur = Math.max(1, end - start);
  const xs = [];
  try {
    for (let i = 0; i < samples; i++) {
      const t = start + (dur * (i + 0.5)) / samples;
      const frame = join(dir, `f${i}.png`);
      try {
        await run('ffmpeg', ['-y', '-ss', String(t), '-i', videoPath, '-frames:v', '1', '-vf', 'scale=640:-1', frame], { timeoutMs: 30000 });
        const img = await det.RawImage.read(frame);
        const found = await det.pipe(img, { threshold: 0.4 });
        const people = found.filter((d) => d.label === 'person');
        if (!people.length) continue;
        // pick the largest person (closest/main speaker)
        people.sort((a, b) => ((b.box.xmax - b.box.xmin) * (b.box.ymax - b.box.ymin)) - ((a.box.xmax - a.box.xmin) * (a.box.ymax - a.box.ymin)));
        const p = people[0].box;
        xs.push(((p.xmin + p.xmax) / 2) / img.width);
      } catch {}
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  if (!xs.length) return null;
  xs.sort((a, b) => a - b);
  const median = xs[Math.floor(xs.length / 2)];
  log.info('smartcrop: subject center', { frac: +median.toFixed(3), hits: xs.length });
  return median;
}
