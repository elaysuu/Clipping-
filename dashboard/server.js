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
import * as auth from './auth.js';
import { log } from '../src/core/log.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, 'public');
const MIME = { '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-store',
};
function send(res, code, body, type = 'text/html; charset=utf-8') {
  res.writeHead(code, { 'content-type': type, ...SECURITY_HEADERS });
  res.end(body);
}
function redirect(res, to) { res.writeHead(302, { location: to, ...SECURITY_HEADERS }); res.end(); }

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

      // --- auth gate (when CLIPFARM_PIN is set) ---
      if (path === '/login') {
        if (req.method === 'POST') {
          const body = await parseBody(req);
          if (auth.checkPin(body.pin)) { auth.newSession(res); return redirect(res, '/'); }
          return send(res, 401, auth.loginPage('err'));
        }
        return send(res, 200, auth.loginPage());
      }
      if (path === '/logout') { auth.destroySession(req, res); return redirect(res, '/login'); }
      if (!path.startsWith('/public/') && !auth.isAuthed(req)) {
        return req.method === 'GET' ? redirect(res, '/login') : send(res, 401, 'auth required', 'text/plain');
      }

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
  server.listen(port, host, () => {
    log.info('dashboard: listening', { url: `http://${host}:${port}`, auth: auth.authRequired() ? 'PIN' : 'OPEN' });
    if (!auth.authRequired() && host !== '127.0.0.1' && host !== 'localhost') {
      log.warn('dashboard: NO CLIPFARM_PIN set and bound to a non-localhost host — anyone reachable can access. Set CLIPFARM_PIN.');
    }
  });
  return server;
}
