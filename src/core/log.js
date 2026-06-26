// Tiny structured logger — stdout + append to logs/clipfarm.log
import fs from 'node:fs';
import { PATHS } from './config.js';
import { join } from 'node:path';

const LOGFILE = join(PATHS.logs, 'clipfarm.log');

function ts() { return new Date().toISOString(); }

function write(level, msg, extra) {
  const line = `${ts()} [${level}] ${msg}${extra ? ' ' + JSON.stringify(extra) : ''}`;
  process.stdout.write(line + '\n');
  try { fs.appendFileSync(LOGFILE, line + '\n'); } catch {}
}

export const log = {
  info: (m, e) => write('INFO', m, e),
  warn: (m, e) => write('WARN', m, e),
  error: (m, e) => write('ERROR', m, e),
  step: (m, e) => write('STEP', m, e),
};
