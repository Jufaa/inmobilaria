import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterProperties,
  isWithinBounds,
  normalizeSearch,
} from '../lib/search.ts';
import { properties } from '../lib/properties.ts';
import { zones, resolveAreaQuery, getAreaSuggestions } from '../lib/zones.ts';

const base = {
  operation: 'Comprar',
  search: '',
  type: 'Todas',
  minBeds: 0,
  minPrice: null,
  maxPrice: null,
  neighborhood: '',
  amenities: [],
  onlyFavorites: false,
  favorites: [],
  viewport: null,
};
const ids = (filters) =>
  filterProperties(properties, { ...base, ...filters }).map(
    (property) => property.id,
  );

test('search ignores accents, casing, and word order', () => {
  assert.equal(normalizeSearch('  BALCÓN  '), 'balcon');
  assert.equal(normalizeSearch('RÍO CUARTO'), 'rio cuarto');
  assert.deepEqual(ids({ search: 'balcon CENTRO' }), [1]);
});
test('zone, budget, rooms, and all requested amenities combine', () => {
  assert.deepEqual(
    ids({
      neighborhood: 'Banda Norte',
      minPrice: 200000,
      maxPrice: 250000,
      minBeds: 3,
      amenities: ['Balcón', 'Cochera'],
    }),
    [2],
  );
  assert.deepEqual(ids({ amenities: ['Patio', 'Cochera'] }), [4]);
});
test('operation and favorites remain independent filters', () => {
  assert.deepEqual(ids({ onlyFavorites: true, favorites: [1, 5] }), [1]);
  assert.deepEqual(
    ids({ operation: 'Alquilar', onlyFavorites: true, favorites: [1, 5] }),
    [5],
  );
});
test('viewport bounds include edges and exclude outside points', () => {
  const bounds = {
    west: -64.355,
    east: -64.325,
    south: -33.135,
    north: -33.12,
  };
  assert.equal(
    isWithinBounds({ longitude: bounds.west, latitude: bounds.north }, bounds),
    true,
  );
  assert.equal(
    isWithinBounds({ longitude: -64.36, latitude: -33.13 }, bounds),
    false,
  );
  assert.deepEqual(ids({ viewport: bounds }), [1, 3]);
});
test('longitude bounds can cross the antimeridian', () => {
  const bounds = { west: 170, east: -170, south: -10, north: 10 };
  assert.equal(isWithinBounds({ longitude: 179, latitude: 0 }, bounds), true);
  assert.equal(isWithinBounds({ longitude: -179, latitude: 0 }, bounds), true);
  assert.equal(isWithinBounds({ longitude: 0, latitude: 0 }, bounds), false);
});
test('empty combinations can be recovered by removing one constraint', () => {
  assert.deepEqual(ids({ neighborhood: 'Centro', maxPrice: 150000 }), []);
  assert.deepEqual(ids({ neighborhood: 'Centro' }), [1]);
  assert.deepEqual(ids({ minPrice: 250000, maxPrice: 200000 }), []);
});
test('demo zone boxes contain their sample neighborhood coordinates', () => {
  for (const property of properties) {
    const zone = zones.find((zone) => zone.label === property.neighborhood);
    assert.ok(zone);
    assert.equal(isWithinBounds(property, zone.bounds), true);
  }
});

test('explicit location queries resolve directional aliases and apartment wording', () => {
  assert.deepEqual(resolveAreaQuery('sur'), ['sur']);
  assert.deepEqual(resolveAreaQuery('departamentos zona sur'), ['sur']);
  assert.deepEqual(resolveAreaQuery('zona norte'), ['norte']);
  assert.deepEqual(resolveAreaQuery('CENTRO y zona Sur'), ['centro', 'sur']);
  assert.deepEqual(resolveAreaQuery('usr'), ['sur']);
  assert.deepEqual(resolveAreaQuery('xyz'), []);
  assert.deepEqual(
    getAreaSuggestions('usr').map((area) => area.id),
    ['sur'],
  );
});
test('multiple directional and neighborhood selections are OR, other filters are AND', () => {
  assert.deepEqual(
    ids({ type: 'Departamento', areaIds: ['norte', 'sur'] }),
    [2, 7],
  );
  assert.deepEqual(
    ids({
      type: 'Departamento',
      areaIds: ['banda-norte', 'sur'],
      maxPrice: 160000,
      amenities: ['Balcón'],
    }),
    [7],
  );
  assert.deepEqual(
    ids({ type: 'Departamento', areaIds: ['sur'], maxPrice: 140000 }),
    [],
  );
});
test('an explicit apartment default does not remove all-inmueble discovery', () => {
  assert.deepEqual(ids({ type: 'Departamento' }), [1, 2, 7, 309, 310]);
  assert.deepEqual(ids({ type: 'Todas' }), [1, 2, 3, 4, 7, 309, 310]);
});

test('rental examples cover each search sector with coordinate-consistent markers', () => {
  const rentals = properties.filter(
    (property) => property.operation === 'Alquilar',
  );
  assert.equal(rentals.length, 26);
  assert.deepEqual(
    Object.fromEntries(
      ['Centro', 'Norte', 'Sur', 'Este', 'Oeste'].map((region) => [
        region,
        rentals.filter((property) => property.region === region).length,
      ]),
    ),
    { Centro: 7, Norte: 6, Sur: 6, Este: 4, Oeste: 3 },
  );
  for (const property of rentals) {
    const region = zones.find(
      (zone) => zone.kind === 'region' && zone.label === property.region,
    );
    assert.ok(region);
    assert.equal(isWithinBounds(property, region.bounds), true);
  }
  assert.equal(
    new Set(
      rentals.map((property) => `${property.latitude},${property.longitude}`),
    ).size,
    rentals.length,
  );
  assert.deepEqual(
    ids({
      operation: 'Alquilar',
      neighborhood: 'Bimaco',
      type: 'Departamento',
    }),
    [107, 108, 305, 306],
  );
});
