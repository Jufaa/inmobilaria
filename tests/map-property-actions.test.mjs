import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function load(path, mocks) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', source)(id => { if (!(id in mocks)) throw Error(`Unexpected import ${id}`); return mocks[id]; }, exports);
  return exports;
}
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ title: 'Casa real', type: 'HOUSE', operation: 'SALE', currency: 'USD', neighborhood: 'Centro', address: 'Calle 123', area: '80', bedrooms: '2', bathrooms: '1', price: '90000', latitude: '-33.1', longitude: '-64.3' })) data.set(key, value);
  return data;
}
function setup({ denied = false, photos = [], verificationFails = false, missing = false } = {}) {
  const calls = [], paths = [];
  const service = { propertyCurrencies: ['ARS', 'USD'], propertyOperations: ['SALE', 'RENT'], propertyStatuses: ['DRAFT', 'PUBLISHED'], propertyTypes: ['HOUSE'], createAgencyProperty: async (...args) => { calls.push(args); return { id: 'real-id', ...args[1], media: [] }; }, updateAgencyProperty: async (...args) => { calls.push(args); return { id: args[1] }; }, updateAgencyPropertyStatus: async (...args) => { calls.push(args); return true; } };
  service.updateAgencyPropertyWithPhotos = async (...args) => { calls.push(args); return missing ? null : { id: args[1], ...args[2], media: [{ id: 'old-photo' }] }; };
  const actions = load('../app/inmobiliaria/[agencyId]/panel/actions.ts', {
    'next/cache': { revalidatePath: path => paths.push(path) },
    '@/lib/agency-access': { requireAgencyPlatformEditAccess: async () => { if (denied) throw Error('denied'); return { membership: { agency: { id: 'canonical-agency' } } }; } },
    '@/lib/properties/agency-property-service': service,
    '@/lib/properties/property-photo-policy': { parsePropertyPhotoUrls: () => photos, verifyPropertyPhotos: async () => { if (verificationFails) throw Error('store rejected'); } },
    '@vercel/blob': { head: async () => ({}) },
  });
  return { actions, calls, paths };
}

test('map creation returns a real record, uses canonical scope and defaults to draft without changing old action output', async () => {
  const { actions, calls, paths } = setup();
  assert.equal(typeof actions.createMapPropertyAction, 'function');
  const input = form(); input.set('agencyId', 'attacker');
  const result = await actions.createMapPropertyAction('agency-slug', input);
  assert.equal(result.property.id, 'real-id');
  assert.equal(calls[0][0], 'canonical-agency');
  assert.equal(calls[0][1].status, 'DRAFT');
  assert.equal(calls[0][1].latitude, -33.1);
  assert.ok(paths.includes('/inmobiliaria/agency-slug/panel'));
  assert.deepEqual(await actions.createPropertyAction('agency-slug', {}, form()), { success: 'Propiedad guardada en la base de datos.' });
  const existing = form(); existing.set('propertyId', 'existing-id'); existing.set('status', 'PUBLISHED');
  assert.deepEqual(await actions.updatePropertyAction('agency-slug', {}, existing), { success: 'Cambios guardados en la base de datos.' });
  assert.deepEqual(await actions.updatePropertyAvailabilityAction('agency-slug', {}, existing), { success: 'Disponibilidad actualizada.' });
});

test('map editing reuses canonical tenant guard/validation, returns the real listing and preserves old photos', async () => {
  const ctx = setup();
  assert.equal(typeof ctx.actions.updateMapPropertyAction, 'function');
  const input = form(); input.set('agencyId', 'attacker'); input.set('status', 'PUBLISHED');
  const result = await ctx.actions.updateMapPropertyAction('slug', 'existing', input);
  assert.equal(result.property.id, 'existing');
  assert.deepEqual(result.property.media, [{ id: 'old-photo' }]);
  assert.equal(ctx.calls[0][0], 'canonical-agency');
  assert.equal(ctx.calls[0][1], 'existing');
  assert.equal(ctx.calls[0][2].status, 'PUBLISHED');
  assert.deepEqual(ctx.calls[0][3], []);
  assert.ok(ctx.paths.includes('/inmobiliaria/slug/panel'));
  const invalid = form(); invalid.set('price', '-1');
  assert.ok((await ctx.actions.updateMapPropertyAction('slug', 'existing', invalid)).error);
  assert.equal(ctx.calls.length, 1);
  const other = setup({ missing: true });
  assert.ok((await other.actions.updateMapPropertyAction('slug', 'foreign-record', form())).error);
  const denied = setup({ denied: true });
  await assert.rejects(() => denied.actions.updateMapPropertyAction('slug', 'existing', form()));
  assert.equal(denied.calls.length, 0);
});

test('map editing rejects new photos before writing unless configured and verified', async () => {
  const old = process.env.BLOB_READ_WRITE_TOKEN;
  try {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const ctx = setup({ photos: ['new-photo'] });
    assert.ok((await ctx.actions.updateMapPropertyAction('slug', 'existing', form())).error);
    assert.equal(ctx.calls.length, 0);
    process.env.BLOB_READ_WRITE_TOKEN = 'test';
    const rejected = setup({ photos: ['new-photo'], verificationFails: true });
    assert.ok((await rejected.actions.updateMapPropertyAction('slug', 'existing', form())).error);
    assert.equal(rejected.calls.length, 0);
    assert.equal((await ctx.actions.updateMapPropertyAction('slug', 'existing', form())).property.id, 'existing');
    assert.deepEqual(ctx.calls[0][3], ['new-photo']);
  } finally { if (old === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = old; }
});

test('map editing atomically appends photos under serializable isolation and enforces total without blocking legacy edits', async () => {
  const existingPhotos = [{ id: 'first', kind: 'PHOTO', url: 'old', sortOrder: 2 }, { id: 'video', kind: 'VIDEO', url: 'video', sortOrder: 5 }];
  const calls = [];
  let found = true;
  const record = media => ({ id: 'existing', media, price: { toNumber: () => 10 }, area: { toNumber: () => 2 }, latitude: null, longitude: null, createdAt: new Date(), updatedAt: new Date() });
  const service = load('../lib/properties/agency-property-service.ts', { 'server-only': {}, '@/lib/prisma': { prisma: { $transaction: async (fn, options) => { assert.equal(options.isolationLevel, 'Serializable'); return fn({ property: { findFirst: async args => { assert.deepEqual(args.where, { id: 'existing', agencyId: 'tenant' }); return found ? record(existingPhotos) : null; }, update: async args => { calls.push(args); return record([...existingPhotos, ...(args.data.media?.create ?? [])]); } } }); } } } });
  const result = await service.updateAgencyPropertyWithPhotos('tenant', 'existing', { title: 'Updated' }, ['new']);
  assert.equal(result.media[0].url, 'old');
  assert.deepEqual(calls[0].where, { id: 'existing', agencyId: 'tenant' });
  assert.deepEqual(calls[0].data.media, { create: [{ kind: 'PHOTO', url: 'new', sortOrder: 6 }] });
  existingPhotos.push(...Array.from({ length: 5 }, (_, i) => ({ id: `photo-${i}`, kind: 'PHOTO', url: 'old', sortOrder: i + 7 })));
  await assert.rejects(() => service.updateAgencyPropertyWithPhotos('tenant', 'existing', { title: 'No write' }, ['over-limit']));
  assert.equal(calls.length, 1);
  existingPhotos.push({ id: 'legacy-extra', kind: 'PHOTO', url: 'old', sortOrder: 15 });
  await service.updateAgencyPropertyWithPhotos('tenant', 'existing', { title: 'Price edit' }, []);
  assert.equal('media' in calls[1].data, false);
  found = false;
  assert.equal(await service.updateAgencyPropertyWithPhotos('tenant', 'existing', { title: 'Foreign' }, []), null);
  assert.equal(calls.length, 2);
});

test('invalid input, missing map position and denied access cannot write a listing', async () => {
  const ctx = setup();
  for (const mutate of [data => data.set('price', '-1'), data => data.delete('latitude'), data => { data.delete('latitude'); data.delete('longitude'); }]) {
    const input = form(); mutate(input);
    assert.ok((await ctx.actions.createMapPropertyAction('agency-slug', input)).error);
  }
  assert.equal(ctx.calls.length, 0);
  const denied = setup({ denied: true });
  const result = await denied.actions.createMapPropertyAction('agency-slug', form()).catch(() => ({ error: 'access denied' }));
  assert.ok(result.error); assert.equal(denied.calls.length, 0);
});

test('unconfigured or unverified photos never write a real listing', async () => {
  const original = process.env.BLOB_READ_WRITE_TOKEN;
  try {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const missing = setup({ photos: ['https://example.com/photo.jpg'] });
    assert.ok((await missing.actions.createMapPropertyAction('agency-slug', form())).error);
    assert.equal(missing.calls.length, 0);
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
    const rejected = setup({ photos: ['photo'], verificationFails: true });
    assert.ok((await rejected.actions.createMapPropertyAction('agency-slug', form())).error);
    assert.equal(rejected.calls.length, 0);
    const verified = setup({ photos: ['verified-store-photo'] });
    assert.equal((await verified.actions.createMapPropertyAction('agency-slug', form())).property.id, 'real-id');
    assert.deepEqual(verified.calls[0][2], ['verified-store-photo']);
  } finally { if (original === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = original; }
});

test('real catalogue creation adds photos atomically and preserves the existing no-photo write shape', async () => {
  const writes = [];
  const service = load('../lib/properties/agency-property-service.ts', { 'server-only': {}, '@/lib/prisma': { prisma: { property: { create: async args => { writes.push(args); return { ...args.data, id: 'id', price: { toNumber: () => 10 }, area: { toNumber: () => 2 }, latitude: null, longitude: null, createdAt: new Date(), updatedAt: new Date(), media: [] }; } } } } });
  await service.createAgencyProperty('tenant', { title: 'A' });
  assert.equal('media' in writes[0].data, false);
  await service.createAgencyProperty('tenant', { title: 'B' }, ['https://example.com/1.jpg', 'https://example.com/2.jpg']);
  assert.deepEqual(writes[1].data.media, { create: [{ kind: 'PHOTO', url: 'https://example.com/1.jpg', sortOrder: 0 }, { kind: 'PHOTO', url: 'https://example.com/2.jpg', sortOrder: 1 }] });
});
