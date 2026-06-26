// Server-rendered HTML views (template functions). No framework, no build step.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Number(n || 0).toLocaleString();
const money = (n) => '$' + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

const NAV = [
  { href: '/', label: 'Overview', icon: '◉', ready: true },
  { href: '/campaigns', label: 'Campaigns', icon: '◎', ready: true },
  { href: '/channels', label: 'Channels', icon: '⌗', ready: true },
  { href: '/studio', label: 'Studio', icon: '✂', ready: true },
  { href: '/analytics', label: 'Analytics', icon: '▤', ready: true },
  { href: '/accounts', label: 'Accounts', icon: '⚇', ready: true },
  { href: '/publish', label: 'Publish', icon: '➤', ready: true },
  { href: '/settings', label: 'Settings', icon: '⚙', ready: true },
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
<div class="sidebar-foot">localhost · D1–D5</div></aside>
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
  const statusOpts = (s) => ['candidate', 'approved', 'rejected']
    .map((o) => `<option value="${o}" ${(s || 'candidate') === o ? 'selected' : ''}>${o}</option>`).join('');
  const body = groups.length
    ? groups.map((g) => `<section class="card"><h2>Source <span class="muted">${esc(g.source.id)}</span></h2>
        <div class="clipgrid">${g.clips.map((c) => `
          <form class="clipcard" method="post" action="/studio/clip">
            <input type="hidden" name="id" value="${esc(c.id)}">
            <div class="clip-rank">#${c.rank} <span class="accent">${c.score}</span>
              <span class="status s-${esc(c.status || 'candidate')}">${esc(c.status || 'candidate')}</span></div>
            <input class="clip-edit" name="hook" value="${esc(c.hook || '')}" placeholder="hook">
            <textarea class="clip-edit" name="caption" rows="2" placeholder="caption">${esc(c.caption || '')}</textarea>
            <div class="clip-meta muted">${c.dur}s · ${c.file ? 'rendered' : 'meta-only'}</div>
            <div class="clip-actions"><select name="status">${statusOpts(c.status)}</select><button>Save</button></div>
          </form>`).join('')}</div></section>`).join('')
    : `<p class="empty">No clips yet. Run <code>node bin/clip.js &lt;source&gt;</code>.</p>`;
  return layout('/studio', 'Studio', body);
}

export function accountsPage(d) {
  const flag = d.vaultUnlocked
    ? '<span class="chip ok">🔒 vault unlocked</span>'
    : '<span class="chip warn">⚠ vault locked — set CLIPFARM_VAULT_KEY</span>';
  const appsList = d.apps.length
    ? d.apps.map((a) => `<tr><td>${esc(a.label)}</td><td class="muted">${esc(a.clientId)}</td><td><code>${esc(a.fingerprint)}</code></td>
        <td><span class="status s-posted">${esc(a.status)}</span></td>
        <td><a class="btn" href="/accounts/connect?appId=${esc(a.id)}">Connect channel →</a></td></tr>`).join('')
    : `<tr><td colspan="5" class="muted">No OAuth apps yet. Add one per channel below.</td></tr>`;
  const grid = d.accounts.length
    ? `<div class="acctgrid">${d.accounts.map((a) => `<div class="acctcard">
        <div class="acct-name">${esc(a.displayName || a.id)}</div>
        <div class="muted">${esc(a.platform)} · ${esc(a.handle || '')}</div>
        <div class="acct-row"><span class="status s-${a.connected ? 'posted' : 'needs-account'}">${a.connected ? 'connected' : a.status}</span>
        <span class="muted">cap ${a.dailyCap}/day</span></div>
        <form method="post" action="/accounts/live"><input type="hidden" name="id" value="${esc(a.id)}">
          <input type="hidden" name="on" value="${a.liveEnabled ? '0' : '1'}">
          <button class="btn ${a.liveEnabled ? 'live' : ''}">${a.liveEnabled ? '● LIVE enabled' : 'Enable live'}</button></form>
      </div>`).join('')}</div>`
    : `<p class="empty">No channels connected yet. Add an app and click "Connect channel".</p>`;
  return layout('/accounts', 'Accounts', `
    <section class="card"><div class="card-head"><h2>Connections</h2>${flag}</div>
      <p class="muted">Each channel uses its <b>own</b> Client ID/Secret (avoids YouTube quota limits). Set your Google OAuth app's redirect URI to:</p>
      <p><code>${esc(d.redirectUri)}</code></p>
      <table class="tbl"><thead><tr><th>App</th><th>Client ID</th><th>Fingerprint</th><th>Status</th><th></th></tr></thead><tbody>${appsList}</tbody></table>
    </section>
    <section class="card"><h2>Add a channel app</h2>
      <form method="post" action="/accounts/app" class="form">
        <label>Label <input name="label" placeholder="Channel A" required></label>
        <label>Client ID <input name="clientId" placeholder="…apps.googleusercontent.com" required></label>
        <label>Client Secret <input name="clientSecret" type="password" placeholder="GOCSPX-…" required></label>
        <input type="hidden" name="redirectUri" value="${esc(d.redirectUri)}">
        <button class="btn primary">Save app</button>
      </form>
      <p class="muted small">⚠ Set the OAuth consent screen to <b>Published</b> (Testing mode expires refresh tokens after 7 days).</p>
    </section>
    <section class="card"><h2>Channels (${d.accounts.length})</h2>${grid}</section>`);
}

export function publishPage(d) {
  const lanes = d.accounts.length
    ? `<div class="lanes">${d.accounts.map((a) => `<div class="lane"><div class="lane-head">${esc(a.displayName || a.id)}<span class="muted"> ${esc(a.platform)}</span></div>
        <div class="muted small">cap ${a.dailyCap}/day · ${a.liveEnabled ? 'live on' : 'dry-run'}</div></div>`).join('')}</div>`
    : '<p class="muted">No accounts — connect channels first.</p>';
  const sched = d.scheduled.length
    ? `<table class="tbl"><thead><tr><th>Clip</th><th>Platform</th><th>Status</th></tr></thead><tbody>
       ${d.scheduled.slice(0, 30).map((p) => `<tr><td>${esc(p.title || p.clipId)}</td><td>${esc(p.platform)}</td><td><span class="status s-${esc(p.status)}">${esc(p.status)}</span></td></tr>`).join('')}</tbody></table>`
    : '<p class="empty">Nothing scheduled. Approve clips in Studio, then plan a dry-run.</p>';
  return layout('/publish', 'Publish', `
    <div class="kpis"><div class="kpi accent"><div class="kpi-v">${d.approved.length}</div><div class="kpi-l">Approved clips</div></div>
      <div class="kpi"><div class="kpi-v">${d.accounts.length}</div><div class="kpi-l">Channels</div></div>
      <div class="kpi"><div class="kpi-v">${d.scheduled.length}</div><div class="kpi-l">Scheduled/dry-run</div></div></div>
    <section class="card"><h2>Account lanes</h2>${lanes}</section>
    <section class="card"><div class="card-head"><h2>Plan posts</h2>
      <form method="post" action="/publish/plan"><input type="hidden" name="platforms" value="youtube,tiktok,instagram">
        <button class="btn primary" ${d.approved.length ? '' : 'disabled'}>Plan dry-run for ${d.approved.length} approved</button></form></div>
      <p class="muted small">Dry-run is the default. Live upload also requires <code>CLIPFARM_PUBLISH_LIVE=1</code> + per-account live toggle.</p>
      ${sched}</section>`);
}

export function channelsPage(d) {
  const nicheOpts = (sel) => d.niches.map((n) => `<option value="${n}" ${n === sel ? 'selected' : ''}>${n}</option>`).join('');
  const acctOpts = (sel) => ['<option value="">— not linked —</option>']
    .concat(d.accounts.map((a) => `<option value="${esc(a.id)}" ${a.id === sel ? 'selected' : ''}>${esc(a.displayName || a.id)}</option>`)).join('');

  const cards = d.channels.length
    ? d.channels.map((ch) => `<section class="card chan">
        <div class="card-head"><h2>${esc(ch.name)} <span class="chip">${esc(ch.niche)}</span></h2>
          <span class="muted small">${ch.account ? '🔗 ' + esc(ch.account.displayName || ch.account.id) : 'not linked to a channel yet'}</span></div>
        <div class="grid-2">
          <div>
            <form method="post" action="/channels/profile" class="form">
              <input type="hidden" name="id" value="${esc(ch.id)}">
              <label>Name <input name="name" value="${esc(ch.name)}"></label>
              <label>Niche <select name="niche">${nicheOpts(ch.niche)}</select></label>
              <label>Topics (comma-separated) <input name="topics" value="${esc((ch.topics || []).join(', '))}" placeholder="e.g. valorant, clutch, ranked"></label>
              <label>Research notes <textarea name="notes" rows="2">${esc(ch.notes || '')}</textarea></label>
              <label>Link to connected channel <select name="accountId">${acctOpts(ch.accountId)}</select></label>
              <button class="btn primary">Save channel</button>
            </form>
            <p class="muted small">Posts ${ch.stats.posts} · Views ${num(ch.stats.views)}</p>
          </div>
          <div>
            <h3 class="sub">Research — campaigns that fit this niche</h3>
            ${ch.research.length
              ? `<table class="tbl"><thead><tr><th>Fit</th><th>CPM</th><th>Remaining</th><th>Campaign</th></tr></thead><tbody>
                 ${ch.research.map((c) => `<tr><td class="accent">${c.fit}</td><td>$${c.cpm}/1K</td><td>${money(c.remaining)}</td><td>${esc(c.title)}</td></tr>`).join('')}</tbody></table>`
              : '<p class="empty">No matching campaigns. Run <code>node bin/radar.js</code> or broaden topics.</p>'}
          </div>
        </div></section>`).join('')
    : `<p class="empty">No channels yet. Create one below — each page is its own topic/niche.</p>`;

  return layout('/channels', 'Channels', `
    <section class="card"><h2>New channel (topic / page)</h2>
      <form method="post" action="/channels/new" class="form">
        <label>Name <input name="name" placeholder="My Valorant Clips" required></label>
        <label>Niche <select name="niche">${nicheOpts('general')}</select></label>
        <label>Topics <input name="topics" placeholder="valorant, clutch, ranked"></label>
        <button class="btn primary">Create channel</button>
      </form>
      <p class="muted small">Plan all your pages' topics here — even before connecting them. Each gets its own research feed + clip routing.</p>
    </section>
    ${cards}`);
}

export function settingsPage(d) {
  return layout('/settings', 'Settings', `
    <section class="card"><h2>Status</h2>
      <div class="chips">
        <span class="chip ${d.vaultUnlocked ? 'ok' : 'warn'}">vault ${d.vaultUnlocked ? 'unlocked' : 'locked'}</span>
        <span class="chip ${d.llmConfigured ? 'ok' : 'warn'}">LLM ${d.llmConfigured ? 'configured' : 'missing'}</span>
        <span class="chip ${d.liveGate ? 'warn' : 'ok'}">live gate ${d.liveGate ? 'OPEN' : 'closed (safe)'}</span>
      </div></section>
    <section class="card"><h2>Safety cadence (defaults)</h2>
      <p class="muted">Per-account: max <b>${d.cadence.dailyCap}</b> posts/day, min <b>${d.cadence.minGapHours}h</b> gap, staggered, auto-pause on auth/rate-limit error. "Cadence-safe by local rules" — not a ban guarantee.</p></section>`);
}

export function analyticsPage(a) {
  const body = `${kpiCards({ earned: a.totals.earned, views: a.totals.views, posts: a.totals.posts, clips: '', campaigns: '', sources: '' })}
    <section class="card"><div class="card-head"><h2>Sync</h2>
      <form method="post" action="/metrics/sync"><button class="btn">⟳ Sync YouTube views</button></form></div>
      <p class="muted small">Pulls real view counts for posted YouTube clips (needs a connected channel). Manual entry also available per post.</p></section>
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
