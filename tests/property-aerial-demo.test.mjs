import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultDemoConfig } from '../lib/property-tour-config.ts';
import { buildDemoAreas, initialAreaState, updateAreaState } from '../lib/property-aerial-demo.ts';
import { createTourState, updateTourState, initialTourState } from '../lib/property-tour-demo.ts';

test('each existing zone contains six unique fictional properties and reflects its editable template without changing storage', () => {
  const before = JSON.stringify(defaultDemoConfig);
  const config = structuredClone(defaultDemoConfig);
  config.properties[0].title = 'Mi casa';
  config.properties[0].entranceVideo = 'https://example.com/entrance.mp4';
  const areas = buildDemoAreas(config);
  assert.equal(areas.length, 2);
  assert.equal(new Set(areas.flatMap(a => a.properties.map(p => p.id))).size, 12);
  for (const area of areas) {
    assert.equal(area.properties.length, 6);
    assert.equal(new Set(area.properties.map(p => `${p.latitude},${p.longitude}`)).size, 6);
    for (const property of area.properties) {
      assert.ok(property.latitude > area.zone.bounds.south && property.latitude < area.zone.bounds.north);
      assert.ok(property.longitude > area.zone.bounds.west && property.longitude < area.zone.bounds.east);
      assert.ok(property.tour.entranceVideo.endsWith('.mp4'));
      assert.equal(property.tour.id, property.id);
    }
  }
  assert.equal(areas[0].properties[0].title, 'Mi casa');
  assert.equal(areas[0].properties[1].tour.entranceVideo, config.properties[0].entranceVideo);
  assert.equal(JSON.stringify(defaultDemoConfig), before);
});

test('zone click opens the aerial scene only, marker click starts only a property belonging to that zone, return preserves the area', () => {
  const areas = buildDemoAreas(defaultDemoConfig);
  const area = areas[0];
  const opened = updateAreaState(areas, initialAreaState, { type: 'area', id: area.id });
  assert.equal(opened.areaId, area.id);
  assert.equal(opened.propertyId, null);
  assert.deepEqual(updateAreaState(areas, opened, { type: 'property', id: areas[1].properties[0].id }), opened);
  const entering = updateAreaState(areas, opened, { type: 'property', id: area.properties[3].id });
  assert.equal(entering.propertyId, area.properties[3].id);
  assert.deepEqual(updateAreaState(areas, entering, { type: 'return' }), opened);
  assert.deepEqual(updateAreaState(areas, opened, { type: 'close' }), initialAreaState);
  assert.deepEqual(updateAreaState(areas, initialAreaState, { type: 'area', id: 'invalid' }), initialAreaState);
});

test('all supplied fictional identities play their own entrance and interior while standalone defaults stay unchanged', () => {
  const tours = buildDemoAreas(defaultDemoConfig)[0].properties.map(p => p.tour);
  for (const tour of tours) {
    let state = createTourState(tour.id, tours);
    assert.equal(state.propertyId, tour.id);
    assert.equal(state.phase, 'entering');
    assert.deepEqual(updateTourState(state, { type: 'entered', id: 'wrong' }, tours), state);
    state = updateTourState(state, { type: 'entered', id: tour.id }, tours);
    assert.equal(state.phase, 'inside');
    assert.equal(state.mode, 'video');
    assert.equal(updateTourState(state, { type: 'next' }, tours).sceneIndex, 1);
    assert.equal(updateTourState(state, { type: 'return' }, tours).phase, 'building');
  }
  assert.deepEqual(createTourState(), initialTourState);
  assert.deepEqual(createTourState('invalid'), initialTourState);
});
