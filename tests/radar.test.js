import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBoard, rankCampaigns } from '../src/campaigns/radar.js';

const FIXTURE = `
### Coinbase Clipping
Post crypto clips and get paid.
Join Campaign
$1,853/$10,000
1K
$6/1K

### Coinbase Clipping
Post crypto clips and get paid.
Join Campaign
$1,853/$10,000
1K
$6/1K

### Tiny Budget Stream
A streamer campaign.
Join Campaign
$900/$1,000
1K
$2/1K
`;

test('parseBoard extracts + dedupes campaigns', () => {
  const c = parseBoard(FIXTURE);
  assert.equal(c.length, 2, 'duplicate Coinbase card collapses to one');
  const coin = c.find((x) => /coinbase/i.test(x.title));
  assert.equal(coin.cpm, 6);
  assert.equal(coin.total, 10000);
  assert.equal(coin.remaining, 8147);
});

test('rankCampaigns filters tiny budgets + scores by cpm*headroom', () => {
  const ranked = rankCampaigns(parseBoard(FIXTURE), { minRemaining: 1000 });
  assert.equal(ranked.length, 1, 'the $100-left campaign is filtered out');
  assert.equal(ranked[0].title, 'Coinbase Clipping');
  assert.ok(ranked[0].score > 0);
});
