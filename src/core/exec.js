// Promise wrapper around spawn with streamed output + hard timeout.
import { spawn } from 'node:child_process';

export function run(cmd, args, { timeoutMs = 0, cwd, onLine } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd });
    let out = '', err = '';
    let killed = false;
    const timer = timeoutMs
      ? setTimeout(() => { killed = true; child.kill('SIGKILL'); }, timeoutMs)
      : null;
    child.stdout.on('data', (d) => { out += d; if (onLine) String(d).split('\n').forEach((l) => l && onLine(l)); });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { if (timer) clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (killed) return reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
      if (code !== 0) return reject(new Error(`${cmd} exited ${code}: ${err.slice(-500)}`));
      resolve({ out, err });
    });
  });
}
