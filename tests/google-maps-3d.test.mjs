import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleMaps3DLoader } from '../lib/google-maps-3d.ts';

function environment(importLibrary) {
  const timers = new Set();
  return { google: { maps: { importLibrary } }, document: { createElement() { return { remove() {} }; }, head: { append() {} }, querySelector() { return null; } }, setTimeout(callback) { timers.add(callback); return callback; }, clearTimeout(callback) { timers.delete(callback); } };
}
test('Google 3D loader supplies the marker library PinElement while reusing concurrent loads', async () => {
  const calls = [];
  const map = { Map3DElement: class {}, Marker3DInteractiveElement: class {} };
  const PinElement = class {};
  const host = environment(async library => { calls.push(library); return library === 'marker' ? { PinElement } : map; });
  const load = createGoogleMaps3DLoader(host);
  const [first, second] = await Promise.all([load('demo'), load('demo')]);
  assert.equal(first, second); assert.equal(first.PinElement, PinElement);
  assert.deepEqual(calls, ['maps3d', 'marker']);
});
test('optional marker-library failure does not leak provider errors or break a valid legacy map library', async () => {
  const map = { Map3DElement: class {}, Marker3DInteractiveElement: class {} };
  const host = environment(async library => { if (library === 'marker') throw Error('secret'); return map; });
  assert.equal(await createGoogleMaps3DLoader(host)('demo'), map);
});
