import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPresentationSettings, parsePresentationSettings, savePresentationSettings, readPresentationSettings } from '../lib/agency-presentation.ts';
import { zonePinPosition } from '../lib/zone-map.ts';
import { buildPropertySearchResults } from '../lib/property-search.ts';

const bounds = { west: -65, east: -64, south: -34, north: -33 };
const map = () => ({ mode: 'geographic', imageUrl: 'https://example.com/map.webp', bounds, pins: [] });
test('geographic inner maps project GPS positions and omit properties outside their bounds', () => {
  const property = { source: 'real', propertyId: 'house', latitude: -33.25, longitude: -64.5 };
  assert.deepEqual(zonePinPosition(map(), property), { x: .5, y: .25 });
  assert.equal(zonePinPosition(map(), { ...property, longitude: -63 }), null);
  assert.equal(zonePinPosition(map(), { ...property, latitude: null }), null);
});
test('illustrated positions are independent from GPS and distinguish real and example properties', () => {
  const plan = { ...map(), mode: 'illustrated', pins: [{ source: 'real', propertyId: 'house', x: .2, y: .8 }] };
  const property = { source: 'real', propertyId: 'house', latitude: -33.25, longitude: -64.5 };
  const before = structuredClone(property);
  assert.deepEqual(zonePinPosition(plan, property), { x: .2, y: .8 });
  assert.equal(zonePinPosition(plan, { ...property, source: 'example' }), null);
  assert.deepEqual(property, before);
});
test('zone maps roundtrip separately by agency and zone while old settings remain identical', () => {
  assert.deepEqual(parsePresentationSettings(defaultPresentationSettings), defaultPresentationSettings);
  const storage = new Map();
  const adapter = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const settings = { ...structuredClone(defaultPresentationSettings), zoneMaps: { centro: map(), north: { ...map(), mode: 'illustrated', pins: [{ source: 'real', propertyId: 'house', x: 0, y: 1 }] } } };
  assert.equal(savePresentationSettings(adapter, 'a', settings).error, null);
  assert.deepEqual(readPresentationSettings(adapter, 'a').settings, settings);
  assert.deepEqual(readPresentationSettings(adapter, 'b').settings, defaultPresentationSettings);
  for (const bad of [
    { ...map(), imageUrl: 'javascript:alert(1)' }, { ...map(), mode: 'unknown' }, { ...map(), mode: ['geographic'] },
    { ...map(), bounds: { ...bounds, west: -63 } },
    { ...map(), pins: [{ source: 'real', propertyId: 'house', x: NaN, y: .5 }] },
    { ...map(), pins: [{ source: 'real', propertyId: '__proto__', x: .2, y: .5 }] },
    { ...map(), pins: Array(2).fill({ source: 'real', propertyId: 'house', x: .2, y: .5 }) },
  ]) {
    const before = JSON.stringify([...storage]);
    assert.equal(savePresentationSettings(adapter, 'a', { ...settings, zoneMaps: { centro: bad } }).settings, null);
    assert.equal(JSON.stringify([...storage]), before, 'rejected settings must not overwrite saved data');
  }
});
test('manual zone associations respect zone filters without fabricating catalogue GPS', () => {
  const record = { id: 'house', title: 'Casa', description: '', address: '', neighborhood: '', latitude: null, longitude: null, price: 100, currency: 'USD', type: 'HOUSE', area: 90, bedrooms: 2, bathrooms: 1, features: [], media: [] };
  const before = structuredClone(record);
  const settings = { ...structuredClone(defaultPresentationSettings), zoneMaps: { custom: { ...map(), mode: 'illustrated', pins: [{ source: 'real', propertyId: 'house', x: .2, y: .8 }] } } };
  const results = buildPropertySearchResults({ properties: [record], settings, zones: [{ id: 'custom', label: 'Custom', bounds }], filters: { zone: 'custom' } });
  assert.deepEqual(results.map(item => item.id), ['house']);
  assert.deepEqual(record, before);
});
