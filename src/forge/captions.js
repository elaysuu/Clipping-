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

// segments: full-video [{start,end,text}]; window: clip [start,end] in source secs.
// Output .ass uses times RELATIVE to the clip start (forge cuts with -ss).
export function buildCaptions(segments, { start, end }, assPath) {
  const W = CFG.outW, H = CFG.outH;
  const fontSize = Math.round(H * 0.046);
  const marginV = Math.round(H * 0.27); // sit in lower third
  const marginLR = Math.round(W * 0.09); // keep text off the edges
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Pop,Arial,${fontSize},&H00FFFFFF,&H00000000,&H66000000,1,1,${Math.round(fontSize*0.14)},2,2,${marginLR},${marginLR},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const lines = [];
  for (const seg of segments) {
    if (seg.end <= start || seg.start >= end) continue; // outside clip
    for (const c of chunkSegment(seg)) {
      const cs = Math.max(0, c.start - start);
      const ce = Math.max(cs + 0.2, Math.min(end - start, c.end - start));
      if (ce <= 0) continue;
      const text = c.text.replace(/[{}]/g, '').replace(/\\/g, '');
      // subtle pop-in scale
      const eff = `{\\fad(60,40)\\fscx108\\fscy108\\t(0,120,\\fscx100\\fscy100)}`;
      lines.push(`Dialogue: 0,${assTime(cs)},${assTime(ce)},Pop,,0,0,0,,${eff}${text}`);
    }
  }
  fs.writeFileSync(assPath, header + lines.join('\n') + '\n');
  return { assPath, count: lines.length };
}
