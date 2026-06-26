#!/usr/bin/env node
// Clip a single source into ranked vertical clips (no publishing).
// Usage: node bin/clip.js <url|file> [--top N] [--reframe fill|blur] [--campaign ID] [--no-captions] [--no-render]
import { processSource } from '../src/core/pipeline.js';
import { CFG } from '../src/core/config.js';
import { log } from '../src/core/log.js';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

async function main() {
  const src = process.argv[2];
  if (!src) { console.error('usage: clip <url|file> [--top N] [--reframe fill|blur] [--campaign ID] [--no-captions] [--no-render]'); process.exit(1); }
  const { clips, outDir } = await processSource(src, {
    campaignId: arg('campaign', null) || null,
    top: Number(arg('top', CFG.topMoments)),
    reframe: arg('reframe', 'smart'),
    captions: !arg('no-captions', false),
    render: !arg('no-render', false),
  });
  console.log(`\n✅ ${clips.filter((c) => c.file).length}/${clips.length} clips in ${outDir}`);
  for (const c of clips) console.log(`  #${c.rank} [${c.score}] ${c.dur}s  "${c.hook}"  → ${c.file ? 'rendered' : 'meta-only'}`);
}

main().catch((e) => { log.error('clip failed', { code: e.code, err: e.message }); process.exit(1); });
