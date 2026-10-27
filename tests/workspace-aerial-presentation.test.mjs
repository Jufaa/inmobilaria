import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { aerialCameraForBounds } from '../lib/property-aerial-demo.ts';
import { defaultDemoConfig } from '../lib/property-tour-config.ts';
import { createPresentationArea, pointInPresentationGeometry } from '../lib/workspace-aerial-presentation.ts';

const rectangle = { type: 'Polygon', coordinates: [[[-64.36,-33.13],[-64.34,-33.13],[-64.34,-33.11],[-64.36,-33.11],[-64.36,-33.13]]] };

test('selected panel boundary contains six distinct fictional presentations without changing records or templates', () => {
  const zone = { id: 'reference-zone-4', name: 'Zona 4', geometry: rectangle };
  const original = JSON.stringify({ zone, config: defaultDemoConfig });
  const area = createPresentationArea(zone, defaultDemoConfig);
  assert.equal(area.label, 'Zona 4');
  assert.equal(area.properties.length, 6);
  assert.equal(new Set(area.properties.map(p => p.id)).size, 6);
  assert.equal(new Set(area.properties.map(p => `${p.latitude},${p.longitude}`)).size, 6);
  for (const p of area.properties) {
    assert.ok(pointInPresentationGeometry([p.longitude,p.latitude], rectangle));
    assert.equal(p.id,p.tour.id);
    assert.ok(p.tour.entranceVideo.endsWith('.mp4'));
    assert.equal(p.tour.neighborhood,'Zona 4');
  }
  assert.equal(JSON.stringify({ zone, config: defaultDemoConfig }), original);
});

test('all ten panel reference boundaries place their samples inside their own actual polygon', () => {
  const data = JSON.parse(readFileSync(new URL('../public/maps/rio-cuarto/reference-zones.geojson',import.meta.url)));
  assert.equal(data.features.length, 10);
  for (const feature of data.features) {
    const area = createPresentationArea({ id: feature.id, name: feature.properties.name, geometry: feature.geometry }, defaultDemoConfig);
    assert.ok(area, feature.id);
    for (const p of area.properties) assert.ok(pointInPresentationGeometry([p.longitude,p.latitude], feature.geometry),p.id);
  }
});

test('holes and disjoint polygons are respected, while missing or malformed location data never invents a zone', () => {
  const hole = [[-64.355,-33.125],[-64.345,-33.125],[-64.345,-33.115],[-64.355,-33.115],[-64.355,-33.125]];
  const second = rectangle.coordinates[0].map(([x,y]) => [x + .04,y]);
  const geometry = { type:'MultiPolygon',coordinates:[[rectangle.coordinates[0],hole],[second]] };
  const area = createPresentationArea({id:'with-hole',name:'Zona con patio',geometry},defaultDemoConfig);
  assert.ok(area);
  for(const p of area.properties) assert.ok(pointInPresentationGeometry([p.longitude,p.latitude], geometry));
  assert.equal(createPresentationArea({id:'empty',name:'Sin ubicación'},defaultDemoConfig),null);
  assert.equal(createPresentationArea({id:'invalid',name:'Inválida',geometry:{type:'Polygon',coordinates:[[null]]}},defaultDemoConfig),null);
  const fallback = createPresentationArea({id:'saved',name:'Barrio guardado',latitude:-33.12,longitude:-64.35},defaultDemoConfig);
  assert.ok(fallback);
});

test('camera fit scales to panel boundaries and standalone demo entry points are retired', () => {
  const area = createPresentationArea({id:'fit',name:'Zona grande',geometry:rectangle},defaultDemoConfig);
  const camera = aerialCameraForBounds(area.zone.bounds);
  assert.equal(camera.tilt,0);
  assert.ok(camera.range > 1700);
  assert.equal(camera.center.lng,-64.35);
  for(const path of ['../app/recorridos/page.tsx','../app/recorridos/mapa/page.tsx','../components/PropertyTourMapDemo.tsx']) assert.equal(existsSync(new URL(path,import.meta.url)),false);
});

test('both editable templates are used by stable presentation zones', () => {
  const config=structuredClone(defaultDemoConfig);
  config.properties[0].title='Plantilla primera'; config.properties[1].title='Plantilla segunda';
  const titles=['zone-A','zone-B'].map(id=>createPresentationArea({id,name:id,geometry:rectangle},config).properties[0].title);
  assert.deepEqual(new Set(titles),new Set(['Plantilla primera','Plantilla segunda']));
});
