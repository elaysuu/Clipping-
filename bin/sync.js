#!/usr/bin/env node
// Pull real YouTube view counts for posted clips into the store, then the
// reconciler turns them into earnings. Needs a connected channel.
import { syncYouTubeMetrics } from '../src/reconcile/sync.js';
const r = await syncYouTubeMetrics();
console.log(`synced ${r.synced} post metric(s). See \`node bin/report.js\`.`);
