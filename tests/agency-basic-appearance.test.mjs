import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { defaultPresentationSettings } from '../lib/agency-presentation.ts';
import { defaultExplorerSettings,effectivePropertyKindColors } from '../lib/presentation-explorer.ts';
const require = createRequire(import.meta.url);
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const text = tree => typeof tree === 'string' ? tree : !tree || typeof tree !== 'object' ? '' : Array.isArray(tree) ? tree.map(text).join('') : text(tree.props?.children);
function load(path, mocks) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'exports', code)(id => mocks[id] ?? (id.endsWith('.module.css') ? { __esModule: true, default: {} } : require(id)), exports);
  return exports;
}
test('basic appearance exposes supported colors only, previews brand color and separates saves', async () => {
  const slots = [], writes = [], previews = []; let cursor = 0;
  const { AgencyBasicAppearance } = load('components/auth/AgencyBasicAppearance.tsx', {
    react: { useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = value; }]; } },
    '@/lib/presentation-explorer': { defaultExplorerSettings,effectivePropertyKindColors },
    './PanelColorPicker': { PanelColorPicker: 'picker' },
    './PanelBrandTheme': { previewPanelBrandColor: (...args) => previews.push(args) },
  });
  const props = { agencySlug: 'agency-a', brandPrimaryColor: '#123456', initialSettings: defaultPresentationSettings,
    onSaveBrand: async form => { writes.push(['brand', form.get('brandPrimaryColor')]); return { color: '#abcdef', error: null }; },
    onSaveAppearance: async value => { writes.push(['appearance', value]); return { settings: defaultPresentationSettings, error: null }; } };
  const render = () => { cursor = 0; return AgencyBasicAppearance(props); };
  const pickers = nodes(render()).filter(node => node.type === 'picker');
  assert.equal(pickers.length, 10);
  assert.ok(pickers.some(node => node.props.label === 'Color de PH'));
  pickers[0].props.onChange('#abcdef');
  assert.deepEqual(previews, [['agency-a', '#abcdef']]);
  const forms = nodes(render()).filter(node => node.type === 'form');
  await forms[0].props.onSubmit({ preventDefault() {} });
  await forms[1].props.onSubmit({ preventDefault() {} });
  assert.deepEqual(writes[0], ['brand', '#abcdef']);
  assert.deepEqual(Object.keys(writes[1][1]).sort(), ['kindColors', 'popupColor', 'popupTextColor']);
  assert.ok(!text(render()).includes('videoUrl'));
});
test('basic navigation does not grant global editing or show advanced neighborhoods', () => {
  const { AgencySectionTabs } = load('components/auth/AgencySectionTabs.tsx', { 'next/link': { __esModule: true, default: 'link' } });
  const render = flags => nodes(AgencySectionTabs({ panelPath: '/panel', activeSection: 'map', canManageCollaboration: false, canManageRentals: false, ...flags })).filter(node => node.type === 'link').map(text);
  const own = render({ canManageBasic: true });
  assert.ok(own.includes('Ofertas')); assert.ok(own.includes('Personalización')); assert.ok(!own.includes('Barrios'));
  const viewer = render({}); assert.ok(!viewer.includes('Ofertas')); assert.ok(!viewer.includes('Personalización'));
  assert.ok(render({ canEdit: true, canManageBasic: true }).includes('Barrios'));
});
test('personalization branches on global permission while offers use the scoped guard and actual canEdit', async () => {
  let canEdit = false;
  const context = () => ({ user: { email: 'owner@example.test' }, membership: { agency: { id: 'canonical-a', name: 'Agency A', brandPrimaryColor: '#123456' } }, canEdit, canManageBasic: true });
  const mocks = {
    '@/lib/agency-access': { requireAgencyCollaborationAccess: async () => context(), requireAgencyBasicEditAccess: async () => context() },
    '@/lib/prisma': { prisma: { agencyPresentationConfig: { findUnique: async () => null } } },
    '@/lib/properties/agency-property-service': { listAgencyProperties: async () => [] },
    '@/lib/agency-presentation': { defaultPresentationSettings, parsePresentationSettings: () => null, withAgencyFictionalIntro: value => value },
    '@/lib/property-tour-config': { defaultDemoConfig: {}, parseDemoConfig: () => null },
    '@/lib/agency-offer-targets': { agencyOfferTargets: () => [] },
    '@/components/auth/WorkspaceShell': { WorkspaceShell: 'shell' },
    '@/components/auth/PersonalizationPanels': { PersonalizationPanels: 'advanced' },
    '@/components/auth/AgencyBasicAppearance': { AgencyBasicAppearance: 'basic' },
    '@/components/auth/AgencyPresentationSettings': { AgencyPresentationSettings: 'presentation' },
    '@/components/auth/AgencyOffersManager': { AgencyOffersManager: 'offers' },
    '@/components/auth/RealAgencyMap': { RealAgencyMap: 'map' },
    './BrandingForm': { BrandingForm: 'branding' },
    './basic-actions': { saveAgencyBasicAppearanceAction() {}, saveAgencyBasicBrandColorAction() {} },
    './presentation-actions': { savePresentationSettingsAction() {} },
    './actions': { saveAgencyOffersAction() {} },
    '../actions': { createMapPropertyAction() {}, updateMapPropertyAction() {} },
  };
  const personalization = load('app/inmobiliaria/[agencyId]/panel/personalizacion/page.tsx', mocks).default;
  const props = { params: Promise.resolve({ agencyId: 'agency-a' }) };
  let tree = await personalization(props);
  assert.equal(tree.props.canEdit, false); assert.equal(tree.props.canManageBasic, true);
  assert.equal(nodes(tree).filter(node => node.type === 'basic').length, 1);
  assert.equal(nodes(tree).filter(node => node.type === 'advanced').length, 0);
  canEdit = true;
  tree = await personalization(props);
  assert.equal(nodes(tree).filter(node => node.type === 'advanced').length, 1);
  assert.equal(nodes(tree).filter(node => node.type === 'basic').length, 0);
  canEdit = false;
  const offers = await load('app/inmobiliaria/[agencyId]/panel/ofertas/page.tsx', mocks).default(props);
  assert.equal(offers.props.canEdit, false); assert.equal(offers.props.canManageBasic, true);
  assert.equal(nodes(offers).filter(node => node.type === 'offers').length, 1);
});
test('shell forwards basic navigation without widening the global permission provider', () => {
  const { WorkspaceShell } = load('components/auth/WorkspaceShell.tsx', {
    'next/link': { __esModule: true, default: 'link' },
    './GoogleSignOut': { GoogleSignOut: 'sign-out' },
    '@/components/theme/ThemeToggle': { ThemeToggle: 'theme-toggle' },
    './AgencySectionTabs': { AgencySectionTabs: 'tabs' },
    './PanelBrandTheme': { PanelBrandTheme: 'brand-theme' },
    './MapWorkspaceLayout': { MapWorkspaceLayout: 'map-layout' },
    './WorkspaceEditPermission': { WorkspaceEditPermissionProvider: 'global-permission' },
  });
  const props = { agencyName: 'Agency A', agencySlug: 'agency-a', activeSection: 'map', canManageCollaboration: true, canEdit: false, children: 'content' };
  const tree = WorkspaceShell(props);
  assert.equal(nodes(tree).find(node => node.type === 'tabs').props.canManageBasic, true);
  assert.equal(nodes(tree).find(node => node.type === 'global-permission').props.canEdit, false);
  const fullscreen = WorkspaceShell({ ...props, fullscreenMap: true });
  assert.equal(nodes(fullscreen).find(node => node.type === 'global-permission').props.canEdit, false);
  const layout = nodes(fullscreen).find(node => node.type === 'map-layout');
  assert.equal(layout.props.operation.props.canManageBasic, true);
  assert.equal(layout.props.administration,null);
  assert.ok(nodes(layout.props.operationFooter).some(node=>node.type==='sign-out'));
});
