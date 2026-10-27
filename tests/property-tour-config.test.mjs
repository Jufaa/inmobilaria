import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDemoConfig, parseDemoConfig, reorderDemoProperty, mapPropertiesForConfig, toursForConfig, readDemoConfig, saveDemoConfig, initialExplorerSelection, updateExplorerSelection, zonesForConfig } from '../lib/property-tour-config.ts';

test('configuration round-trips exactly two editable properties without modifying defaults', () => {
  const copy = JSON.parse(JSON.stringify(defaultDemoConfig));
  copy.properties[0].title = 'Mi propiedad de prueba';
  copy.properties[0].latitude = -33.11;
  copy.properties[0].interiorVideo = 'https://example.com/interior.mp4';
  const parsed = parseDemoConfig(copy);
  assert.equal(parsed.properties.length, 2);
  assert.equal(mapPropertiesForConfig(parsed)[0].title, copy.properties[0].title);
  assert.equal(mapPropertiesForConfig(parsed)[0].latitude, -33.11);
  const zone = zonesForConfig(parsed)[0];
  assert.ok(zone.bounds.south < -33.11 && zone.bounds.north > -33.11);
  assert.equal(toursForConfig(parsed)[0].interiorVideo, copy.properties[0].interiorVideo);
  assert.notEqual(defaultDemoConfig.properties[0].title, copy.properties[0].title);
});

test('reordering changes the carousel order without mixing map identities or videos', () => {
  const reversed = reorderDemoProperty(defaultDemoConfig, 'banda-norte', -1);
  assert.deepEqual(reversed.properties.map((item) => item.id), ['banda-norte', 'centro']);
  assert.deepEqual(mapPropertiesForConfig(reversed).map((item) => item.id), [2, 1]);
  assert.equal(toursForConfig(reversed)[0].interiorVideo, defaultDemoConfig.properties[1].interiorVideo);
  assert.equal(defaultDemoConfig.properties[0].id, 'centro');
});

test('invalid media, coordinates, prices, identities, and extra properties are rejected without storage writes', () => {
  const cases = [
    (value) => value.properties.push(value.properties[0]),
    (value) => value.properties[1].id = value.properties[0].id,
    (value) => value.properties[0].id = 'another-property',
    (value) => value.properties[0].latitude = 91,
    (value) => value.properties[0].longitude = -181,
    (value) => value.properties[0].price = -1,
    (value) => value.properties[0].title = '',
    (value) => value.properties[0].interiorVideo = 'javascript:alert(1)',
    (value) => value.properties[0].locationVideo = 'https://name:password@example.com/file.mp4',
    (value) => value.properties[0].entranceVideo = 'http://example.com/file.mp4',
    (value) => value.properties[0].poster = '/demo-assets/../private.png',
    (value) => value.properties[0].poster = 'data:image/svg+xml,<svg/>',
  ];
  for (const invalidate of cases) {
    const value = structuredClone(defaultDemoConfig);
    invalidate(value);
    let writes = 0;
    const original = JSON.stringify(defaultDemoConfig);
    assert.equal(parseDemoConfig(value), null);
    assert.equal(saveDemoConfig({ setItem() { writes++; } }, value).config, null);
    assert.equal(writes, 0);
    assert.equal(JSON.stringify(defaultDemoConfig), original);
  }
});

test('saving and reloading retain edits and order, while corrupt or unavailable storage is recoverable', () => {
  let saved = '';
  const storage = { setItem(key, value) { saved = value; }, getItem() { return saved || null; } };
  const reversed = reorderDemoProperty(defaultDemoConfig, 'banda-norte', -1);
  assert.deepEqual(saveDemoConfig(storage, reversed).config, reversed);
  assert.deepEqual(readDemoConfig(storage).config, reversed);
  assert.deepEqual(readDemoConfig({ getItem() { return '{invalid'; } }).config, defaultDemoConfig);
  assert.ok(readDemoConfig({ getItem() { throw Error('blocked'); } }).error);
  assert.equal(saveDemoConfig({ setItem() { throw Error('full'); } }, reversed).config, null);
});

test('the first map click opens the video carousel without entering the interior tour', () => {
  assert.equal(initialExplorerSelection.carouselOpen, false);
  const selected = updateExplorerSelection(defaultDemoConfig, initialExplorerSelection, { type: 'select', id: 'centro' });
  assert.equal(selected.selectedId, 'centro');
  assert.equal(selected.carouselOpen, true);
  assert.equal(selected.activeTourId, null);
  assert.equal(selected.focusRevision, 1);
  assert.deepEqual(updateExplorerSelection(defaultDemoConfig, selected, { type: 'select', id: 'unknown' }), selected);
});

test('carousel navigation wraps and follows configured order; only an explicit open action enters the tour', () => {
  const config = reorderDemoProperty(defaultDemoConfig, 'banda-norte', -1);
  let selected = updateExplorerSelection(config, initialExplorerSelection, { type: 'next', direction: 1 });
  assert.equal(selected.selectedId, 'banda-norte');
  selected = updateExplorerSelection(config, selected, { type: 'next', direction: 1 });
  assert.equal(selected.selectedId, 'centro');
  selected = updateExplorerSelection(config, selected, { type: 'next', direction: 1 });
  assert.equal(selected.selectedId, 'banda-norte');
  assert.equal(selected.activeTourId, null);
  assert.equal(selected.carouselOpen, true);
  const open = updateExplorerSelection(config, selected, { type: 'open' });
  assert.equal(open.activeTourId, 'banda-norte');
  assert.deepEqual(updateExplorerSelection(config, open, { type: 'close' }), selected);
  const dismissed = updateExplorerSelection(config, selected, { type: 'dismiss' });
  assert.equal(dismissed.carouselOpen, false);
  assert.equal(dismissed.selectedId, selected.selectedId);
  assert.equal(dismissed.focusRevision, selected.focusRevision);
  assert.equal(updateExplorerSelection(config, dismissed, { type: 'select', id: selected.selectedId }).carouselOpen, true);
});
