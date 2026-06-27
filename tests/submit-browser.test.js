import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.CLIPFARM_VAULT_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

const { chromeArgs, resolveProxy } = await import('../src/submit/browser.js');

test('chromeArgs includes proxy flag only when proxy given', () => {
  const withP = chromeArgs({ url: 'https://x', profileDir: '/p', proxy: 'http://1.2.3.4:8080' });
  assert.ok(withP.includes('--proxy-server=http://1.2.3.4:8080'));
  assert.ok(withP.includes('--user-data-dir=/p'));
  assert.ok(withP.some((a) => a === 'https://x'));
  const noP = chromeArgs({ url: 'https://x', profileDir: '/p', proxy: null });
  assert.ok(!noP.some((a) => a.startsWith('--proxy-server')));
});

test('resolveProxy reads env and returns null when unset', () => {
  assert.equal(resolveProxy({ CLIPFARM_PROXY: 'http://p' }), 'http://p');
  assert.equal(resolveProxy({}), null);
});
