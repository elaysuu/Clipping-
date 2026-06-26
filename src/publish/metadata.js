// Build platform-ready post metadata from a clip + (optional) campaign.
// Pure function, no I/O — easy to unit-test.
const STOP = new Set(['the','a','an','to','for','of','in','on','at','and','or','is','it','this','that','i','you','your']);

function hashtagsFrom(text, extra = []) {
  const words = String(text).toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w));
  const uniq = [...new Set([...extra, ...words])].slice(0, 6);
  return uniq.map((w) => '#' + w.replace(/[^a-z0-9]/g, ''));
}

// platform-specific caps
const LIMITS = {
  youtube: { title: 100, desc: 4900 },
  tiktok: { title: 150, desc: 2100 },
  instagram: { title: 125, desc: 2100 },
};

export function buildMetadata(clip, { platform = 'youtube', campaign = null } = {}) {
  const lim = LIMITS[platform] || LIMITS.youtube;
  const base = (clip.caption || clip.hook || 'Clip').trim();
  const baseTags = campaign?.genre && campaign.genre !== 'other' ? [campaign.genre] : [];
  const tags = hashtagsFrom(base, baseTags);
  // Shorts/Reels/TikTok reward a punchy title + #shorts-style discovery tags.
  const discovery = platform === 'youtube' ? ['#shorts'] : ['#fyp', '#viral'];
  const title = (base.length > lim.title - 10 ? base.slice(0, lim.title - 12) + '…' : base);
  const description = [base, '', [...new Set([...discovery, ...tags])].join(' ')]
    .join('\n').slice(0, lim.desc);
  return { title, description, tags: tags.map((t) => t.slice(1)), platform };
}
