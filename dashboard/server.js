// ClipFarm dashboard server — zero-dep Node http. Server-rendered HTML + JSON API
// + static assets. Binds localhost by default (security: holds no secrets in D1,
// but the same server will gate the vault later). No external dependencies.
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import * as data from './data.js';
import * as views from './views.js';
import { log } from '../src/core/log.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, 'public');
const MIME = { '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };

function send(res, code, body, type = 'text/html; charset=utf-8') {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}

function serveStatic(res, urlPath) {
  const rel = normalize(urlPath.replace(/^\/public\//, '')).replace(/^(\.\.[/\\])+/, '');
  const file = join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) return send(res, 404, 'not found', 'text/plain');
  const ext = file.slice(file.lastIndexOf('.'));
  send(res, 200, fs.readFileSync(file), MIME[ext] || 'application/octet-stream');
}

const ROUTES = {
  '/': () => views.overviewPage(data.overview()),
  '/campaigns': () => views.campaignsPage(data.campaigns()),
  '/studio': () => views.studioPage(data.clipsBySource()),
  '/analytics': () => views.analyticsPage(data.analytics()),
  '/accounts': () => views.soonPage('/accounts', 'Accounts'),
  '/publish': () => views.soonPage('/publish', 'Publish'),
  '/settings': () => views.soonPage('/settings', 'Settings'),
};

const API = {
  '/api/overview': () => data.overview(),
  '/api/campaigns': () => data.campaigns(),
  '/api/clips': () => data.clipsBySource(),
  '/api/analytics': () => data.analytics(),
};

export function createServer() {
  return http.createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      if (path.startsWith('/public/')) return serveStatic(res, path);
      if (API[path]) return send(res, 200, JSON.stringify(API[path](), null, 2), 'application/json');
      if (ROUTES[path]) return send(res, 200, ROUTES[path]());
      send(res, 404, views.layout(path, 'Not found', '<section class="card"><h2>404</h2></section>'));
    } catch (e) {
      log.error('dashboard: request error', { url: req.url, err: e.message });
      send(res, 500, 'internal error', 'text/plain');
    }
  });
}

export function start({ port = Number(process.env.DASH_PORT || 4317), host = process.env.DASH_HOST || '127.0.0.1' } = {}) {
  const server = createServer();
  server.listen(port, host, () => log.info('dashboard: listening', { url: `http://${host}:${port}` }));
  return server;
}
