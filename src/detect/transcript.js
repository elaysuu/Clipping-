// Transcript acquisition. Cheapest-first:
//   1. parse the .vtt subtitles yt-dlp already pulled (zero cost)
//   2. (fallback) local Whisper via @xenova/transformers — wired in whisper.js
import fs from 'node:fs';
import { log } from '../core/log.js';

function vttTimeToSec(t) {
  // HH:MM:SS.mmm or MM:SS.mmm
  const parts = t.split(':').map(Number);
  let s = 0;
  for (const p of parts) s = s * 60 + p;
  return s;
}

export function parseVtt(vttPath) {
  const raw = fs.readFileSync(vttPath, 'utf8');
  const segs = [];
  const blocks = raw.split(/\r?\n\r?\n/);
  for (const b of blocks) {
    const m = b.match(/(\d{1,2}:\d{2}:\d{2}\.\d{3}|\d{1,2}:\d{2}\.\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}\.\d{3}|\d{1,2}:\d{2}\.\d{3})/);
    if (!m) continue;
    const start = vttTimeToSec(m[1]);
    const end = vttTimeToSec(m[2]);
    const text = b
      .split(/\r?\n/)
      .slice(1)
      .join(' ')
      .replace(/<[^>]+>/g, '')        // strip karaoke/style tags
      .replace(/\s+/g, ' ')
      .trim();
    if (text) segs.push({ start, end, text });
  }
  // VTT auto-subs often duplicate lines across rolling cues — dedupe consecutive.
  const out = [];
  for (const s of segs) {
    const prev = out[out.length - 1];
    if (prev && prev.text === s.text) { prev.end = s.end; continue; }
    out.push(s);
  }
  return out;
}

// Returns { segments:[{start,end,text}], words:[…]|null } or null if none.
// words (when present) drive word-by-word "karaoke" captions; subs give no words.
export async function getTranscript({ subsPath, videoPath }) {
  if (subsPath && fs.existsSync(subsPath)) {
    const segments = parseVtt(subsPath);
    if (segments.length) { log.info('transcript: from subs', { segs: segments.length }); return { segments, words: null }; }
  }
  // fallback to whisper (loaded lazily — heavy dep)
  try {
    const { transcribe } = await import('./whisper.js');
    const t = await transcribe(videoPath);
    if (t?.segments?.length) { log.info('transcript: from whisper', { segs: t.segments.length, words: t.words?.length || 0 }); return t; }
  } catch (e) {
    log.warn('transcript: whisper unavailable', { err: e.message });
  }
  return null;
}
