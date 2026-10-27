import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const property = { id: 'shared-a', title: 'Casa compartida', status: 'PUBLISHED', price: 123000, currency: 'ARS', neighborhood: 'Centro', latitude: -33.123, longitude: -64.345, ownerAgency: 'Agencia A' };
test('shared page retains accepted connections, published active grants, coordinate rounding and access guard', async () => {
  const code = ts.transpileModule(readFileSync(new URL('../app/compartido/page.tsx', import.meta.url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  let query; let owner = true; let calls = 0; const exports = {};
  function AgencyPresentationMap() {}
  function ThemeToggle() {}
  new Function('require', 'exports', code)(id => {
    if (id === '@/components/theme/ThemeToggle') return { ThemeToggle };
    if (id === '@/components/auth/AgencyPresentationMap') return { AgencyPresentationMap };
    if (id === '@/lib/agency-presentation') return { defaultPresentationSettings: { map: {} } };
    if (id === '@/lib/property-tour-config') return { defaultDemoConfig: {} };
    if (id === '@/lib/agency-access') return { getCurrentUserMemberships: async () => ({ user: { email: 'owner@example.com' }, isPlatformOwner: owner }) };
    if (id === '@/lib/prisma') return { prisma: { agencyConnection: { findMany: async value => { query = value; calls++; return [{ id: 'connection', agencyLow: { name: 'A' }, agencyHigh: { name: 'B' }, shareGrants: [{ property: { ...property, price: { toNumber: () => property.price }, latitude: { toNumber: () => -33.12345 }, longitude: { toNumber: () => -64.34567 } }, ownerAgency: { name: property.ownerAgency } }] }]; } } } };
    if (id === 'next/navigation') return { redirect: () => { throw new Error('redirect'); } };
    if (id === 'next/link') return { __esModule: true, default: () => null };
    if (id === '@/components/auth/GoogleSignOut') return { GoogleSignOut: () => null };
    if (id.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    return require(id);
  }, exports);
  const page = await exports.default();
  assert.equal(nodes(page).filter(n => n.type === ThemeToggle).length, 1, 'Shared must expose the same theme switch as the agency panel');
  assert.ok(nodes(page).some(n => n.type === 'div' && n.props.className?.split(' ').includes('cards') && n.props.className.split(' ').includes('content')), 'Map list must reuse the panel responsive content width');
  assert.deepEqual(query.where, { status: 'ACCEPTED' });
  assert.deepEqual(query.include.shareGrants.where, { active: true, revokedAt: null, property: { status: 'PUBLISHED' } });
  const map = nodes(page).find(n => n.type === AgencyPresentationMap);
  assert.ok(map, 'Shared must render the exact agency panel presentation component');
  assert.equal(map.props.agencyId, 'shared-connection');
  assert.equal(map.props.sharedCatalogue, true, 'Real shared catalogue must be enabled alongside demo tours');
  assert.deepEqual(map.props.zones, []);
  assert.deepEqual(map.props.points, []);
  assert.equal(map.props.properties[0].ownerAgency, property.ownerAgency);
  assert.equal(map.props.properties[0].latitude, -33.123);
  assert.equal(map.props.properties[0].longitude, -64.346);
  owner = false;
  await assert.rejects(exports.default(), /redirect/);
  assert.equal(calls, 1);
});

test('shared page styles do not override typography inside the reused presentation', () => {
  const css = readFileSync(new URL('../app/compartido/shared.module.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /\.card\s+(?:p|h2)\s*\{/);
  assert.doesNotMatch(css, /\.header\s*\{[^}]*width:/);
});
