// src/submit/analytics.js
// Universal analytics-screenshot/demographics capture. Per-platform adapters point
// at the posted video's analytics; we parse Tier-1 audience % from the rendered text.
import { renderDom } from './browser.js';

const COUNTRY = {
  'united states': 'US', 'us': 'US', 'united kingdom': 'UK', 'uk': 'UK',
  'canada': 'CA', 'ca': 'CA', 'australia': 'AU', 'au': 'AU',
};

export const ANALYTICS_URL = {
  youtube: (u) => `https://studio.youtube.com/video/${ytId(u)}/analytics/tab-build_your_audience`,
  tiktok: (u) => u,        // TikTok analytics are in-app; adapter refined later
  instagram: (u) => u,     // IG insights are in-app; adapter refined later
};

function ytId(u) {
  const m = String(u).match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{6,})/);
  return m ? m[1] : '';
}

export function parseTier1(text, tier1 = ['US', 'UK', 'CA', 'AU']) {
  const rows = [...String(text).matchAll(/([A-Za-z][A-Za-z .]+?)\s+(\d{1,3})%/g)];
  if (!rows.length) return null;
  let sum = 0; let matched = false;
  for (const [, name, pct] of rows) {
    const code = COUNTRY[name.trim().toLowerCase()];
    if (code && tier1.includes(code)) { sum += Number(pct); matched = true; }
  }
  return matched ? sum : 0;
}

export function analyticsReady(text) {
  return /([A-Za-z][A-Za-z .]+?)\s+\d{1,3}%/.test(String(text));
}

export async function captureAnalytics({ platform, postUrl, profileDir, tier1, render = renderDom }) {
  const urlFor = ANALYTICS_URL[platform] || ((u) => u);
  const text = await render(urlFor(postUrl), { profileDir });
  return { ready: analyticsReady(text), tier1Pct: parseTier1(text, tier1), text };
}
