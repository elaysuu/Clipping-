#!/usr/bin/env node
// Full backend run: source -> clips -> (dry-run) publish across platforms.
// Usage: node bin/run.js <url|file> [--campaign ID] [--top N] [--platforms a,b]
//        [--mode dry-run|live]   (live is additionally gated by CLIPFARM_PUBLISH_LIVE=1)
import { processSource } from '../src/core/pipeline.js';
import { publishClipMulti } from '../src/publish/index.js';
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
  if (!src) { console.error('usage: run <url|file> [--campaign ID] [--top N] [--platforms a,b] [--mode dry-run|live]'); process.exit(1); }
  const campaignId = arg('campaign', null) || null;
  const platforms = String(arg('platforms', 'youtube,tiktok,instagram')).split(',');
  const mode = arg('mode', 'dry-run');

  const { clips } = await processSource(src, { campaignId, top: Number(arg('top', CFG.topMoments)) });
  const rendered = clips.filter((c) => c.file);
  log.info('run: publishing clips', { rendered: rendered.length, platforms, mode });

  for (const clip of rendered) {
    const results = await publishClipMulti(clip.id, { platforms, mode });
    const summary = results.map((r) => `${r.platform}:${r.status}`).join(' ');
    console.log(`  #${clip.rank} "${clip.hook}"  → ${summary}`);
  }
  console.log(`\n✅ processed ${rendered.length} clips → ${platforms.length} platforms (${mode}). See \`node bin/report.js\`.`);
}

main().catch((e) => { log.error('run failed', { code: e.code, err: e.message }); process.exit(1); });
