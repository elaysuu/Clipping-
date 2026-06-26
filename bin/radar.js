#!/usr/bin/env node
// Campaign Radar CLI: rank a board snapshot and record campaigns to the store.
// Usage: node bin/radar.js [snapshot.md] [--min-remaining N] [--top N]
import { join } from 'node:path';
import { loadAndRank } from '../src/campaigns/radar.js';
import { upsert } from '../src/core/store.js';
import { PATHS } from '../src/core/config.js';
import { log } from '../src/core/log.js';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? def : process.argv[i + 1];
}

const snapshot = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2]
  : join(PATHS.state, 'board-snapshot.md');
const minRemaining = Number(arg('min-remaining', 500));
const topN = Number(arg('top', 25));

const { total, ranked } = loadAndRank(snapshot, { minRemaining });
log.info('radar: parsed board', { total, ranked: ranked.length });

ranked.slice(0, topN).forEach((c, i) => {
  upsert('campaigns', {
    id: 'cmp_' + Buffer.from(c.title).toString('base64url').slice(0, 16),
    title: c.title, cpm: c.cpm, total: c.total, paid: c.paid, remaining: c.remaining,
    score: c.score, genre: c.genre, platforms: c.platforms,
    source: 'contentrewards', updatedAt: new Date().toISOString(),
  });
  console.log(`#${String(i + 1).padStart(2)} [${c.score}] $${c.cpm}/1K  rem $${c.remaining.toLocaleString()}  ${c.genre.padEnd(8)} ${c.title.slice(0, 50)}`);
});
console.log(`\nRecorded top ${Math.min(topN, ranked.length)} of ${ranked.length} ranked campaigns to store.`);
