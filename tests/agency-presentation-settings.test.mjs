import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPresentationSettings, parsePresentationSettings, presentationStorageKey, readPresentationSettings, savePresentationSettings } from '../lib/agency-presentation.ts';

test('sample intro and zone transitions are opt-in while property drone videos are always enabled', () => {
  const settings = parsePresentationSettings(defaultPresentationSettings);
  assert.ok(settings);
  assert.equal(settings.intro.enabled, false);
  assert.equal(Object.keys(settings.zones).length, 2);
  assert.ok(Object.values(settings.zones).every(zone => !zone.transitionEnabled && zone.videoUrl.endsWith('.mp4')));
  assert.equal(Object.keys(settings.properties).length, 12);
  assert.ok(Object.values(settings.properties).every(property => property.droneEnabled));
});

test('presentation settings are isolated per agency, preserve legacy template storage, and reject unsafe media, coordinates and colors', () => {
  const data = new Map([['territorio-tour-config-v1', 'legacy untouched']]);
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const edited = structuredClone(defaultPresentationSettings);
  edited.map.accentColor = '#ff5533';
  edited.points = [{ id: 'school', name: 'Escuela', latitude: -33.12, longitude: -64.35, color: '#447766' }];
  edited.properties['presentation-centro-1'] = { droneEnabled: true, videoUrl: '/demo-assets/tours/entrance-01.mp4' };
  assert.ok(savePresentationSettings(storage, 'agency-a', edited).settings);
  assert.equal(readPresentationSettings(storage, 'agency-a').settings.map.accentColor, '#ff5533');
  assert.equal(readPresentationSettings(storage, 'agency-b').settings.map.accentColor, defaultPresentationSettings.map.accentColor);
  assert.equal(data.get('territorio-tour-config-v1'), 'legacy untouched');
  assert.notEqual(presentationStorageKey('a/b'), presentationStorageKey('a%2Fb'));
  for (const mutate of [s => {s.intro.videoUrl='javascript:alert(1)';},s=>{s.map.artworkUrl='data:image/svg+xml;base64,PHN2Zy8+';},s=>{s.map.accentColor='red;display:none';},s=>{s.points[0].latitude=NaN;},s=>{s.points.push({...s.points[0]});},s=>{s.map.bounds.west=s.map.bounds.east;},s=>{s.zones.centro.videoUrl='https://user:secret@example.com/movie.mp4';}]) {
    const invalid = structuredClone(edited); mutate(invalid);
    const before = JSON.stringify([...data]);
    assert.equal(savePresentationSettings(storage, 'agency-a', invalid).settings, null);
    assert.equal(JSON.stringify([...data]), before);
  }
});

test('missing clips may be disabled, corrupt data and storage failures never overwrite current settings', () => {
  const edited = structuredClone(defaultPresentationSettings);
  edited.intro = { enabled: false, videoUrl: '' };
  edited.zones.centro = { transitionEnabled: false, videoUrl: '' };
  assert.ok(parsePresentationSettings(edited));
  let writes = 0;
  assert.ok(readPresentationSettings({getItem:()=>'{bad'}, 'agency').error);
  assert.ok(readPresentationSettings({getItem:()=>{throw Error('denied');}}, 'agency').error);
  const result = savePresentationSettings({setItem:()=>{writes++; throw Error('full');}}, 'agency', edited);
  assert.equal(result.settings, null);
  assert.ok(result.error);
  assert.equal(writes, 1);
});
