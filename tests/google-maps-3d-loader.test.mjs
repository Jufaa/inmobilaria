import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleMaps3DLoader } from '../lib/google-maps-3d.ts';
function environment() {
  const scripts = [];
  const timers = new Set();
  const host = { document: { createElement() { return { remove() { this.removed = true; } }; }, head: { append(script) { scripts.push(script); } }, querySelector() { return null; } },
    setTimeout(callback) { timers.add(callback); return callback; }, clearTimeout(callback) { timers.delete(callback); } };
  return { host, scripts, timers };
}
test('missing demo key makes no SDK requests; concurrent users share a single script and library load', async () => {
  const { host, scripts, timers } = environment();
  const load = createGoogleMaps3DLoader(host);
  await assert.rejects(load(''), /clave/i);
  assert.equal(scripts.length, 0);
  const first = load('demo-test-key');
  const second = load('demo-test-key');
  assert.equal(scripts.length, 1);
  const url = new URL(scripts[0].src);
  assert.equal(url.origin, 'https://maps.googleapis.com');
  assert.equal(url.searchParams.get('v'), 'weekly');
  let imports = 0;
  const library = { Map3DElement: class {}, Marker3DInteractiveElement: class {} };
  host.google = { maps: { importLibrary: async (name) => { assert.equal(name, 'maps3d'); imports++; return library; } } };
  host.__territorioGoogle3DReady();
  assert.equal(await first, library);
  assert.equal(await second, library);
  assert.equal(imports, 1);
  assert.equal(timers.size, 0);
});
test('failed or timed out loads discard pending state and can retry without exposing provider errors or credentials', async () => {
  const { host, scripts, timers } = environment();
  const load = createGoogleMaps3DLoader(host);
  const failed = load('demo-test-key');
  scripts[0].onerror(new Error('provider request contains demo-test-key'));
  await assert.rejects(failed, (error) => !error.message.includes('demo-test-key'));
  assert.equal(scripts[0].removed, true);
  const timed = load('demo-test-key');
  assert.equal(scripts.length, 2);
  [...timers][0]();
  await assert.rejects(timed, /Google/);
  assert.equal(scripts[1].removed, true);
  assert.equal(host.__territorioGoogle3DReady, undefined);
});
test('an already loaded SDK is reused and a rejected library import is sanitized', async () => {
  const { host, scripts } = environment();
  host.google = { maps: { importLibrary: async () => { throw new Error('secret-provider-details'); } } };
  await assert.rejects(createGoogleMaps3DLoader(host)('demo-key'), (error) => !error.message.includes('secret-provider-details'));
  assert.equal(scripts.length, 0);
});
