import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPresentationSettings, parsePresentationSettings, savePresentationSettings } from '../lib/agency-presentation.ts';
import { defaultExplorerSettings, matchesPresentationFilters, rectangleFromPoints, presentationZones } from '../lib/presentation-explorer.ts';
import { visiblePresentationArea } from '../lib/presentation-listings.ts';
import { defaultDemoConfig } from '../lib/property-tour-config.ts';

test('customization round trips while legacy settings remain unchanged', () => {
  assert.deepEqual(parsePresentationSettings(defaultPresentationSettings), defaultPresentationSettings);
  const value = structuredClone(defaultPresentationSettings);
  value.explorer = structuredClone(defaultExplorerSettings);
  value.explorer.name = 'Mi mapa';
  value.explorer.zones = [{ id: 'sur', name: 'Zona Sur', color: '#225588', bounds: { west: -64.4, east: -64.3, south: -33.2, north: -33.1 }, enabled: true, videoUrl: 'https://example.com/sur.mp4', duration: 4 }];
  assert.deepEqual(parsePresentationSettings(value).explorer, value.explorer);
  assert.equal(presentationZones(value.explorer, []).at(0).label, 'Zona Sur');
  value.explorer.zones[0].enabled = false;
  assert.deepEqual(presentationZones(value.explorer, []), []);
});

test('invalid new preferences cannot overwrite saved settings', () => {
  const saved = new Map();
  const storage = { setItem: (key, value) => saved.set(key, value) };
  const value = { ...structuredClone(defaultPresentationSettings), explorer: structuredClone(defaultExplorerSettings) };
  assert.ok(savePresentationSettings(storage, 'agency-a', value).settings);
  const before = JSON.stringify([...saved]);
  for (const change of [s => s.popupColor = 'red', s => s.filters.garage = 'yes', s => s.listings.a = { hidden: false, offer: true, kind: 'Casa', bedrooms: -1, garage: null }, s => s.zones = [{ id: 'a', name: 'Zona', color: '#225588', bounds: { west: 2, east: 1, south: 0, north: 1 }, enabled: true, videoUrl: '', duration: 4 }]]) {
    const invalid = structuredClone(value); change(invalid.explorer);
    assert.equal(savePresentationSettings(storage, 'agency-a', invalid).settings, null);
    assert.equal(JSON.stringify([...saved]), before);
  }
});

test('filters combine zone, numeric currency-aware price, type, rooms and known garage', () => {
  const item = { zoneId: 'sur', amount: 100, currency: 'USD', kind: 'Casa', bedrooms: 2, garage: true, hidden: false };
  assert.ok(matchesPresentationFilters(item, { zone: 'sur', min: '90', max: '110', currency: 'USD', kind: 'Casa', bedrooms: '2', garage: 'yes' }));
  for (const filters of [{ zone: 'norte' }, { min: '101' }, { max: '99' }, { currency: 'ARS', max: '200' }, { kind: 'Lote' }, { bedrooms: '3' }, { garage: 'no' }]) assert.equal(matchesPresentationFilters(item, filters), false);
  assert.equal(matchesPresentationFilters({ ...item, garage: null }, { garage: 'no' }), false);
  assert.equal(matchesPresentationFilters({ ...item, hidden: true }, {}), false);
});

test('visual zone drawing supports reverse direction and rejects empty rectangles', () => {
  assert.deepEqual(rectangleFromPoints([-64.3, -33.1], [-64.4, -33.2]), { west: -64.4, east: -64.3, south: -33.2, north: -33.1 });
  assert.equal(rectangleFromPoints([1, 2], [1, 3]), null);
});

test('visibility, offers, garage metadata and filters reach the actual aerial catalogue without changing templates', () => {
  const zone = { id: 'custom', name: 'Mi zona', latitude: -33.12, longitude: -64.35 };
  const configBefore = JSON.stringify(defaultDemoConfig);
  const preferences = structuredClone(defaultExplorerSettings);
  const original = visiblePresentationArea(zone, defaultDemoConfig, preferences);
  assert.equal(original.properties.length, 6);
  const first = original.properties[0];
  preferences.listings[first.id] = { hidden: false, offer: true, kind: 'Lote', bedrooms: 0, garage: true };
  const filtered = visiblePresentationArea(zone, defaultDemoConfig, preferences, { kind: 'Lote', bedrooms: '0', garage: 'yes' });
  assert.equal(filtered.properties.length, 1);
  assert.equal(filtered.properties[0].offer, true);
  assert.equal(filtered.properties[0].amount, first.amount);
  preferences.listings[first.id].hidden = true;
  assert.equal(visiblePresentationArea(zone, defaultDemoConfig, preferences).properties.length, 5);
  assert.equal(JSON.stringify(defaultDemoConfig), configBefore);
});
