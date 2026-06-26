// Moment Detection: turn a timestamped transcript into ranked viral clip windows.
// Universal across genres — the LLM is told to hunt the short-form "banger"
// patterns (hook in first 2s, tension, payoff, emotion, controversy, quotables).
import { chat } from '../core/llm.js';
import { CFG } from '../core/config.js';
import { log } from '../core/log.js';

// Compress transcript to "[mm:ss] text" lines, capped to keep the prompt cheap.
function renderTranscript(segs, maxChars = 12000) {
  const lines = [];
  let total = 0;
  for (const s of segs) {
    const mm = String(Math.floor(s.start / 60)).padStart(2, '0');
    const ss = String(Math.floor(s.start % 60)).padStart(2, '0');
    const line = `[${mm}:${ss}] ${s.text}`;
    if (total + line.length > maxChars) break;
    lines.push(line);
    total += line.length;
  }
  return lines.join('\n');
}

const SYS = `You are an elite short-form clipper who has produced thousands of viral TikTok/Reels/Shorts.
Given a timestamped transcript, you find the segments most likely to go viral as standalone vertical clips.
A great clip: hooks in the first 2 seconds, is self-contained, carries one clear emotional or surprising beat
(shock, humor, controversy, insight, drama, a quotable line), and needs no outside context.
You reject filler, slow intros, and anything that only makes sense with surrounding video.`;

function buildPrompt(transcriptText, { clipMin, clipMax, top }) {
  return `TRANSCRIPT (timestamps are clip start references, in mm:ss):
${transcriptText}

Pick the ${top} BEST clip windows. Each clip must be between ${clipMin} and ${clipMax} seconds long.
Return STRICT JSON: {"clips":[{"start_sec":<number>,"end_sec":<number>,"score":<1-100>,"hook":"<≤7-word on-screen opener>","caption":"<scroll-stopping title/caption>","why":"<one line: why it pops>"}]}
Rules: start_sec/end_sec are absolute seconds from the video start. Order by score desc. JSON only, no prose.`;
}

function safeParse(txt) {
  try { return JSON.parse(txt); } catch {}
  const m = txt.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

export async function detectMoments(segs, { top = CFG.topMoments } = {}) {
  if (!segs?.length) return [];
  const lastEnd = segs[segs.length - 1].end;
  const transcriptText = renderTranscript(segs);
  const prompt = buildPrompt(transcriptText, { clipMin: CFG.clipMin, clipMax: CFG.clipMax, top });

  log.step('detect: ranking moments via LLM', { segs: segs.length, top });
  const raw = await chat(
    [{ role: 'system', content: SYS }, { role: 'user', content: prompt }],
    { temperature: 0.4, maxTokens: 1800, json: true },
  );
  const parsed = safeParse(raw);
  if (!parsed?.clips?.length) { log.warn('detect: no clips parsed', { raw: raw.slice(0, 200) }); return []; }

  // Sanitize: clamp to video bounds + enforce length window.
  const clips = [];
  for (const c of parsed.clips) {
    let start = Math.max(0, Number(c.start_sec));
    let end = Math.min(lastEnd, Number(c.end_sec));
    if (!(end > start)) continue;
    let dur = end - start;
    if (dur < CFG.clipMin) end = Math.min(lastEnd, start + CFG.clipMin);
    if (end - start > CFG.clipMax) end = start + CFG.clipMax;
    clips.push({
      start: +start.toFixed(2),
      end: +end.toFixed(2),
      score: Math.round(Number(c.score) || 0),
      hook: String(c.hook || '').slice(0, 60),
      caption: String(c.caption || '').slice(0, 120),
      why: String(c.why || '').slice(0, 160),
    });
  }
  clips.sort((a, b) => b.score - a.score);
  log.info('detect: moments ready', { count: clips.length });
  return clips.slice(0, top);
}
