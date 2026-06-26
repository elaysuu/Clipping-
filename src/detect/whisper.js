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
  // Default is MULTILINGUAL (whisper-base) so Hebrew/other-language sources work.
  // Override with WHISPER_MODEL (e.g. Xenova/whisper-tiny.en for English-only speed).
  const model = process.env.WHISPER_MODEL || 'Xenova/whisper-base';
  log.step('whisper: loading model', { model });
  _asr = await pipeline('automatic-speech-recognition', model);
  return _asr;
}

// Group word-level chunks into ~phrase segments for the moment ranker.
function wordsToSegments(words, maxGap = 0.8, maxLen = 6) {
  const segs = [];
  let cur = null;
  for (const w of words) {
    if (!cur || w.start - cur.end > maxGap || cur._n >= maxLen) {
      cur = { start: w.start, end: w.end, text: w.text, _n: 1 };
      segs.push(cur);
    } else { cur.end = w.end; cur.text += ' ' + w.text; cur._n++; }
  }
  return segs.map(({ _n, ...s }) => ({ ...s, text: s.text.trim() }));
}

// Returns { segments:[{start,end,text}], words:[{start,end,text}] }.
export async function transcribe(videoPath) {
  const asr = await getAsr();
  const audio = await decodePcm(videoPath);
  log.step('whisper: transcribing', { samples: audio.length, secs: Math.round(audio.length / 16000) });
  const opts = { chunk_length_s: 30, stride_length_s: 5, return_timestamps: 'word' };
  if (process.env.WHISPER_LANGUAGE) opts.language = process.env.WHISPER_LANGUAGE;
  let out;
  try { out = await asr(audio, opts); }
  catch { out = await asr(audio, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true }); }

  const chunks = out?.chunks || [];
  const words = chunks
    .filter((c) => c.timestamp && c.text?.trim())
    .map((c) => ({ start: c.timestamp[0] ?? 0, end: c.timestamp[1] ?? ((c.timestamp[0] ?? 0) + 0.4), text: c.text.trim() }));

  // word-mode → derive phrase segments; sentence-mode → chunks already are segments
  const looksWordLevel = words.length && words.every((w) => (w.end - w.start) <= 2.2);
  const segments = looksWordLevel ? wordsToSegments(words)
    : words.map((w) => ({ start: w.start, end: w.end, text: w.text }));
  if (!segments.length && out?.text) segments.push({ start: 0, end: audio.length / 16000, text: out.text.trim() });
  return { segments, words: looksWordLevel ? words : null };
}
