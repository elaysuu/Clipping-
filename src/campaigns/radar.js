// Campaign Radar: parse a clipping-board snapshot into ranked campaigns.
// Boards (Content Rewards / Whop) are JS-rendered, so a snapshot is captured
// out-of-band (firecrawl / headless Chrome) and saved as markdown; this module
// turns that into structured, ROI-ranked targets the operator/engine acts on.
import fs from 'node:fs';

const money = (s) => Number(String(s).replace(/[$,]/g, '')) || 0;

// Detect platform + genre hints from free text (helps targeting + safety).
function tag(text) {
  const t = text.toLowerCase();
  const platforms = ['tiktok', 'youtube', 'shorts', 'reels', 'instagram', 'twitch', 'kick', 'x ', 'twitter']
    .filter((p) => t.includes(p.trim()));
  const genre =
    /clip|stream|podcast|interview/.test(t) ? (/(podcast|interview)/.test(t) ? 'podcast' :
      /(stream|twitch|kick)/.test(t) ? 'streamer' : 'clip') :
    /logo|brand|product/.test(t) ? 'brand' : 'other';
  return { platforms, genre };
}

// Parse the board markdown into campaign records.
export function parseBoard(md) {
  // Normalize escaped newlines from JSON-ish dumps.
  const text = md.replace(/\\n/g, '\n');
  const campaigns = [];
  // Anchor on the "$paid/$total ... $rate/1K" trio that ends each card.
  const re = /\$([\d.,]+)\/\$([\d.,]+)\s*\n+\s*([\d.,]+[KM]?)\s*\n+\s*\$([\d.,]+)\s*\/\s*1K/gi;
  let m;
  while ((m = re.exec(text))) {
    const paid = money(m[1]);
    const total = money(m[2]);
    const cpm = money(m[4]);
    // Walk back ~600 chars for the nearest "### title" + description.
    const ctx = text.slice(Math.max(0, m.index - 800), m.index);
    const titleMatch = [...ctx.matchAll(/^###\s+(.+)$/gm)].pop();
    const title = titleMatch ? titleMatch[1].replace(/\\/g, '').trim() : '(untitled)';
    const remaining = Math.max(0, total - paid);
    campaigns.push({ title, cpm, paid, total, remaining, ...tag(title + ' ' + ctx) });
  }
  return campaigns;
}

// Rank by opportunity: high CPM AND meaningful budget left to actually capture.
// score = cpm * log10(remaining+10)  (CPM drives $/view; remaining caps headroom)
export function rankCampaigns(campaigns, { minRemaining = 200 } = {}) {
  return campaigns
    .filter((c) => c.cpm > 0 && c.remaining >= minRemaining)
    .map((c) => ({ ...c, score: +(c.cpm * Math.log10(c.remaining + 10)).toFixed(2) }))
    .sort((a, b) => b.score - a.score);
}

export function loadAndRank(snapshotPath, opts) {
  const md = fs.readFileSync(snapshotPath, 'utf8');
  const all = parseBoard(md);
  return { total: all.length, ranked: rankCampaigns(all, opts) };
}
