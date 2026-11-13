import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import ts from 'typescript';

const path = new URL('../lib/properties/property-photo-policy.ts', import.meta.url);
const load = () => {
  assert.ok(existsSync(path), 'photo policy must exist');
  const exports = {};
  new Function('require', 'exports', ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(createRequire(import.meta.url), exports);
  return exports;
};
const pathname = 'agencies/agency-a/12345678-1234-4123-8123-123456789abc.jpg';
const url = `https://store.public.blob.vercel-storage.com/${pathname}`;

test('photo URLs are bounded and restricted to canonical tenant Blob paths', () => {
  const policy = load();
  assert.deepEqual(policy.parsePropertyPhotoUrls(JSON.stringify([url]), 'agency-a'), [url]);
  for (const urls of [[url.replace('agency-a', 'agency-b')], [url + '?secret=1'], [url + '#x'], [url.replace('https:', 'http:')], [url.replace('store.public', 'store.private')], [url.replace('store.public.blob.vercel-storage.com', 'evil.example')], [url.replace('.jpg', '.svg')], [url, url], Array(7).fill(url)]) {
    assert.throws(() => policy.parsePropertyPhotoUrls(JSON.stringify(urls), 'agency-a'));
  }
  assert.deepEqual(policy.parsePropertyPhotoUrls('', 'agency-a'), []);
  assert.throws(() => policy.parsePropertyPhotoUrls('{}', 'agency-a'));
});

test('photo metadata is checked against the owned store by pathname, not arbitrary URL', async () => {
  const policy = load();
  const calls = [];
  const lookup = async path => { calls.push(path); return { url, pathname, contentType: 'image/jpeg', size: 1024 }; };
  await policy.verifyPropertyPhotos([url], 'agency-a', lookup);
  assert.deepEqual(calls, [pathname]);
  for (const change of [{ url: url.replace('store.', 'other.') }, { pathname: pathname.replace('agency-a', 'agency-b') }, { contentType: 'image/svg+xml' }, { contentType: 'image/png' }, { size: 5 * 1024 * 1024 + 1 }, { size: 0 }]) {
    await assert.rejects(() => policy.verifyPropertyPhotos([url], 'agency-a', async () => ({ url, pathname, contentType: 'image/jpeg', size: 1024, ...change })));
  }
});
