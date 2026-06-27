// src/submit/browser.js
// Proxy-aware headless Chrome wrapper. All Whop/social traffic routes through a
// residential proxy (env CLIPFARM_PROXY) to dodge datacenter-IP bot-checks;
// degrades to a direct connection (with a warning) when no proxy is set.
import { run } from '../core/exec.js';
import { log } from '../core/log.js';

const CHROME = process.env.CHROME_BIN || 'google-chrome';
let warnedNoProxy = false;

export function chromeArgs({ url, profileDir, proxy, dumpDom = true }) {
  const args = ['--headless=new', '--disable-gpu', '--no-sandbox',
    '--virtual-time-budget=15000', `--user-data-dir=${profileDir}`];
  if (proxy) args.push(`--proxy-server=${proxy}`);
  if (dumpDom) args.push('--dump-dom');
  args.push(url);
  return args;
}

export function resolveProxy(env = process.env) {
  const proxy = env.CLIPFARM_PROXY || null;
  if (!proxy && !warnedNoProxy) {
    warnedNoProxy = true;
    log.warn('browser: no CLIPFARM_PROXY set — using direct connection (datacenter-IP bot-check risk)');
  }
  return proxy;
}

export async function renderDom(url, { profileDir }) {
  const proxy = resolveProxy();
  const { out } = await run(CHROME, chromeArgs({ url, profileDir, proxy }), { timeoutMs: 60000 });
  return out;
}
