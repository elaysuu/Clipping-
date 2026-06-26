// Server-rendered HTML views (template functions). No framework, no build step.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Number(n || 0).toLocaleString();
const money = (n) => '$' + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

const NAV = [
  { href: '/', label: 'Overview', icon: '◉', ready: true },
  { href: '/campaigns', label: 'Campaigns', icon: '◎', ready: true },
  { href: '/studio', label: 'Studio', icon: '✂', ready: true },
  { href: '/analytics', label: 'Analytics', icon: '▤', ready: true },
  { href: '/accounts', label: 'Accounts', icon: '⚇', ready: false },
  { href: '/publish', label: 'Publish', icon: '➤', ready: false },
  { href: '/settings', label: 'Settings', icon: '⚙', ready: false },
];

export function layout(active, title, body) {
  const nav = NAV.map((n) => `
    <a class="nav-item ${n.href === active ? 'active' : ''} ${n.ready ? '' : 'soon'}" href="${n.ready ? n.href : '#'}">
      <span class="ic">${n.icon}</span><span>${n.label}</span>${n.ready ? '' : '<span class="badge">soon</span>'}
    </a>`).join('');
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ClipFarm</title><link rel="stylesheet" href="/public/app.css"></head>
<body><aside class="sidebar"><div class="brand">🎬 ClipFarm</div><nav>${nav}</nav>
<div class="sidebar-foot">read-only · D1</div></aside>
<main class="content"><header class="topbar"><h1>${esc(title)}</h1>
<button id="refresh" title="Refresh">⟳</button></header>${body}</main>
<script src="/public/app.js"></script></body></html>`;
}

function kpiCards(k) {
  const cards = [
    ['Est. earned', money(k.earned), 'accent'],
    ['Total views', num(k.views), ''],
    ['Clips forged', num(k.clips), ''],
    ['Posts', num(k.posts), ''],
    ['Campaigns', num(k.campaigns), ''],
    ['Sources', num(k.sources), ''],
  ];
  return `<div class="kpis">${cards.map(([l, v, c]) => `<div class="kpi ${c}"><div class="kpi-v">${v}</div><div class="kpi-l">${l}</div></div>`).join('')}</div>`;
}

export function overviewPage(d) {
  const byCampaign = d.byCampaign.length
    ? `<table class="tbl"><thead><tr><th>Campaign</th><th>CPM</th><th>Views</th><th>Earned</th></tr></thead><tbody>
       ${d.byCampaign.map((c) => `<tr><td>${esc(c.campaign)}</td><td>$${c.cpm}/1K</td><td>${num(c.views)}</td><td class="accent">${money(c.earned)}</td></tr>`).join('')}</tbody></table>`
    : `<p class="empty">No attributed earnings yet — run clips under a campaign and add view metrics.</p>`;
  const byPlatform = d.byPlatform.length
    ? d.byPlatform.map((p) => `<span class="chip">${esc(p.platform)} · ${num(p.posts)} posts · ${num(p.views)} views</span>`).join(' ')
    : '<span class="muted">no posts yet</span>';
  const recent = d.recent.length
    ? `<table class="tbl"><thead><tr><th>Clip</th><th>Platform</th><th>Status</th><th>Views</th><th>When</th></tr></thead><tbody>
       ${d.recent.map((p) => `<tr><td>${esc(p.title || p.clipId)}</td><td>${esc(p.platform)}</td><td><span class="status s-${esc(p.status)}">${esc(p.status)}</span></td><td>${num(p.views)}</td><td class="muted">${esc((p.postedAt || '').slice(0, 16).replace('T', ' '))}</td></tr>`).join('')}</tbody></table>`
    : `<p class="empty">No posts yet.</p>`;
  return layout('/', 'Overview', `
    ${kpiCards(d.kpis)}
    <section class="card"><h2>Platforms</h2><div class="chips">${byPlatform}</div></section>
    <div class="grid-2">
      <section class="card"><h2>Earnings by campaign</h2>${byCampaign}</section>
      <section class="card"><h2>Recent posts</h2>${recent}</section>
    </div>`);
}

export function campaignsPage(rows) {
  const body = rows.length
    ? `<section class="card"><div class="card-head"><h2>Ranked campaigns</h2>
        <input class="filter" data-target="camp-tbl" placeholder="filter…"></div>
        <table class="tbl sortable" id="camp-tbl"><thead><tr><th data-k>Score</th><th data-k>CPM</th><th data-k>Remaining</th><th data-k>Genre</th><th data-k>Title</th></tr></thead><tbody>
        ${rows.map((c) => `<tr><td class="accent">${c.score ?? ''}</td><td>$${c.cpm}/1K</td><td>${money(c.remaining)}</td><td>${esc(c.genre || '')}</td><td>${esc(c.title)}</td></tr>`).join('')}
        </tbody></table></section>`
    : `<p class="empty">No campaigns. Run <code>node bin/radar.js</code> to populate.</p>`;
  return layout('/campaigns', 'Campaigns', body);
}

export function studioPage(groups) {
  const body = groups.length
    ? groups.map((g) => `<section class="card"><h2>Source <span class="muted">${esc(g.source.id)}</span></h2>
        <div class="clipgrid">${g.clips.map((c) => `
          <div class="clipcard">
            <div class="clip-rank">#${c.rank} <span class="accent">${c.score}</span></div>
            <div class="clip-hook">${esc(c.hook || '')}</div>
            <div class="clip-cap">${esc(c.caption || '')}</div>
            <div class="clip-meta muted">${c.dur}s · ${c.file ? 'rendered' : 'meta-only'}</div>
          </div>`).join('')}</div></section>`).join('')
    : `<p class="empty">No clips yet. Run <code>node bin/clip.js &lt;source&gt;</code>.</p>`;
  return layout('/studio', 'Studio', body);
}

export function analyticsPage(a) {
  const body = `${kpiCards({ earned: a.totals.earned, views: a.totals.views, posts: a.totals.posts, clips: '', campaigns: '', sources: '' })}
    <section class="card"><h2>By campaign</h2>
    ${a.byCampaign.length ? `<table class="tbl"><thead><tr><th>Campaign</th><th>Posts</th><th>Views</th><th>CPM</th><th>Earned</th></tr></thead><tbody>
      ${a.byCampaign.map((c) => `<tr><td>${esc(c.campaign)}</td><td>${num(c.posts)}</td><td>${num(c.views)}</td><td>$${c.cpm}/1K</td><td class="accent">${money(c.earned)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="empty">No data yet.</p>'}</section>`;
  return layout('/analytics', 'Analytics', body);
}

export function soonPage(active, title) {
  return layout(active, title, `<section class="card soon-card"><h2>${esc(title)} — coming in a later phase</h2>
    <p class="muted">This screen is part of the planned build (see <code>docs/dashboard-design-FINAL.md</code>). D1 ships read-only Overview, Campaigns, Studio, and Analytics first.</p></section>`);
}
