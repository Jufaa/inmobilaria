import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { buildDemoAreas, aerialCameraForBounds } from '../lib/property-aerial-demo.ts';
import { defaultDemoConfig } from '../lib/property-tour-config.ts';
import * as panelColors from '../lib/panel-colors.ts';

const require = createRequire(import.meta.url);
const code = ts.transpileModule(readFileSync(new URL('../components/GoogleAerialArea.tsx', import.meta.url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;

function harness(input = {}) {
  const slots = [], effects = [], deps = [], cleanups = []; let cursor = 0;
  const maps = [], markers = [], pins = [], loads = [];
  class Element {
    constructor(options) { this.options = options; this.style = {}; this.attributes = {}; this.listeners = new Map(); this.children = []; this.removed = false; }
    addEventListener(name, callback) { const callbacks = this.listeners.get(name) ?? new Set(); callbacks.add(callback); this.listeners.set(name, callbacks); }
    removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
    emit(name, extra = {}) { const event = { prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...extra }; [...(this.listeners.get(name) ?? [])].forEach(callback => callback(event)); return event; }
    append(child) { this.children.push(child); }
    replaceChildren() { this.children = []; }
    remove() { this.removed = true; }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
  }
  class MapElement extends Element { constructor(options) { super(options); maps.push(this); } }
  class MarkerElement extends Element { constructor(options) { super(options); markers.push(this); } }
  class PinElement extends Element { constructor(options) { super(options); pins.push(this); } }
  const host = new Element({});
  const library = { Map3DElement: MapElement, Marker3DInteractiveElement: MarkerElement, PinElement };
  const exports = {};
  new Function('require', 'exports', code)(id => {
    if (id === 'react') return {
      useRef(initial) { const index = cursor++; return slots[index] ??= { current: index === 0 ? host : initial }; },
      useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
      useMemo(callback, dependencies) { const index = cursor++; const current = slots[index]; if (!current || dependencies.some((value, position) => value !== current.dependencies[position])) slots[index] = { value: callback(), dependencies }; return slots[index].value; },
      useEffect(callback, dependencies) { const index = cursor++; effects[index] = { callback, dependencies }; },
    };
    if (id === '@/lib/google-maps-3d') return { loadGoogleMaps3D() { loads.push(true); return Promise.resolve(library); } };
    if (id === '@/lib/property-aerial-demo') return { aerialCameraForBounds };
    if (id === '@/lib/panel-colors') return panelColors;
    if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    return require(id);
  }, exports);
  const callbacks = { example: [], point: [], real: [], picks: [] };
  let props = { area: buildDemoAreas(defaultDemoConfig)[0], onSelect: id => callbacks.example.push(id), onClose() {}, onEdit() {}, onPointSelect: id => callbacks.point.push(id), onCatalogueSelect: id => callbacks.real.push(id), ...input };
  function render(change) {
    if (change) props = { ...props, ...change };
    cursor = 0; effects.length = 0;
    const tree = exports.GoogleAerialArea(props);
    for (const [index, effect] of effects.entries()) {
      if (!effect) continue;
      if (!deps[index] || effect.dependencies.some((value, position) => value !== deps[index][position])) {
        cleanups[index]?.(); deps[index] = effect.dependencies; cleanups[index] = effect.callback();
      }
    }
    return tree;
  }
  async function ready() { render(); await Promise.resolve(); render(); maps.at(-1).emit('gmp-steadychange', { isSteady: true }); render(); }
  return { render, ready, maps, markers, pins, loads, callbacks, close() { cleanups.forEach(cleanup => cleanup?.()); } };
}

test('aerial picking forwards validated geographic positions and uses latest callbacks without recreating maps', async () => {
  const picks = [], replacement = [];
  const app = harness({ onMapPick: position => picks.push(position) });
  try {
    await app.ready(); const map = app.maps[0];
    map.emit('gmp-click'); map.emit('gmp-click', { position: undefined });
    map.emit('gmp-click', { position: { lat: NaN, lng: -64 } });
    map.emit('gmp-click', { position: { lat: 91, lng: -64 } });
    map.emit('gmp-click', { position: { lat: -33, lng: -181 } });
    map.emit('gmp-click', { position: { lat: '-33.12', lng: '-64.35' } });
    assert.deepEqual(picks, []);
    assert.equal(map.emit('gmp-click', { position: { lat: -33.12, lng: -64.35 } }).prevented, true, 'placement suppresses native place UI');
    assert.deepEqual(picks, [[-64.35, -33.12]]);
    app.render({ onMapPick: position => replacement.push(position) });
    assert.equal(app.maps.length, 1); assert.equal(app.loads.length, 1);
    map.emit('gmp-click', { position: { lat: -33.13, lng: -64.36 } });
    assert.deepEqual(replacement, [[-64.36, -33.13]]);
    app.render({ onMapPick: undefined });
    map.emit('gmp-click', { position: { lat: -33.14, lng: -64.37 } });
    assert.equal(replacement.length, 1); assert.equal(app.maps.length, 1);
  } finally { app.close(); }
});

test('real catalogue, examples and editable references remain separate; placement on existing markers uses their coordinates', async () => {
  const real = { id: 'real-a', title: 'Inmueble real', latitude: -33.12, longitude: -64.35, price: 100, currency: 'USD' };
  const point = { id: 'reference-a', name: 'Escuela', latitude: -33.121, longitude: -64.351, color: '#112233' };
  const app = harness({ catalogueProperties: [real], pointsOfInterest: [point] });
  try {
    await app.ready();
    const realMarker = app.markers.find(marker => marker.options.label?.includes('Inmueble real'));
    const reference = app.markers.find(marker => marker.options.label?.includes('PUNTO DE INTERÉS'));
    const example = app.markers.find(marker => !marker.options.label?.includes('Inmueble real') && !marker.options.label?.includes('PUNTO DE INTERÉS'));
    assert.ok(realMarker); assert.ok(reference); assert.ok(example);
    assert.equal(realMarker.emit('gmp-click').stopped, true);
    reference.emit('gmp-click'); example.emit('gmp-click');
    assert.deepEqual(app.callbacks.real, ['real-a']); assert.deepEqual(app.callbacks.point, ['reference-a']); assert.equal(app.callbacks.example.length, 1);
    assert.equal(reference.attributes.role, 'button'); assert.equal(reference.attributes.tabindex, '0');
    reference.emit('keydown', { key: 'Enter' }); assert.equal(app.callbacks.point.length, 2);
    const picks = [];
    app.render({ onMapPick: position => picks.push(position) });
    realMarker.emit('gmp-click'); example.emit('gmp-click'); reference.emit('gmp-click');
    assert.equal(picks.length, 3); assert.deepEqual(picks[0], [real.longitude, real.latitude]);
    assert.deepEqual(picks[2], [point.longitude, point.latitude]);
    assert.equal(app.callbacks.real.length, 1); assert.equal(app.callbacks.example.length, 1); assert.equal(app.callbacks.point.length, 2);
    assert.equal(app.maps.length, 1);
    app.render({ onMapPick: undefined, onPointSelect: undefined });
    const informational = app.markers.findLast(marker => marker.options.label?.includes('PUNTO DE INTERÉS'));
    assert.equal(informational.attributes.tabindex, '-1'); assert.match(informational.attributes['aria-label'], /sin acción/);
    assert.equal(informational.attributes.role, undefined);
  } finally { app.close(); }
});

test('disposed SDK callbacks do not select, place or affect replacement maps', async () => {
  const picks = [];
  const app = harness({ onMapPick: position => picks.push(position), catalogueProperties: [{ id: 'a', title: 'Real', latitude: -33.12, longitude: -64.35, price: 1, currency: 'USD' }] });
  try {
    await app.ready(); const oldMap = app.maps[0];
    const lateMapClick = [...(oldMap.listeners.get('gmp-click') ?? [])][0];
    const oldMarker = app.markers.at(-1); const lateMarkerClick = [...oldMarker.listeners.get('gmp-click')][0];
    app.render({ area: buildDemoAreas(defaultDemoConfig)[1] }); await Promise.resolve(); app.render();
    const event = { position: { lat: -33.12, lng: -64.35 }, stopPropagation() {}, preventDefault() {} };
    lateMapClick(event); lateMarkerClick(event);
    assert.deepEqual(picks, []); assert.equal(oldMap.removed, true); assert.equal(app.maps.length, 2);
    app.close();
    const currentMap = app.maps.at(-1); currentMap.emit('gmp-click', event);
    assert.deepEqual(picks, []);
  } finally { app.close(); }
});

test('property types color the actual Google PinElement fill, not only marker text', async () => {
  const app = harness({ clean: true, preferences: { kindColors: { Departamento: '#2233aa', Casa: '#22aa33', Dúplex: '#aa22aa' } }, catalogueProperties: [{ id: 'real', title: 'Casa real', latitude: -33.12, longitude: -64.35, price: 1, currency: 'USD', color: '#aabbcc' }] });
  try {
    await app.ready();
    const example = app.markers.find(marker => !marker.removed && marker.options.label?.startsWith('01'));
    const real = app.markers.find(marker => !marker.removed && marker.options.label === 'Casa real');
    assert.ok(example.children[0] instanceof Object);
    assert.equal(example.children[0].options.background, '#2233aa');
    assert.equal(real.children[0].options.background, '#aabbcc');
    for (const pin of app.pins) {
      assert.match(pin.options.background, /^#[a-f0-9]{6}$/i);
      assert.match(pin.options.borderColor, /^#[a-f0-9]{6}$/i);
      assert.match(pin.options.glyphColor, /^#[a-f0-9]{6}$/i);
    }
    app.render({ catalogueProperties: [{ id: 'invalid', title: 'Seguro', latitude: -33.12, longitude: -64.35, price: 1, currency: 'USD', color: 'url(javascript:bad)' }] });
    const invalid = app.markers.findLast(marker => marker.options.label === 'Seguro');
    assert.match(invalid.children[0].options.background, /^#[a-f0-9]{6}$/i);
  } finally { app.close(); }
});

test('canonical references remain informational while only custom reference IDs are editable', async () => {
  const point = { id:'catalogue-reference', name:'Referencia de Barrios', latitude:-33.121, longitude:-64.351, color:'#123456' };
  const custom = { ...point, id:'custom-reference', name:'Mi chincheta' };
  const app=harness({pointsOfInterest:[point,custom],editablePointIds:[custom.id]});
  try {
    await app.ready();
    const canonical=app.markers.find(marker=>marker.options.label?.includes('Referencia de Barrios'));
    const editable=app.markers.find(marker=>marker.options.label?.includes('Mi chincheta'));
    assert.equal(canonical.attributes.tabindex,'-1');assert.equal(canonical.attributes.role,undefined);assert.match(canonical.attributes['aria-label'],/sin acción/);
    canonical.emit('gmp-click');canonical.emit('keydown',{key:'Enter'});assert.deepEqual(app.callbacks.point,[]);
    editable.emit('gmp-click');assert.deepEqual(app.callbacks.point,[custom.id]);assert.equal(editable.attributes.tabindex,'0');
    const picks=[];app.render({onMapPick:position=>picks.push(position)});
    canonical.emit('gmp-click');assert.deepEqual(picks,[[point.longitude,point.latitude]],'informational reference can still supply placement coordinates');
    app.render({onMapPick:undefined});assert.equal(canonical.attributes.tabindex,'-1');assert.equal(app.maps.length,1);
  } finally {app.close();}
});
