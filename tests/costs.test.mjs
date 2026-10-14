import test from 'node:test';
import assert from 'node:assert/strict';
import { properties, formatPrice } from '../lib/properties.ts';
import { propertyCosts } from '../lib/costs.ts';
import { filterProperties, parseBudget } from '../lib/search.ts';
test('same-currency rental subtotals include only informed components', () => {
  const property = properties.find((property) => property.id === 201);
  const costs = propertyCosts(property);
  assert.equal(costs.monthly, 675000);
  assert.equal(costs.entry, 1295000);
  assert.equal(formatPrice(costs.monthly, costs.currency), 'ARS 675.000');
});
test('different currencies and unknown expenses never produce a misleading sum', () => {
  const property = properties.find((property) => property.id === 201);
  assert.equal(
    propertyCosts({ ...property, expensesCurrency: 'USD' }).monthly,
    null,
  );
  assert.equal(
    propertyCosts({ ...property, expenses: undefined }).monthly,
    null,
  );
  assert.equal(
    propertyCosts({ ...property, depositCurrency: 'USD' }).entry,
    null,
  );
  assert.equal(
    propertyCosts({ ...property, operation: 'Comprar' }).monthly,
    null,
  );
});
test('budget applies only within the explicitly selected currency', () => {
  const property = properties.find((property) => property.id === 201);
  const old = { ...property, id: 999, price: 850, currency: 'USD' };
  const filters = {
    operation: 'Alquilar',
    search: '',
    type: 'Departamento',
    minBeds: 0,
    minPrice: null,
    maxPrice: 900000,
    neighborhood: '',
    amenities: [],
    onlyFavorites: false,
    favorites: [],
    viewport: null,
    currency: 'ARS',
  };
  assert.deepEqual(
    filterProperties([property, old], filters).map((value) => value.id),
    [201],
  );
  assert.deepEqual(
    filterProperties([property, old], { ...filters, currency: 'USD' }).map(
      (value) => value.id,
    ),
    [999],
  );
});

test('Argentine thousands and decimal separators parse deliberately', () => {
  assert.equal(parseBudget('800.000'), 800000);
  assert.equal(parseBudget('800000'), 800000);
  assert.equal(parseBudget('850,50'), 850.5);
  assert.equal(parseBudget(''), null);
  assert.equal(Number.isNaN(parseBudget('precio')), true);
});
