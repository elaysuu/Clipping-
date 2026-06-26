// Optional PIN gate for the dashboard. The dashboard holds OAuth credentials
// (after connect), so on any non-localhost exposure a PIN is strongly advised.
// Set CLIPFARM_PIN to enable. Sessions are random in-memory tokens (cleared on
// restart) delivered as an HttpOnly cookie. No secret is ever sent to the client.
import crypto from 'node:crypto';

const PIN = process.env.CLIPFARM_PIN || '';
const sessions = new Set();
const COOKIE = 'cf_session';

export const authRequired = () => PIN.length > 0;

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((c) => c.trim().split('=').map(decodeURIComponent)).filter((kv) => kv[0]));
}

export function isAuthed(req) {
  if (!authRequired()) return true;
  const tok = parseCookies(req.headers.cookie || '')[COOKIE];
  return !!tok && sessions.has(tok);
}

// constant-time PIN compare
export function checkPin(input) {
  if (!PIN) return false;
  const a = Buffer.from(String(input || ''));
  const b = Buffer.from(PIN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function newSession(res) {
  const tok = crypto.randomBytes(24).toString('hex');
  sessions.add(tok);
  res.setHeader('set-cookie', `${COOKIE}=${tok}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`);
}

export function destroySession(req, res) {
  const tok = parseCookies(req.headers.cookie || '')[COOKIE];
  if (tok) sessions.delete(tok);
  res.setHeader('set-cookie', `${COOKIE}=; HttpOnly; Path=/; Max-Age=0`);
}

export function loginPage(error = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><title>ClipFarm · Login</title>
<style>body{background:#0b0e14;color:#e6ebf5;font:15px system-ui;display:grid;place-items:center;height:100vh;margin:0}
form{background:#141925;border:1px solid #263149;border-radius:14px;padding:28px;width:300px;text-align:center}
h1{font-size:20px;margin:0 0 18px}input{width:100%;background:#0b0e14;border:1px solid #263149;color:#e6ebf5;border-radius:8px;padding:11px;font-size:16px;text-align:center;letter-spacing:4px}
button{margin-top:14px;width:100%;background:#5cf2b6;color:#06281c;border:none;border-radius:8px;padding:11px;font-weight:700;font-size:15px;cursor:pointer}
.err{color:#ff8f8f;font-size:13px;margin-top:10px;min-height:16px}</style></head>
<body><form method="post" action="/login"><h1>🎬 ClipFarm</h1>
<input name="pin" type="password" inputmode="numeric" placeholder="PIN" autofocus autocomplete="off">
<button>Unlock</button><div class="err">${error ? 'Wrong PIN' : ''}</div></form></body></html>`;
}
