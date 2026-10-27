import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { tourProperties, initialTourState, updateTourState, createTourState } from '../lib/property-tour-demo.ts';

test('the preview contains exactly two fictional apartments with existing local media', () => {
  assert.equal(tourProperties.length, 2);
  assert.equal(new Set(tourProperties.map((property) => property.id)).size, 2);
  for (const property of tourProperties) {
    assert.ok(property.scenes.length >= 2);
    assert.equal(new Set(property.scenes.map((scene) => scene.id)).size, property.scenes.length);
    for (const url of [property.panorama, ...property.scenes.map((scene) => scene.image)]) {
      assert.ok(url.startsWith('/demo-assets/'));
      assert.ok(existsSync(new URL(`../public${url}`, import.meta.url)));
    }
    assert.ok(property.scenes.every((scene) => scene.x > 0 && scene.x < 100 && scene.y > 0 && scene.y < 100));
  }
});

test('the preview starts outside and selecting either apartment plays its entrance before opening the interior', () => {
  assert.equal(initialTourState.phase, 'building');
  for (const property of tourProperties) {
    const entering = updateTourState(initialTourState, { type: 'property', id: property.id });
    assert.equal(entering.phase, 'entering');
    assert.equal(entering.propertyId, property.id);
    assert.equal(updateTourState(entering, { type: 'entered', id: property.id }).phase, 'inside');
    assert.equal(updateTourState(entering, { type: 'entered', id: property.id }).mode, 'video');
  }
  assert.deepEqual(updateTourState(initialTourState, { type: 'property', id: 'third-property' }), initialTourState);
});

test('the entrance and interior use local MP4 footage rather than the former slideshow', () => {
  assert.equal(new Set(tourProperties.map((property) => property.interiorVideo)).size, 2);
  for (const property of tourProperties) {
    for (const url of [property.entranceVideo, property.interiorVideo]) {
      assert.ok(url.endsWith('.mp4'));
      const media = readFileSync(new URL(`../public${url}`, import.meta.url));
      assert.equal(media.subarray(4, 8).toString(), 'ftyp');
      assert.ok(media.length > 100_000);
      assert.ok(media.includes(Buffer.from('avc1')));
      assert.ok(media.indexOf('moov') < media.indexOf('mdat'), 'MP4 metadata must precede frame data for immediate playback');
    }
    assert.ok(existsSync(new URL(`../public${property.buildingPoster}`, import.meta.url)));
  }
});

test('late video-end events cannot open the wrong apartment or bypass the building screen', () => {
  assert.deepEqual(updateTourState(initialTourState, { type: 'entered', id: initialTourState.propertyId }), initialTourState);
  assert.deepEqual(updateTourState(initialTourState, { type: 'mode', mode: 'video' }), initialTourState);
  assert.deepEqual(updateTourState(initialTourState, { type: 'scene', index: 1 }), initialTourState);
  const first = updateTourState(initialTourState, { type: 'property', id: tourProperties[0].id });
  const second = updateTourState(first, { type: 'property', id: tourProperties[1].id });
  assert.deepEqual(updateTourState(second, { type: 'entered', id: tourProperties[0].id }), second);
  const inside = updateTourState(second, { type: 'entered', id: tourProperties[1].id });
  assert.equal(updateTourState(inside, { type: 'return' }).phase, 'building');
  assert.deepEqual(updateTourState(updateTourState(inside, { type: 'return' }), { type: 'entered', id: inside.propertyId }), updateTourState(inside, { type: 'return' }));
});

test('the existing panorama, floor plan and scene selection stay available inside both apartments', () => {
  for (const property of tourProperties) {
    const entering = updateTourState(initialTourState, { type: 'property', id: property.id });
    const state = updateTourState(entering, { type: 'entered', id: property.id });
    for (const mode of ['panorama', 'plan', 'video', 'photo']) {
      assert.deepEqual(updateTourState(state, { type: 'mode', mode }), { ...state, mode });
    }
    property.scenes.forEach((scene, index) => {
      assert.deepEqual(updateTourState({ ...state, mode: 'plan' }, { type: 'scene', index }), { ...state, sceneIndex: index, mode: 'photo' });
    });
    assert.deepEqual(updateTourState(state, { type: 'scene', index: 100 }), state);
    assert.equal(updateTourState(state, { type: 'next' }).sceneIndex, 1);
    assert.equal(updateTourState(state, { type: 'previous' }).sceneIndex, property.scenes.length - 1);
  }
});

test('a map entry initializes the matching entrance without changing the standalone building entry', async () => {
  const { createTourState } = await import('../lib/property-tour-demo.ts');
  assert.deepEqual(createTourState(), initialTourState);
  assert.deepEqual(createTourState('unknown'), initialTourState);
  for (const property of tourProperties) {
    assert.deepEqual(createTourState(property.id), updateTourState(initialTourState, { type: 'property', id: property.id }));
  }
});

test('exactly two existing demo map identities resolve to their corresponding video tours', async () => {
  const { tourMapProperties, tourIdForMapProperty } = await import('../lib/property-tour-map.ts');
  const { properties } = await import('../lib/properties.ts');
  assert.equal(tourMapProperties.length, 2);
  assert.equal(new Set(tourMapProperties.map((property) => property.id)).size, 2);
  tourMapProperties.forEach((property, index) => {
    const seed = properties.find((item) => item.id === property.id);
    assert.notEqual(property, seed);
    assert.equal(property.latitude, seed.latitude);
    assert.equal(property.longitude, seed.longitude);
    assert.equal(property.price, seed.price);
    assert.equal(property.title, tourProperties[index].title);
    assert.equal(property.image, tourProperties[index].interiorPoster);
    assert.equal(tourIdForMapProperty(property.id), tourProperties[index].id);
  });
  assert.equal(tourIdForMapProperty(999), undefined);
});

test('an explicitly disabled property drone enters its interior directly while enabled and legacy entries keep the entrance sequence', () => {
  const properties = tourProperties.map((property, index) => ({ ...property, entranceEnabled: index !== 0 }));
  assert.equal(createTourState(properties[0].id, properties).phase, 'inside');
  assert.equal(createTourState(properties[1].id, properties).phase, 'entering');
  assert.equal(createTourState(tourProperties[0].id).phase, 'entering');
  const inside = createTourState(properties[0].id, properties);
  assert.equal(updateTourState(inside, { type: 'entered', id: properties[1].id }, properties), inside);
});
