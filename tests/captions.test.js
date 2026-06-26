import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { buildCaptions } from '../src/forge/captions.js';

const segs = [
  { start: 0, end: 4, text: 'this is the moment everything changed' },
  { start: 4, end: 8, text: 'and nobody saw it coming at all' },
  { start: 100, end: 104, text: 'this is outside the clip window' },
];

test('buildCaptions writes timed ASS dialogue only within the clip window', () => {
  const out = join(os.tmpdir(), `cf_cap_${process.pid}.ass`);
  const { count } = buildCaptions(segs, { start: 0, end: 8 }, out);
  const ass = fs.readFileSync(out, 'utf8');
  fs.unlinkSync(out);

  assert.ok(count > 0);
  assert.match(ass, /\[Script Info\]/);
  assert.match(ass, /Style: Pop/);
  assert.match(ass, /Dialogue:/);
  assert.match(ass, /EVERYTHING/); // uppercased chunk
  assert.ok(!/OUTSIDE/.test(ass), 'segment outside the window is excluded');
});
