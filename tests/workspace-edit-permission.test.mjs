import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function load(path, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(read(path), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  new Function('require', 'exports', code)(id => mocks[id] ?? (id.endsWith('.module.css') ? { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) } : require(id)), exports);
  return exports;
}
const permission = () => load('components/auth/WorkspaceEditPermission.tsx');

test('editing defaults to denied and only the explicit global permission enables mutation fields', () => {
  const { WorkspaceEditPermissionProvider, EditableForm, useWorkspaceEditPermission } = permission();
  function Content() {
    const canEdit = useWorkspaceEditPermission();
    return React.createElement('div', { 'data-can-edit': canEdit },
      React.createElement('button', { type: 'button' }, 'Navigate'),
      React.createElement(EditableForm, { id: 'mutation' }, React.createElement('input', { name: 'title', defaultValue: 'Existing' }), React.createElement('button', { type: 'submit' }, 'Save')));
  }
  const render = canEdit => renderToStaticMarkup(canEdit === undefined ? React.createElement(Content) : React.createElement(WorkspaceEditPermissionProvider, { canEdit }, React.createElement(Content)));
  for (const html of [render(), render(false)]) {
    assert.match(html, /<fieldset[^>]*disabled=""/);
    assert.match(html, /Solo lectura/);
    assert.match(html, /<button type="button">Navigate<\/button>/);
  }
  assert.doesNotMatch(render(true), /disabled=""|Solo lectura/);
});

test('shell passes only its explicit permission, independently of membership administration visibility', () => {
  function Boundary() {}
  function Tabs() {}
  const { WorkspaceShell } = load('components/auth/WorkspaceShell.tsx', {
    './MapWorkspaceLayout': { MapWorkspaceLayout: 'map-layout' },
    './WorkspaceEditPermission': { WorkspaceEditPermissionProvider: Boundary },
    './PanelBrandTheme': { PanelBrandTheme: 'brand' }, './AgencySectionTabs': { AgencySectionTabs: Tabs },
    './GoogleSignOut': { GoogleSignOut: 'sign-out' }, '@/components/theme/ThemeToggle': { ThemeToggle: 'theme' },
    'next/link': { __esModule: true, default: 'a' },
  });
  const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
  for (const canEdit of [undefined, false, true]) {
    const tree = WorkspaceShell({ agencyName: 'Agency', agencySlug: 'agency', activeSection: 'map', canManageCollaboration: true, canManageRentals: true, canEdit, children: 'Content' });
    assert.equal(nodes(tree).find(node => node.type === Boundary).props.canEdit, canEdit === true);
    assert.equal(nodes(tree).find(node => node.type === Tabs).props.canEdit, canEdit === true);
  }
});

test('role navigation hides administration from agencies and retains all administrator panels', () => {
  const { AgencySectionTabs } = load('components/auth/AgencySectionTabs.tsx', { 'next/link': { __esModule: true, default: 'a' } });
  const render = canEdit => renderToStaticMarkup(React.createElement(AgencySectionTabs, { panelPath: '/panel', activeSection: 'map', canManageCollaboration: true, canManageRentals: true, canManageBasic:canEdit, canEdit }));
  for (const canEdit of [undefined, false]) {
    const html = render(canEdit);
    assert.doesNotMatch(html, /href="\/panel\/ofertas"/);
    assert.doesNotMatch(html, /href="\/panel\/alquileres"/);
    assert.doesNotMatch(html, /href="\/panel\/colaboracion"/);
    assert.match(html, /href="\/panel\/propiedades"/);
  }
  assert.match(render(true), /href="\/panel\/ofertas"/);
  assert.match(render(true), /href="\/panel\/alquileres"/);
  assert.match(render(true), /href="\/panel\/colaboracion"/);
});

test('all mutation managers use the permission form without replacing navigation or print controls', () => {
  for (const name of ['PropertyManager', 'InquiryManager', 'RentalManager', 'ZoneManager', 'AgencyCollaborationManager']) {
    const source = read(`components/auth/${name}.tsx`);
    assert.match(source, /<EditableForm\b/);
    assert.doesNotMatch(source, /<form\b/);
  }
  assert.match(read('components/auth/PropertyManager.tsx'), /canEdit && <button/);
  assert.match(read('components/auth/RentalManager.tsx'), /onClick=\{\(\) => window\.print\(\)\}/);
  for (const route of ['propiedades', 'consultas', 'analiticas', 'zonas', 'colaboracion', 'alquileres']) {
    const source = read(`app/inmobiliaria/[agencyId]/panel/${route}/page.tsx`);
    assert.match(source, /\{ user, membership, canEdit(?:,[^}]+)? \}/);
    assert.match(source, /canEdit=\{canEdit\}/);
  }
});

test('rendered catalogue mutation controls are disabled for readers without hiding records', () => {
  const api = permission();
  const action = async () => ({});
  const actions = new Proxy({}, { get: () => action });
  const { PropertyManager } = load('components/auth/PropertyManager.tsx', {
    react: { ...React, useActionState: () => [{}, undefined, false] },
    './WorkspaceEditPermission': api,
    './Property360Upload':{Property360Upload:()=>null},
    './PropertyContactForm':{PropertyContactForm:props=>React.createElement('form',{'data-contact-property':props.propertyId})},
    '@/app/inmobiliaria/[agencyId]/panel/actions': actions,
  });
  const property = { id: 'existing', title: 'Existing real listing', type: 'HOUSE', operation: 'SALE', status: 'DRAFT', price: 10, currency: 'USD', neighborhood: 'Centro', address: 'Street', area: 50, bedrooms: 1, bathrooms: 1, features: [] };
  const render = (canEdit,canManagePropertyContact=false) => renderToStaticMarkup(React.createElement(api.WorkspaceEditPermissionProvider, { canEdit }, React.createElement(PropertyManager, { agencySlug: 'agency', properties: [property],canManagePropertyContact })));
  const readOnly = render(false);
  assert.match(readOnly, /Existing real listing/);
  assert.doesNotMatch(readOnly, /Editar ficha/);
  assert.equal((readOnly.match(/class="editableFields" disabled=""/g) ?? []).length, 2);
  const contactOnly=render(false,true);assert.match(contactOnly,/data-contact-property="existing"/);assert.equal((contactOnly.match(/class="editableFields" disabled=""/g)??[]).length,2);
  const editable = render(true);
  assert.match(editable, /Editar ficha/);
  assert.doesNotMatch(editable, /class="editableFields" disabled=""/);
});

test('rendered read-only inquiry, zone, collaboration and rental forms retain their readable content and printing', () => {
  const api = permission();
  const actions = new Proxy({}, { get: () => async () => ({}) });
  const hooks = { ...React, useActionState: () => [{}, undefined, false] };
  const manager = (name, actionPath) => load(`components/auth/${name}.tsx`, {
    react: hooks, './WorkspaceEditPermission': api, [actionPath]: actions,
    '@/lib/zones/zone-constants': { pointOfInterestCategories: ['PARK', 'AVENUE', 'SCHOOL', 'SHOPPING', 'HOSPITAL', 'LANDMARK', 'OTHER'] },
  })[name];
  const cases = [
    [manager('InquiryManager', '@/app/inmobiliaria/[agencyId]/panel/consultas/actions'), { agencySlug: 'agency', inquiries: [{ id: 'q', contactName: 'Reader contact', contactEmail: 'reader@example.com', status: 'NEW', message: 'Existing inquiry', createdAt: '2026-01-01', property: { id: 'p', title: 'Real property', status: 'PUBLISHED' }, ownerAgency: { name: 'Owner' }, presentingAgency: { name: 'Agency' } }] }, 'Existing inquiry'],
    [manager('ZoneManager', '@/app/inmobiliaria/[agencyId]/panel/zonas/actions'), { slug: 'agency', zones: [], points: [], properties: [] }, 'Barrios'],
    [manager('AgencyCollaborationManager', '@/app/inmobiliaria/[agencyId]/panel/colaboracion/actions'), { agencyId: 'agency', agencySlug: 'agency', connections: [], ownedShares: [], receivedShares: [], publishedProperties: [], events: [] }, 'Colaboración'],
    [manager('RentalManager', '@/app/inmobiliaria/[agencyId]/panel/alquileres/actions'), { slug: 'agency', contacts: [], properties: [], charges: [], expenses: [], auditEvents: [], contracts: [{ id: 'contract', status: 'DRAFT', startDate: '2026-01-01', endDate: null, monthlyRent: '100', currency: 'USD', rentDueDay: 10, terms: 'Existing terms', property: { id: 'p', title: 'Real rental', neighborhood: 'Centro' }, landlord: { name: 'Owner' }, tenant: { name: 'Tenant' }, adjustments: [], charges: [] }] }, 'Real rental'],
  ];
  for (const [Component, props, expected] of cases) {
    const html = renderToStaticMarkup(React.createElement(api.WorkspaceEditPermissionProvider, { canEdit: false }, React.createElement(Component, props)));
    assert.ok(html.includes(expected), expected);
    assert.match(html, /class="editableFields" disabled=""/);
    if (expected === 'Real rental') assert.match(html, /<button type="button" class="printButton">Imprimir \/ guardar PDF<\/button>/);
  }
});
