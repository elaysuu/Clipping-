// Tiny JSON store — the spine every component reads/writes (no DB, zero deps).
// One file per collection under data/state/. Atomic writes. This is the schema
// the Reconciler computes over and the Dashboard renders.
//
// Collections:
//   campaigns  {id,title,cpm,total,paid,remaining,score,genre,platforms,source}
//   sources    {id,url,kind,videoPath,ingestedAt}
//   clips      {id,sourceId,campaignId,rank,score,hook,caption,start,end,dur,file,createdAt}
//   posts      {id,clipId,platform,account,status,url,postedAt}         status: planned|dry-run|posted|failed
//   metrics    {id,postId,views,likes,comments,at}                      view samples over time
//   payouts    {id,campaignId,postId,views,cpm,amount,at}               computed $ earned
import fs from 'node:fs';
import { join } from 'node:path';
import { PATHS } from './config.js';

const DIR = PATHS.state;
const file = (name) => join(DIR, `${name}.json`);

export function read(name) {
  try { return JSON.parse(fs.readFileSync(file(name), 'utf8')); }
  catch { return []; }
}

export function write(name, rows) {
  const tmp = file(name) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2));
  fs.renameSync(tmp, file(name));
  return rows;
}

// Upsert by id (generates one from a prefix + counter if absent).
export function upsert(name, row, key = 'id') {
  const rows = read(name);
  if (!row[key]) row[key] = `${name.slice(0, 3)}_${Date.now().toString(36)}_${rows.length}`;
  const i = rows.findIndex((r) => r[key] === row[key]);
  if (i === -1) rows.push(row); else rows[i] = { ...rows[i], ...row };
  write(name, rows);
  return row;
}

export function upsertMany(name, newRows, key = 'id') {
  for (const r of newRows) upsert(name, r, key);
  return read(name);
}

export const COLLECTIONS = ['campaigns', 'sources', 'clips', 'posts', 'metrics', 'payouts'];
