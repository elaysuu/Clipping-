import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.CLIPFARM_VAULT_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

const { saveSession, loadSession, listSessions } = await import('../src/submit/session.js');

test('saveSession round-trips cookies and never stores plaintext', () => {
  const cookies = [{ name: 'sid', value: 'FAKE_TEST_SECRET_not_real' }];
  const safe = saveSession('whop', cookies);
  assert.equal(safe.id, 'whop');
  assert.ok(safe.fingerprint.length === 8);
  assert.ok(!JSON.stringify(safe).includes('FAKE_TEST_SECRET_not_real'));
  assert.deepEqual(loadSession('whop'), cookies);
});

test('loadSession returns null for unknown identity', () => {
  assert.equal(loadSession('nope'), null);
});

test('listSessions exposes only id+fingerprint+savedAt', () => {
  saveSession('yt:channelA', [{ name: 'x', value: 'FAKE_TEST_SECRET_not_real' }]);
  const row = listSessions().find((s) => s.id === 'yt:channelA');
  assert.ok(row && row.fingerprint && row.savedAt);
  assert.ok(!('enc' in row));
});
