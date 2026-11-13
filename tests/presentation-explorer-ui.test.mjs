import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as explorer from '../lib/presentation-explorer.ts';
import * as configApi from '../lib/property-tour-config.ts';
import * as areaApi from '../lib/workspace-aerial-presentation.ts';
import * as listingsApi from '../lib/presentation-listings.ts';
import * as rectangleApi from '../lib/map-rectangle-selection.ts';
import { defaultPresentationSettings, parsePresentationSettings } from '../lib/agency-presentation.ts';

const require = createRequire(import.meta.url);
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : tree.type?.name === 'MockPanelColorPicker' ? nodes(tree.type(tree.props)) : [tree, ...nodes(tree.props?.children)];
const text = tree => tree == null || typeof tree === 'boolean' ? '' : typeof tree === 'string' || typeof tree === 'number' ? String(tree) : Array.isArray(tree) ? tree.map(text).join(' ') : text(tree.props?.children);
function load(name, hooks = {}) {
  const source = readFileSync(new URL(`../components/auth/${name}.tsx`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const exports = {};
  new Function('require', 'exports', code)(id => {
    if (id === 'react') return hooks;
    if (id === 'next/dynamic') return { __esModule: true, default: () => function EditorCityMap() {} };
    if (id === '@/lib/presentation-explorer') return explorer;
    if (id === '@/lib/property-tour-config') return configApi;
    if (id === '@/lib/workspace-aerial-presentation') return areaApi;
    if (id === '@/lib/presentation-listings') return listingsApi;
    if (id === '@/lib/map-rectangle-selection') return rectangleApi;
    if (id === './PanelColorPicker') return { PanelColorPicker: function MockPanelColorPicker({ label, value, onChange }) { return { type: 'label', props: { children: [label, { type: 'input', props: { value, onChange: event => onChange(event.target.value) } }] } }; } };
    if (id === './PresentationZoneEditor') return { PresentationZoneEditor: () => null };
    if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    return require(id);
  }, exports);
  return exports[name];
}
test('simple admin exposes appearance, zone, filter, offer and garage settings through controlled changes', () => {
  const Component = load('PresentationExplorerSettings');
  let settings = structuredClone(defaultPresentationSettings);
  const render = () => ['simple', 'advanced'].map(mode => Component({ settings, mode, onChange: value => { settings = { ...settings, explorer: value }; } }));
  const label = name => nodes(render()).find(node => node.type === 'label' && text(node).replace(/\s+/g, ' ').trim().startsWith(name));
  const field = name => nodes(label(name)).find(node => ['input', 'select'].includes(node.type));
  field('Nombre visible del mapa').props.onChange({ target: { value: 'Agencia personalizada' } });
  assert.equal(settings.explorer.name, 'Agencia personalizada');
  field('Color de Lote').props.onChange({ target: { value: '#887744' } });
  assert.equal(settings.explorer.kindColors.Lote, '#887744');
  field('Precio y moneda').props.onChange({ target: { checked: false } });
  assert.equal(settings.explorer.filters.price, false);
  field('Destacar como oferta').props.onChange({ target: { checked: true } });
  const first = Object.values(settings.explorer.listings)[0];
  assert.equal(first.offer, true);
  const garageLabel = nodes(render()).find(node => node.type === 'label' && text(node).trim().startsWith('Cochera') && nodes(node).some(child => child.type === 'select'));
  nodes(garageLabel).find(node => node.type === 'select').props.onChange({ target: { value: 'no' } });
  assert.equal(Object.values(settings.explorer.listings)[0].garage, false);
  const simple = Component({ settings, onChange() {} });
  assert.equal(nodes(simple).some(node => node.type === 'summary' && text(node) === 'Filtros disponibles para el visitante'), false, 'technical controls are not part of the simple view');
});

test('visitor filters emit selected criteria and admin-hidden filters do not remain active', () => {
  const Component = load('PresentationFilters');
  let value = {};
  const settings = structuredClone(explorer.defaultExplorerSettings);
  const render = () => Component({ value, settings, zones: [], onChange: next => { value = next; } });
  const garage = nodes(render()).find(node => node.type === 'label' && text(node).startsWith('Cochera'));
  nodes(garage).find(node => node.type === 'select').props.onChange({ target: { value: 'yes' } });
  assert.equal(value.garage, 'yes');
  settings.filters.garage = false;
  assert.equal(nodes(render()).some(node => node.type === 'label' && text(node).startsWith('Cochera')), false);
  assert.equal(explorer.enabledPresentationFilters(value, settings).garage, undefined);
  nodes(render()).find(node => node.type === 'button').props.onClick();
  assert.deepEqual(value, {});
});

function artworkSurface(viewport = { left: 100, top: 200, width: 400, height: 300 }) {
  return { getBoundingClientRect: () => ({ left: viewport.left - 20, top: viewport.top - 20, width: viewport.width + 40, height: viewport.height + 40 }), querySelector: () => ({ naturalWidth: viewport.width, naturalHeight: viewport.height, getBoundingClientRect: () => viewport }), setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {} };
}

test('zone crop is added only after dragging and release, supports reverse drag, and preserves redraw until commit', () => {
  for (const reverse of [false, true]) {
    const slots = []; let cursor = 0;
    const Component = load('PresentationZoneEditor', { useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], next => { slots[index] = next; }]; }, useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; }, useEffect() {} });
    let zones = [];
    const appearance = { ...defaultPresentationSettings.map, mode: 'artwork', artworkUrl: '/maps/test.png', bounds: { west: 0, east: 10, south: 0, north: 10 } };
    const render = () => { cursor = 0; return Component({ zones, appearance, onChange: value => { zones = value; } }); };
    const click = name => nodes(render()).find(node => node.type === 'button' && text(node) === name).props.onClick();
    const surface = artworkSurface();
    const pointer = (handler, point) => nodes(render()).find(node => node.props?.['aria-label'] === 'Mapa de edición').props[handler]({ pointerId: 1, button: 0, isPrimary: true, clientX: point[0], clientY: point[1], currentTarget: surface, preventDefault() {}, stopPropagation() {} });
    const start = reverse ? [380, 440] : [140, 230]; const end = reverse ? [140, 230] : [380, 440];
    click('Agregar zona'); assert.equal(zones.length, 0, 'arming cannot create a full-map draft');
    assert.equal(nodes(render()).some(node => node.type === 'span' && text(node) === '+'), false, 'no misleading centered starting point');
    pointer('onPointerDown', start); assert.equal(zones.length, 0);
    pointer('onPointerMove', end); assert.equal(zones.length, 0);
    const preview = nodes(render()).find(node => node.props?.className === 'cropPreview');
    assert.deepEqual(preview.props.style, { left: 60, top: 50, width: 240, height: 210 });
    pointer('onPointerUp', end); assert.equal(zones.length, 1);
    assert.deepEqual(zones[0].bounds, { west: 1, east: 7, south: 2, north: 9 });
    const label = nodes(render()).find(node => node.type === 'label' && text(node).startsWith('Nombre de zona'));
    nodes(label).find(node => node.type === 'input').props.onChange({ target: { value: 'Zona nueva' } });
    const before = JSON.stringify(zones);
    click('Marcar límites sobre el plano'); pointer('onPointerDown', start); pointer('onPointerMove', end);
    assert.equal(JSON.stringify(zones), before, 'redraw keeps the previous saved bounds during preview');
    click('Cancelar'); assert.equal(JSON.stringify(zones), before);
    click('Quitar zona del borrador'); assert.deepEqual(zones, []);
  }
});

test('zone crop cancels without adding on Escape, tiny drags and outside-image pointer positions', () => {
  const slots = []; let cursor = 0; let zones = [];
  const Component = load('PresentationZoneEditor', { useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], next => { slots[index] = next; }]; }, useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; }, useEffect() {} });
  const appearance = { ...defaultPresentationSettings.map, mode: 'artwork', artworkUrl: '/maps/test.png' };
  const render = () => { cursor = 0; return Component({ zones, appearance, onChange: value => { zones = value; } }); };
  const click = name => nodes(render()).find(node => node.type === 'button' && text(node) === name).props.onClick();
  const surface = artworkSurface();
  const pointer = (handler, x, y) => nodes(render()).find(node => node.props?.['aria-label'] === 'Mapa de edición').props[handler]({ pointerId: 1, button: 0, isPrimary: true, clientX: x, clientY: y, currentTarget: surface, preventDefault() {}, stopPropagation() {} });
  click('Agregar zona'); pointer('onPointerDown', 99, 210); pointer('onPointerUp', 300, 400); assert.equal(zones.length, 0);
  pointer('onPointerDown', 140, 230); pointer('onPointerUp', 142, 232); assert.equal(zones.length, 0);
  pointer('onPointerDown', 140, 230); pointer('onPointerMove', 350, 430);
  const group = nodes(render()).find(node => node.props?.['aria-label'] === 'Mapa de edición');
  group.props.onKeyDown({ key: 'Enter', target: surface, currentTarget: surface, preventDefault() {} }); assert.equal(zones.length, 0, 'keyboard activation cannot invent a centered crop');
  group.props.onKeyDown({ key: 'Escape', target: surface, currentTarget: surface, preventDefault() {} }); assert.equal(zones.length, 0);
});

test('pin placement is armed by a button, uses the next map click once, and remains editable', () => {
  const slots = []; let cursor = 0;
  const Component = load('PresentationZoneEditor', { useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], next => { slots[index] = next; }]; }, useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; }, useEffect() {} });
  let points = [];
  const appearance = { ...defaultPresentationSettings.map, mode: 'artwork', artworkUrl: '/maps/test.png', bounds: { west: 0, east: 10, south: 0, north: 10 } };
  const render = () => { cursor = 0; return Component({ zones: [], appearance, points, onChange() {}, onPointsChange: next => { points = next; } }); };
  const click = name => nodes(render()).find(node => node.type === 'button' && text(node) === name).props.onClick();
  const mark = () => nodes(render()).find(node => node.props?.['data-picking'] === true).props.onClick({ clientX: 25, clientY: 75, currentTarget: artworkSurface({ left: 0, top: 0, width: 100, height: 100 }) });
  assert.equal(points.length, 0);
  click('Agregar chincheta'); mark();
  assert.equal(points.length, 1);
  assert.equal(points[0].longitude, 2.5); assert.equal(points[0].latitude, 2.5);
  assert.ok(points[0].name, 'a new pin can be saved immediately without completing a form');
  assert.ok(parsePresentationSettings({ ...defaultPresentationSettings, points }), 'a click creates a valid persistable draft');
  assert.equal(nodes(render()).some(node => node.props?.['data-picking'] === true), false, 'one-shot placement disarms after one click');
  const name = nodes(render()).find(node => node.type === 'input' && node.props['aria-label'] === 'Nombre de chincheta');
  name.props.onChange({ target: { value: 'Escuela' } }); assert.equal(points[0].name, 'Escuela');
  click('Quitar chincheta'); assert.equal(points.length, 0);
  click('Agregar chincheta'); click('Cancelar');
  assert.equal(points.length, 0);
});

test('interactive map placement uses actual viewport positions and keyboard focuses the native map', () => {
  const slots = []; let cursor = 0;
  const Component = load('PresentationZoneEditor', { useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], next => { slots[index] = next; }]; }, useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; }, useEffect() {} });
  let points = [];
  const render = () => { cursor = 0; return Component({ zones: [], appearance: defaultPresentationSettings.map, points, onChange() {}, onPointsChange: next => { points = next; } }); };
  const click = name => nodes(render()).find(node => node.type === 'button' && text(node) === name).props.onClick();
  click('Agregar chincheta');
  const map = nodes(render()).find(node => typeof node.type === 'function' && node.type.name === 'EditorCityMap');
  map.props.onMapPick([-64.36, -33.12]);
  assert.equal(points[0].longitude, -64.36); assert.equal(points[0].latitude, -33.12);
  assert.equal(nodes(render()).find(node => typeof node.type === 'function' && node.type.name === 'EditorCityMap').props.onMapPick, undefined);
  click('Agregar chincheta');
  const canvas = nodes(render()).find(node => node.props?.['aria-label'] === 'Mapa de edición');
  let focused = 0;
  const target = { querySelector: () => ({ focus() { focused++; } }) };
  canvas.props.onKeyDown({ key: 'Enter', target, currentTarget: target, preventDefault() {} });
  assert.equal(points.length, 1, 'the wrapper cannot invent a global-bounds center on a panned map');
  assert.equal(focused, 1);
  assert.ok(parsePresentationSettings({ ...defaultPresentationSettings, points }));
});

test('selecting a zone opens a compact editor inside the map and Done closes it without submitting', () => {
  const slots = []; let cursor = 0;
  const Component = load('PresentationZoneEditor', { useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], next => { slots[index] = next; }]; }, useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; }, useEffect() {} });
  const zone = { id: 'one', name: 'Mi zona', bounds: { west: -64.4, east: -64.3, south: -33.2, north: -33.1 }, color: '#225588', enabled: true, videoUrl: '', duration: 4 };
  const render = () => { cursor = 0; return Component({ zones: [zone], appearance: defaultPresentationSettings.map, points: [], onChange() {}, onPointsChange() {} }); };
  let tree = render();
  assert.equal(nodes(tree).some(node => node.props?.['aria-label'] === 'Editar zona seleccionada'), false);
  nodes(tree).find(node => typeof node.type === 'function' && node.type.name === 'EditorCityMap').props.onAreaSelect('one');
  tree = render();
  const canvas = nodes(tree).find(node => node.props?.['aria-label'] === 'Mapa de edición');
  const panel = nodes(canvas).find(node => node.props?.['aria-label'] === 'Editar zona seleccionada');
  assert.ok(panel, 'selection controls must be inside the map, not another form below it');
  const done = nodes(panel).find(node => node.type === 'button' && text(node) === 'Listo');
  assert.equal(done.props.type, 'button'); done.props.onClick();
  assert.equal(nodes(render()).some(node => node.props?.['aria-label'] === 'Editar zona seleccionada'), false);
});


test('interactive zone tool receives geographic crop release rather than two city-bound clicks', () => {
 const slots = []; let cursor = 0; let zones = [];
 const Component = load('PresentationZoneEditor', { useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], next => { slots[index] = next; }]; }, useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; }, useEffect() {} });
 const render = () => { cursor = 0; return Component({ zones, appearance: defaultPresentationSettings.map, onChange: value => { zones = value; } }); };
 const map = () => nodes(render()).find(node => typeof node.type === 'function' && node.type.name === 'EditorCityMap');
 nodes(render()).find(node => node.type === 'button' && text(node) === 'Agregar zona').props.onClick();
 assert.equal(zones.length, 0); assert.equal(map().props.onMapPick, undefined);
 map().props.onRectangleSelect({ west: -64.38, east: -64.37, south: -33.12, north: -33.11 });
 assert.equal(zones.length, 1); assert.deepEqual(zones[0].bounds, { west: -64.38, east: -64.37, south: -33.12, north: -33.11 });
 assert.equal(map().props.onRectangleSelect, undefined);
});
