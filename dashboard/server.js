// ClipFarm dashboard server — zero-dep Node http. Server-rendered HTML + JSON API
// + static assets + POST form handling + the OAuth callback. Binds localhost by
// default. Secrets only ever pass through to the vault server-side; never rendered.
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import * as data from './data.js';
import * as views from './views.js';
import * as actions from './actions.js';
import { log } from '../src/core/log.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, 'public');
const MIME = { '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };

function send(res, code, body, type = 'text/html; charset=utf-8') {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}
function redirect(res, to) { res.writeHead(302, { location: to }); res.end(); }

function serveStatic(res, urlPath) {
  const rel = normalize(urlPath.replace(/^\/public\//, '')).replace(/^(\.\.[/\\])+/, '');
  const file = join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) return send(res, 404, 'not found', 'text/plain');
  const ext = file.slice(file.lastIndexOf('.'));
  send(res, 200, fs.readFileSync(file), MIME[ext] || 'application/octet-stream');
}

function parseBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(Object.fromEntries(new URLSearchParams(raw))));
  });
}

const GET = {
  '/': () => views.overviewPage(data.overview()),
  '/campaigns': () => views.campaignsPage(data.campaigns()),
  '/channels': () => views.channelsPage(data.channelsView()),
  '/studio': () => views.studioPage(data.clipsBySource()),
  '/analytics': () => views.analyticsPage(data.analytics()),
  '/accounts': () => views.accountsPage(data.accountsView()),
  '/publish': () => views.publishPage(data.publishView()),
  '/settings': () => views.settingsPage(data.settingsView()),
};
const API = {
  '/api/overview': () => data.overview(),
  '/api/campaigns': () => data.campaigns(),
  '/api/clips': () => data.clipsBySource(),
  '/api/analytics': () => data.analytics(),
  '/api/accounts': () => data.accountsView(),
};

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;

      if (req.method === 'GET') {
        if (path.startsWith('/public/')) return serveStatic(res, path);
        if (API[path]) return send(res, 200, JSON.stringify(API[path](), null, 2), 'application/json');
        if (path === '/accounts/connect') return actions.connect(url, redirect, res);
        if (path === '/oauth/callback') return await actions.oauthCallback(url, redirect, res);
        if (GET[path]) return send(res, 200, GET[path]());
        return send(res, 404, views.layout(path, 'Not found', '<section class="card"><h2>404</h2></section>'));
      }

      if (req.method === 'POST') {
        const body = await parseBody(req);
        const handler = actions.POST[path];
        if (handler) { const to = await handler(body, url); return redirect(res, to || path.replace(/\/[^/]+$/, '') || '/'); }
        return send(res, 404, 'no such action', 'text/plain');
      }

      send(res, 405, 'method not allowed', 'text/plain');
    } catch (e) {
      log.error('dashboard: request error', { url: req.url, err: e.message });
      send(res, 500, views.layout('/', 'Error', `<section class="card"><h2>Error</h2><p class="muted">${String(e.message).replace(/[<>]/g, '')}</p></section>`));
    }
  });
}

export function start({ port = Number(process.env.DASH_PORT || 4317), host = process.env.DASH_HOST || '127.0.0.1' } = {}) {
  const server = createServer();
  server.listen(port, host, () => log.info('dashboard: listening', { url: `http://${host}:${port}` }));
  return server;
}
