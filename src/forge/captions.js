// Build burned-in "viral" captions (.ass) from transcript segments for one clip
// window. Short-form signature: big, bold, centered, high-contrast, 2-4 word
// chunks that flash in sync with speech. Pure ffmpeg/libass — zero deps, free.
import fs from 'node:fs';
import { CFG } from '../core/config.js';

function assTime(sec) {
  if (sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.round((sec - Math.floor(sec)) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

// Split a segment's text into timed 2-4 word chunks across its duration.
function chunkSegment(seg) {
  const words = seg.text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const perChunk = 3;
  const chunks = [];
  for (let i = 0; i < words.length; i += perChunk) chunks.push(words.slice(i, i + perChunk).join(' '));
  const span = Math.max(0.4, seg.end - seg.start);
  const each = span / chunks.length;
  return chunks.map((text, i) => ({
    start: seg.start + i * each,
    end: seg.start + (i + 1) * each,
    text: text.toUpperCase(),
  }));
}

// Group word-level entries into karaoke phrase lines.
function wordsToLines(words, maxWords = 4, maxDur = 2.0) {
  const lines = [];
  let cur = null;
  for (const w of words) {
    if (!cur || cur.words.length >= maxWords || (w.end - cur.start) > maxDur) {
      cur = { start: w.start, end: w.end, words: [w] };
      lines.push(cur);
    } else { cur.end = w.end; cur.words.push(w); }
  }
  return lines;
}

// segments: full-video [{start,end,text}]; window: clip [start,end] in source secs.
// opts.words (optional) [{start,end,text}] → word-by-word karaoke highlight.
// Output .ass uses times RELATIVE to the clip start (forge cuts with -ss).
export function buildCaptions(segments, { start, end }, assPath, opts = {}) {
  const W = CFG.outW, H = CFG.outH;
  const fontSize = Math.round(H * 0.046);
  const marginV = Math.round(H * 0.27);
  const marginLR = Math.round(W * 0.09);
  // PrimaryColour = spoken (accent green, ASS is &HAABBGGRR), SecondaryColour = unspoken (white).
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Pop,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H66000000,1,1,${Math.round(fontSize*0.14)},2,2,${marginLR},${marginLR},${marginV},1
Style: Kara,Arial,${fontSize},&H00B6F25C,&H00FFFFFF,&H00000000,&H66000000,1,1,${Math.round(fontSize*0.14)},2,2,${marginLR},${marginLR},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const clean = (t) => String(t).replace(/[{}]/g, '').replace(/\\/g, '').trim();
  const lines = [];
  const words = (opts.words || []).filter((w) => w.end > start && w.start < end);

  if (words.length) {
    // word-by-word karaoke: highlight sweeps across each word as it's spoken
    for (const ln of wordsToLines(words)) {
      const cs = Math.max(0, ln.start - start);
      const ce = Math.min(end - start, ln.end - start);
      if (ce <= cs) continue;
      const text = ln.words.map((w) => {
        const k = Math.max(6, Math.round((w.end - w.start) * 100)); // centiseconds
        return `{\\kf${k}}${clean(w.text).toUpperCase()} `;
      }).join('');
      const eff = `{\\fad(50,40)}`;
      lines.push(`Dialogue: 0,${assTime(cs)},${assTime(ce)},Kara,,0,0,0,,${eff}${text.trim()}`);
    }
  } else {
    // phrase-chunk fallback (subtitle sources have no per-word timing)
    for (const seg of segments) {
      if (seg.end <= start || seg.start >= end) continue;
      for (const c of chunkSegment(seg)) {
        const cs = Math.max(0, c.start - start);
        const ce = Math.max(cs + 0.2, Math.min(end - start, c.end - start));
        if (ce <= 0) continue;
        const eff = `{\\fad(60,40)\\fscx108\\fscy108\\t(0,120,\\fscx100\\fscy100)}`;
        lines.push(`Dialogue: 0,${assTime(cs)},${assTime(ce)},Pop,,0,0,0,,${eff}${clean(c.text).toUpperCase()}`);
      }
    }
  }
  fs.writeFileSync(assPath, header + lines.join('\n') + '\n');
  return { assPath, count: lines.length };
}
