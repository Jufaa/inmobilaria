import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as panelColors from '../lib/panel-colors.ts';
import { buildDemoAreas, aerialCameraForBounds } from '../lib/property-aerial-demo.ts';
import { defaultDemoConfig } from '../lib/property-tour-config.ts';

const source = readFileSync(new URL('../components/GoogleAerialArea.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const require = createRequire(import.meta.url);
let sdkLoads = 0;
const exports = {};
new Function('require', 'exports', compiled)((id) => {
  if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
  if (id === '@/lib/panel-colors') return panelColors;
  if (id === '@/lib/property-aerial-demo') return { aerialCameraForBounds };
  if (id === '@/lib/google-maps-3d') return { loadGoogleMaps3D: () => { sdkLoads++; throw Error('SSR must not request Google'); } };
  return require(id);
}, exports);

test('the aerial zone presents six direct property options rather than a video carousel and never loads Google during SSR', () => {
  for (const area of buildDemoAreas(defaultDemoConfig)) {
    const noop = () => {};
    const html = renderToStaticMarkup(createElement(exports.GoogleAerialArea, { area, onSelect: noop, onClose: noop, onEdit: noop }));
    assert.equal((html.match(/aria-label="Entrar a /g) ?? []).length, 6);
    for (const property of area.properties) assert.ok(html.includes(`aria-label="Entrar a ${property.title}"`));
    assert.ok(!html.includes('<video'));
    assert.ok(html.includes('Cargando la vista aérea de Google'));
    assert.ok(html.includes('Rotar vista aérea'));
    assert.ok(html.includes('Centrar zona'));
    assert.ok(html.includes('Los videos de muestra se reutilizan'));
  }
  assert.equal(sdkLoads, 0);
});

test('clean aerial presentation hides ordinary prices and only highlights explicit offers', () => {
  const area = structuredClone(buildDemoAreas(defaultDemoConfig)[0]);
  area.properties[0].price = 'USD 111.111';
  area.properties[1].price = 'USD 222.222';
  area.properties[1].offer = true;
  const props = { area, clean: true, onSelect() {}, onClose() {}, onEdit() {} };
  const html = renderToStaticMarkup(createElement(exports.GoogleAerialArea, props));
  assert.ok(!html.includes('USD 111.111'));
  assert.ok(html.includes('Oferta · '));
  assert.ok(html.includes('USD 222.222'));
  const legacy = renderToStaticMarkup(createElement(exports.GoogleAerialArea, { ...props, clean: false }));
  assert.ok(legacy.includes('USD 111.111'), 'legacy consumers retain their prices');
});

test('real catalogue and zone-management slots remain separate from fictional tours and hide prices unless requested', () => {
  const area = { ...buildDemoAreas(defaultDemoConfig)[0], properties: [] };
  const real = { id: 'real-a', title: 'Casa real seleccionable', latitude: -33.12, longitude: -64.35, price: 123456, currency: 'USD' };
  const props = {
    area, clean: true, onSelect() {}, onClose() {}, onEdit() {}, onMapPick() {}, catalogueProperties: [real],
    managementControls: createElement('button', { type: 'button' }, 'Agregar inmueble'),
    managementPanel: createElement('form', null, createElement('button', { type: 'submit' }, 'Guardar inmueble')),
    zoneNavigation: createElement('select', { 'aria-label': 'Cambiar zona' }, createElement('option', null, 'Centro')),
  };
  const html = renderToStaticMarkup(createElement(exports.GoogleAerialArea, props));
  assert.ok(html.includes('Agregar inmueble')); assert.ok(html.includes('Guardar inmueble')); assert.ok(html.includes('Cambiar zona'));
  assert.ok(html.includes('Casa real seleccionable'));
  assert.ok(!html.includes('123.456'));
  assert.ok(!html.includes('propiedades ficticias'));
  assert.ok(!html.includes('Toque el mapa para elegir la ubicación.'), 'parent controls already supply placement instructions');
  const visible = renderToStaticMarkup(createElement(exports.GoogleAerialArea, { ...props, catalogueProperties: [{ ...real, showPrice: true }] }));
  assert.ok(visible.includes('123.456'));
});

test('public aerial view hides editing and offers remain an optional overlay', () => {
 const area = buildDemoAreas(defaultDemoConfig)[0];
 const html = renderToStaticMarkup(createElement(exports.GoogleAerialArea, {area,onSelect(){},onClose(){},floatingContent:createElement('span',null,'Oferta especial')}));
 assert.ok(!html.includes('Personalizar')); assert.ok(html.includes('Oferta especial'));
});

test('workspace aerial view removes the legacy property menu and keeps filters with results below header actions', () => {
  const area = buildDemoAreas(defaultDemoConfig)[0];
  const props = { area, clean: true, onSelect() {}, onClose() {}, onEdit() {},
    searchControls: createElement('details', null, createElement('summary', null, 'Filtros')),
    managementControls: createElement('button', null, 'Agregar propiedad'),
  };
  const initial = renderToStaticMarkup(createElement(exports.GoogleAerialArea, props));
  assert.ok(!initial.includes('<footer'));
  assert.ok(!initial.includes('Ver opciones'));
  assert.ok(initial.includes('aerialWorkspaceLayout'));
  assert.ok(initial.includes('aerialHeaderActions'));
  const filtered = renderToStaticMarkup(createElement(exports.GoogleAerialArea, {
    ...props, searchResults: createElement('section', { 'aria-label': 'Resultados' }, 'Casa encontrada'),
  }));
  assert.match(filtered, /class="aerialSearchDock"[^]*Filtros[^]*aerialSearchResults[^]*Casa encontrada/);
});

test('legacy mobile positioning targets only the aerial title, not the action group', () => {
  const css = readFileSync(new URL('../components/aerial-experience.module.css', import.meta.url), 'utf8');
  assert.match(css, /\.aerialHeader > \.aerialTitle\s*\{\s*position: absolute; top: 63px; left: 12px/);
  assert.doesNotMatch(css, /\.aerialHeader > div\s*\{\s*position: absolute/);
  const html = renderToStaticMarkup(createElement(exports.GoogleAerialArea, {
    area: buildDemoAreas(defaultDemoConfig)[0], onSelect() {}, onClose() {}, onEdit() {},
  }));
  assert.match(html, /class="aerialTitle"/);
  assert.match(html, /class="aerialHeaderActions"/);
});
