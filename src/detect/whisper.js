// Local Whisper transcription fallback (free, offline) for sources with no subs.
// Uses transformers.js (ONNX) — declared optional; resolved from a sibling
// install if this repo hasn't installed it yet. Model weights download once.
import { createRequire } from 'node:module';
import { run } from '../core/exec.js';
import { log } from '../core/log.js';

const require = createRequire(import.meta.url);

// transformers.js is ESM; resolve its location robustly, then dynamic-import.
async function loadTransformers() {
  const candidates = ['@xenova/transformers', '@huggingface/transformers'];
  const extraRoots = [`${process.env.HOME}/Youtubeauto/node_modules`];
  for (const name of candidates) {
    try { return await import(name); } catch {}
    for (const root of extraRoots) {
      try { return await import(require.resolve(name, { paths: [root] })); } catch {}
    }
  }
  throw new Error('transformers.js not installed (npm i @xenova/transformers)');
}

// Decode media to raw 16kHz mono float32 PCM via ffmpeg → Float32Array.
async function decodePcm(videoPath) {
  const { spawn } = await import('node:child_process');
  return await new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-i', videoPath, '-f', 'f32le', '-ac', '1', '-ar', '16000', '-vn', 'pipe:1'], { stdio: ['ignore', 'pipe', 'ignore'] });
    const chunks = [];
    ff.stdout.on('data', (d) => chunks.push(d));
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code !== 0 && !chunks.length) return reject(new Error('ffmpeg pcm decode failed'));
      const buf = Buffer.concat(chunks);
      resolve(new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4)));
    });
  });
}

let _asr = null;
async function getAsr() {
  if (_asr) return _asr;
  const { pipeline, env } = await loadTransformers();
  env.allowLocalModels = true; // cache weights under node_modules/.cache
  const model = process.env.WHISPER_MODEL || 'Xenova/whisper-tiny.en';
  log.step('whisper: loading model', { model });
  _asr = await pipeline('automatic-speech-recognition', model);
  return _asr;
}

// Returns [{start,end,text}] segments.
export async function transcribe(videoPath) {
  const asr = await getAsr();
  const audio = await decodePcm(videoPath);
  log.step('whisper: transcribing', { samples: audio.length, secs: Math.round(audio.length / 16000) });
  const out = await asr(audio, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
  const chunks = out?.chunks || [];
  const segs = chunks
    .filter((c) => c.timestamp && c.text?.trim())
    .map((c) => ({ start: c.timestamp[0] ?? 0, end: c.timestamp[1] ?? (c.timestamp[0] + 2), text: c.text.trim() }));
  if (!segs.length && out?.text) segs.push({ start: 0, end: audio.length / 16000, text: out.text.trim() });
  return segs;
}
