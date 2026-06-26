// Central config + paths. Zero hard-coded secrets; LLM key read from env.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import fs from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '../..');

export const PATHS = {
  root: ROOT,
  sources: resolve(ROOT, 'data/sources'),
  clips: resolve(ROOT, 'data/clips'),
  state: resolve(ROOT, 'data/state'),
  logs: resolve(ROOT, 'logs'),
};

for (const p of Object.values(PATHS)) fs.mkdirSync(p, { recursive: true });

// Reuse Elay's existing Chutes/LLM env if present (loaded lazily by caller).
export const CFG = {
  // Clip length window (seconds) for short-form.
  clipMin: Number(process.env.CLIP_MIN ?? 15),
  clipMax: Number(process.env.CLIP_MAX ?? 60),
  // How many candidate moments to forge per source.
  topMoments: Number(process.env.TOP_MOMENTS ?? 8),
  // Vertical output.
  outW: 1080,
  outH: 1920,
};
