#!/usr/bin/env node
// One-glance backend report: pipeline output + earnings. Read-only.
import { read } from '../src/core/store.js';
import { reconcile } from '../src/reconcile/payouts.js';

const n = (name) => read(name).length;
const r = reconcile();

console.log('=== ClipFarm report ===');
console.log(`campaigns tracked : ${n('campaigns')}`);
console.log(`sources ingested  : ${n('sources')}`);
console.log(`clips forged      : ${n('clips')}`);
console.log(`posts recorded    : ${n('posts')}  (with metrics: ${r.withMetrics})`);
console.log(`total views       : ${r.totalViews.toLocaleString()}`);
console.log(`est. earned       : $${r.totalEarned.toLocaleString()}`);
if (r.byCampaign.length) {
  console.log('\n--- earnings by campaign ---');
  for (const c of r.byCampaign) {
    console.log(`  $${String(c.earned).padStart(8)}  ${c.views.toLocaleString().padStart(10)} views @ $${c.cpm}/1K  ${c.campaign.slice(0, 40)}`);
  }
}
