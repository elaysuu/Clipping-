// Best-effort campaign-board refresh via headless Chrome. The boards are heavily
// JS-rendered; if the render yields campaign rows we refresh the snapshot, else we
// keep the existing one (honest no-op rather than wiping good data).
import fs from 'node:fs';
import { join } from 'node:path';
import { run } from '../core/exec.js';
import { parseBoard } from './radar.js';
import { PATHS } from '../core/config.js';
import { log } from '../core/log.js';

const CHROME = process.env.CHROME_BIN || 'google-chrome';
const BOARD_URL = process.env.BOARD_URL || 'https://contentrewards.com/discover';

export async function refreshBoard() {
  const out = join(PATHS.state, 'board-snapshot.md');
  let html = '';
  try {
    const { out: dump } = await run(CHROME, [
      '--headless=new', '--disable-gpu', '--no-sandbox',
      '--virtual-time-budget=15000', '--dump-dom', BOARD_URL,
    ], { timeoutMs: 60000 });
    html = dump;
  } catch (e) { log.warn('fetch: headless board render failed', { err: e.message }); return { refreshed: false, reason: 'render-failed' }; }

  // strip tags to text so the radar's "$paid/$total … $cpm/1K" parser can run
  const text = html.replace(/<[^>]+>/g, '\n').replace(/&amp;/g, '&');
  const found = parseBoard(text);
  if (found.length >= 10) {
    fs.writeFileSync(out, text);
    log.info('fetch: board snapshot refreshed', { campaigns: found.length });
    return { refreshed: true, campaigns: found.length };
  }
  log.warn('fetch: render yielded too few campaigns, keeping snapshot', { found: found.length });
  return { refreshed: false, reason: 'sparse-render', found: found.length };
}
