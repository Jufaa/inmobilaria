import test from 'node:test';
import assert from 'node:assert/strict';
import { properties } from '../lib/properties.ts';
import {
  createDefaultRepository,
  mergeDemoSeeds,
  parseRepository,
  selectPublicProperties,
  validateProperty,
  validateBrand,
  isSafeImageUrl,
  DEFAULT_BRAND,
} from '../lib/demo-repository.ts';

test('draft and sold inventory is hidden while published and reserved stay public', () => {
  const catalog = ['draft', 'published', 'reserved', 'sold'].map(
    (status, index) => ({ ...properties[0], id: index + 1, status }),
  );
  assert.deepEqual(
    selectPublicProperties(catalog).map((property) => property.id),
    [2, 3],
  );
});
test('publishing requires complete positive values, photo and safe panorama', () => {
  const draft = {
    ...properties[0],
    status: 'draft',
    price: 0,
    area: 0,
    image: '',
  };
  assert.deepEqual(validateProperty(draft), []);
  assert.ok(validateProperty({ ...draft, status: 'published' }).length >= 3);
  assert.deepEqual(
    validateProperty({ ...properties[0], status: 'published' }),
    [],
  );
  assert.ok(
    validateProperty({ ...properties[0], tourUrl: 'javascript:alert(1)' })
      .length,
  );
  assert.ok(validateProperty({ ...properties[0], expenses: -5 }).length);
});
test('brand settings enforce safe logo and white text contrast', () => {
  assert.deepEqual(validateBrand(DEFAULT_BRAND), []);
  assert.ok(validateBrand({ ...DEFAULT_BRAND, color: '#ffffff' }).length);
  assert.ok(
    validateBrand({ ...DEFAULT_BRAND, logo: 'javascript:alert(1)' }).length,
  );
  assert.ok(validateBrand({ ...DEFAULT_BRAND, name: '' }).length);
  assert.equal(isSafeImageUrl('https://images.unsplash.com/example.jpg'), true);
  assert.equal(
    isSafeImageUrl('https://user:password@example.com/photo.jpg'),
    false,
  );
});
test('stored repository round-trips validated data and rejects duplicates and broken relationships', () => {
  const repository = createDefaultRepository(properties);
  assert.ok(parseRepository(JSON.parse(JSON.stringify(repository))));
  assert.equal(parseRepository({ ...repository, version: 9 }), null);
  assert.equal(
    parseRepository({
      ...repository,
      catalog: [repository.catalog[0], repository.catalog[0]],
    }),
    null,
  );
  assert.equal(
    parseRepository({
      ...repository,
      leads: [{ ...repository.leads[0], propertyId: 9999 }],
    }),
    null,
  );
  assert.equal(parseRepository({ version: 1, catalog: 'invalid' }), null);
});

test('older saved demo receives rental seeds without overwriting edits, custom records, brand, or leads', () => {
  const old = createDefaultRepository(properties.slice(0, 8));
  delete old.seedIds; // Repository written before additive seed tracking existed.
  old.catalog[0] = {
    ...old.catalog[0],
    title: 'Mi edición',
    price: 199000,
    status: 'reserved',
  };
  old.catalog.push({
    ...old.catalog[0],
    id: 9001,
    title: 'Propiedad creada por el cliente',
  });
  old.brand = { ...old.brand, name: 'Marca del cliente' };
  const migrated = mergeDemoSeeds(old, properties);
  assert.equal(
    migrated.catalog.find((property) => property.id === 1).title,
    'Mi edición',
  );
  assert.equal(
    migrated.catalog.find((property) => property.id === 1).status,
    'reserved',
  );
  assert.equal(
    migrated.catalog.find((property) => property.id === 9001).title,
    'Propiedad creada por el cliente',
  );
  assert.equal(migrated.brand, old.brand);
  assert.equal(migrated.leads, old.leads);
  assert.equal(migrated.visits, old.visits);
  assert.equal(
    migrated.catalog.filter((property) => property.operation === 'Alquilar')
      .length,
    26,
  );
  assert.equal(
    new Set(migrated.catalog.map((property) => property.id)).size,
    migrated.catalog.length,
  );
  assert.equal(
    mergeDemoSeeds(migrated, properties).catalog.length,
    migrated.catalog.length,
  );
  assert.ok(parseRepository(migrated));
});
test('tracked removed seed examples are not silently restored on the next startup', () => {
  const repository = createDefaultRepository(properties);
  repository.catalog = repository.catalog.filter(
    (property) => property.id !== 101,
  );
  const migrated = mergeDemoSeeds(repository, properties);
  assert.equal(
    migrated.catalog.some((property) => property.id === 101),
    false,
  );
});

test('legacy prices keep USD semantics and amounts instead of adopting new ARS seeds', () => {
  const legacy = createDefaultRepository(properties.slice(0, 8));
  const oldRental = {
    ...legacy.catalog.find((property) => property.id === 5),
    price: 850,
    expenses: 60,
  };
  delete oldRental.currency;
  delete oldRental.expensesCurrency;
  legacy.catalog = legacy.catalog.map((property) =>
    property.id === 5 ? oldRental : property,
  );
  const migrated = mergeDemoSeeds(legacy, properties);
  const rental = migrated.catalog.find((property) => property.id === 5);
  assert.equal(rental.price, 850);
  assert.equal(rental.expenses, 60);
  assert.equal(rental.currency, 'USD');
  assert.equal(rental.expensesCurrency, 'USD');
  assert.equal(
    migrated.catalog.find((property) => property.id === 201).currency,
    'ARS',
  );
});
test('only controlled demo asset paths are accepted as local images', () => {
  assert.equal(
    isSafeImageUrl('/demo-assets/fictional-rio-cuarto-living.png'),
    true,
  );
  assert.equal(isSafeImageUrl('/demo-assets/../secret.png'), false);
  assert.equal(isSafeImageUrl('//evil.example/photo.png'), false);
});

test('new apartment seeds add once while retaining earlier property edits', () => {
  const repository = createDefaultRepository(
    properties.filter((property) => property.id < 301),
  );
  repository.catalog[0] = {
    ...repository.catalog[0],
    title: 'Edición conservada',
  };
  const updated = mergeDemoSeeds(repository, properties);
  assert.equal(updated.catalog.length, properties.length);
  assert.equal(updated.catalog[0].title, 'Edición conservada');
  assert.equal(
    updated.catalog.filter(
      (property) => property.id >= 301 && property.id <= 310,
    ).length,
    10,
  );
  assert.equal(
    mergeDemoSeeds(updated, properties).catalog.length,
    updated.catalog.length,
  );
});

 test('former default brand migrates without altering native monetary amounts', () => {
  const repository = createDefaultRepository(properties);
  repository.brand.name = 'Territorio';
  const price = repository.catalog[0].price;
  const migrated = mergeDemoSeeds(repository, properties);
  assert.equal(migrated.brand.name, 'Nombre de Empresa');
  assert.equal(migrated.catalog[0].price, price);
  repository.brand.name = 'Empresa personalizada';
  assert.equal(mergeDemoSeeds(repository, properties).brand.name, 'Empresa personalizada');
 });
