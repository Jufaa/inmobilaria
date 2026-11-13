import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as presentation from '../lib/agency-presentation.ts';
import * as explorer from '../lib/presentation-explorer.ts';
import * as tour from '../lib/property-tour-config.ts';
import * as targets from '../lib/agency-offer-targets.ts';
const exampleId = targets.agencyOfferTargets([], presentation.defaultPresentationSettings, tour.defaultDemoConfig).find(target => target.source === 'example').id;

const require = createRequire(import.meta.url);
function harness(kind = 'basic') {
  let allowed = true;
  let current = { ...structuredClone(presentation.defaultPresentationSettings), propertyContacts: { 'real-1': { whatsappNumber: '5493581234567', message: 'Consulta independiente' } } };
  const writes = [], brands = [], refreshed = [];
  const exports = {};
  const path = kind === 'basic' ? 'personalizacion/basic-actions.ts' : 'ofertas/actions.ts';
  const code = ts.transpileModule(readFileSync(new URL(`../app/inmobiliaria/[agencyId]/panel/${path}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', code)(id => {
    if (id === 'next/cache') return { revalidatePath: path => refreshed.push(path) };
    if (id === '@/lib/agency-access') return { requireAgencyBasicEditAccess: async slug => { assert.equal(slug, 'agency-a'); if (!allowed) throw Error('denied'); return { membership: { agency: { id: 'canonical-a' } }, canEdit: false, canManageBasic: true }; } };
    if (id === '@/lib/agency-presentation') return presentation;
    if (id === '@/lib/presentation-explorer') return explorer;
    if (id === '@/lib/prisma') return { prisma: { agency: { updateMany: async query => { brands.push(query); return { count: 1 }; } }, agencyPresentationConfig: { findUnique: async query => { assert.equal(query.where.agencyId, 'canonical-a'); return { demoTourConfig: null }; } } } };
    if (id === '@/lib/properties/property-contact-service') return { updateAgencyPresentationSettings: async (agencyId, transform) => { assert.equal(agencyId, 'canonical-a'); const next = transform(current); assert.ok(presentation.parsePresentationSettings(next)); writes.push(next); current = next; return next; } };
    if (id === '@/lib/properties/agency-property-service') return { listAgencyProperties: async agencyId => { assert.equal(agencyId, 'canonical-a'); return [{ id: 'real-1' }]; } };
    if (id === '@/lib/property-tour-config') return tour;
    if (id === '@/lib/agency-offer-targets') return targets;
    return require(id);
  }, exports);
  return { api: exports, writes, brands, refreshed, deny() { allowed = false; }, get current() { return current; }, set current(value) { current = value; } };
}
const palette = { popupColor: '#112233', popupTextColor: '#ffffff', kindColors: { Casa: '#abcdef' } };
test('own-agency basic palette patches only whitelisted fields and preserves latest independent settings', async () => {
  const app = harness();
  const before = structuredClone(app.current);
  const result = await app.api.saveAgencyBasicAppearanceAction('agency-a', { ...palette, map: { mode: 'artwork' }, propertyContacts: {}, offers: [] });
  assert.equal(result.error, null);
  assert.equal(app.current.explorer.popupColor, '#112233');
  assert.equal(app.current.explorer.kindColors.Casa, '#abcdef');
  assert.deepEqual(app.current.propertyContacts, before.propertyContacts);
  assert.deepEqual(app.current.map, before.map);
  assert.equal(app.current.explorer.offers, undefined);
  app.current = { ...app.current, points: [{ id: 'new-point', name: 'Concurrent', latitude: 0, longitude: 0, color: '#112233' }] };
  await app.api.saveAgencyBasicAppearanceAction('agency-a', palette);
  assert.equal(app.current.points[0].id, 'new-point');
});
test('palette denies unauthorized writes and fails safely on invalid existing or submitted settings', async () => {
  const app = harness();
  for (const value of [{ ...palette, popupColor: 'red' }, { ...palette, kindColors: { Unsupported: '#112233' } }]) assert.ok((await app.api.saveAgencyBasicAppearanceAction('agency-a', value)).error);
  assert.equal(app.writes.length, 0);
  app.current = { broken: true };
  assert.ok((await app.api.saveAgencyBasicAppearanceAction('agency-a', palette)).error);
  assert.deepEqual(app.current, { broken: true });
  app.deny();
  await assert.rejects(app.api.saveAgencyBasicAppearanceAction('agency-a', palette), /denied/);
});
test('brand action accepts only a canonical tenant primary color, never advanced identity fields', async () => {
  const app = harness();
  const form = new FormData(); form.set('brandPrimaryColor', '#ABCDEF'); form.set('logoUrl', 'https://example.com/logo.png');
  assert.equal((await app.api.saveAgencyBasicBrandColorAction('agency-a', form)).error, null);
  assert.deepEqual(app.brands, [{ where: { id: 'canonical-a' }, data: { brandPrimaryColor: '#abcdef' } }]);
  form.set('brandPrimaryColor', 'red');
  assert.ok((await app.api.saveAgencyBasicBrandColorAction('agency-a', form)).error);
  app.deny();
  await assert.rejects(app.api.saveAgencyBasicBrandColorAction('agency-a', form), /denied/);
  assert.equal(app.brands.length, 1);
});
const offer = { id: 'offer-1', source: 'real', propertyId: 'real-1', title: 'Oferta', description: '', price: 10, currency: 'ARS', enabled: true };
test('offers accept only resolved own real or fictional targets and preserve unrelated latest settings', async () => {
  const app = harness('offers'); const before = structuredClone(app.current);
  assert.equal((await app.api.saveAgencyOffersAction('agency-a', [{ ...offer, map: { mode: 'artwork' } }])).error, null);
  assert.deepEqual(app.current.explorer.offers, [offer]);
  assert.deepEqual(app.current.map, before.map);
  assert.deepEqual(app.current.propertyContacts, before.propertyContacts);
  assert.equal((await app.api.saveAgencyOffersAction('agency-a', [{ ...offer, source: 'example', propertyId: exampleId }])).error, null);
  for (const value of [[{ ...offer, propertyId: 'other-tenant' }], [{ ...offer, source: 'example', propertyId: 'real-1' }], { explorer: { offers: [offer] } }, [{ ...offer, price: -1 }]]) assert.ok((await app.api.saveAgencyOffersAction('agency-a', value)).error);
  assert.equal(app.writes.length, 2);
  app.current = { broken: true };
  assert.ok((await app.api.saveAgencyOffersAction('agency-a', [offer])).error);
  assert.deepEqual(app.current, { broken: true });
  app.deny(); await assert.rejects(app.api.saveAgencyOffersAction('agency-a', [offer]), /denied/);
});
