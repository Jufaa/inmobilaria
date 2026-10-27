import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { zones } from '../lib/zones.ts';
import { defaultPresentationSettings } from '../lib/agency-presentation.ts';

const require = createRequire(import.meta.url);
const transpile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(item => nodes(item, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}

test('CityMap accepts an overview without changing legacy defaults and keeps explicit zone camera transitions', () => {
  const priorToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'pk.test';
  const code = transpile('../components/CityMap.tsx');
  const effects = [], effectDeps = [], effectCleanups = [], slots = [];
  let cursor = 0, props, tree;
  const fakeHost = { clientWidth: 1000, clientHeight: 700, style: {}, addEventListener() {}, removeEventListener() {} };
  const maps = [];
  const createdMarkers = [];
  class FakeMap {
    constructor(options) { this.options = options; this.handlers = new globalThis.Map(); this.sources = new globalThis.Map(); this.fitCalls = []; this.configCalls = []; maps.push(this); }
    on(name, layerOrHandler, handler) { const fn = handler ?? layerOrHandler; this.handlers.set(`${name}:${handler ? layerOrHandler : ''}`, fn); return this; }
    off() { return this; }
    emit(name) { this.handlers.get(`${name}:`)?.(); }
    addControl() {}
    getPitch() { return this.options.pitch; }
    getBearing() { return this.options.bearing; }
    getCanvas() { return { clientWidth: 1000, clientHeight: 700, style: {} }; }
    getSource(id) { return this.sources.get(id); }
    getLayer() { return true; }
    addSource(id, options) { this.sources.set(id, { ...options, setData(data) { this.data = data; }, getClusterExpansionZoom() {} }); }
    addLayer() {}
    setConfigProperty(...args) { this.configCalls.push(args); }
    setPaintProperty(...args) { this.paintCalls ??= []; this.paintCalls.push(args); }
    isSourceLoaded() { return true; }
    querySourceFeatures() { return []; }
    project() { return { x: 0, y: 0 }; }
    fitBounds(...args) { this.fitCalls.push(args); }
    resize() {}
    remove() {}
    getBounds() { return { getWest: () => 0, getEast: () => 1, getSouth: () => 0, getNorth: () => 1 }; }
    easeTo() {}
    flyTo() {}
    zoomIn() {}
    zoomOut() {}
  }
  class Marker { constructor(options) { this.options = options; this.element = options.element; this.removed = false; createdMarkers.push(this); } setLngLat(value) { this.coordinates = value; return this; } addTo() { if (!this.coordinates) throw Error('Mapbox markers need a position before addTo'); return this; } getLngLat() { return { lng: 0, lat: 0 }; } getElement() { return this.element; } remove() { this.removed = true; } }
  const mapbox = { Map: FakeMap, Marker, supported: () => true, AttributionControl: class {}, ScaleControl: class {}, LngLatBounds: class { extend() { return this; } } };
  const hooks = {
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: index === 0 ? fakeHost : initial }; },
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useEffect(callback, deps) { const index = cursor++; effects[index] = { callback, deps }; },
  };
  const exports = {};
  new Function('require', 'exports', code)(id => {
    if (id === 'react') return hooks;
    if (id === 'mapbox-gl') return mapbox;
    if (id === '@/lib/properties') return { formatPrice: value => String(value) };
    if (id.endsWith('.module.css') || id === 'lucide-react') return new Proxy({}, { get: () => () => null });
    return require(id);
  }, exports);
  const base = { properties: [], selected: null, onSelect() {}, visible: true, focusProperty: null, focusRevision: 0, areas: zones.slice(0, 1), zoneRevision: 1, onSearchArea() {} };
  const render = (next = props) => {
    props = next; cursor = 0; effects.length = 0; tree = exports.default(props);
    for (const [index, effect] of effects.entries()) {
      if (!effect) continue;
      const changed = !effectDeps[index] || !effect.deps || effect.deps.some((value, depIndex) => value !== effectDeps[index][depIndex]);
      if (changed) { effectCleanups[index]?.(); effectDeps[index] = effect.deps; effectCleanups[index] = effect.callback?.(); }
    }
    return tree;
  };
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.requestAnimationFrame = callback => { callback(); return 1; };
  globalThis.cancelAnimationFrame = () => {};
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  globalThis.document = { addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } }) };
  try {
    render(base);
    maps[0].emit('load');
    render(base);
    const legacy = maps[0].options;
    assert.deepEqual(legacy.center, [-64.3488, -33.1231]);
    assert.equal(legacy.zoom, 15.4);
    assert.equal(legacy.pitch, 45);
    assert.equal(maps[0].fitCalls.length, 1, 'legacy areas still auto-fit');
    slots[16] = 1; // Recreate the map as a retry would, with overview enabled at initialization.
    render({ ...base, overview: true });
    maps[1].emit('load');
    render({ ...base, overview: true });
    assert.deepEqual(maps[1].options.center, [-64.3488, -33.1231]);
    assert.equal(maps[1].options.zoom, 12.2);
    assert.equal(maps[1].options.pitch, 0);
    assert.equal(maps[1].fitCalls.length, 0, 'overview suppresses only its initial area fit');
    render({ ...base, overview: true, zoneRevision: 2 });
    assert.equal(maps[1].fitCalls.length, 1, 'a later explicit zone revision fits the selected area');
    const appearance = { ...defaultPresentationSettings.map, accentColor: '#aabbcc', landColor: '#112233', buildingColor: '#223344', waterColor: '#334455' };
    const point = { id: 'park', name: 'Plaza', latitude: -33.12, longitude: -64.35, color: '#008800' };
    const styled = { ...base, overview: true, zoneRevision: 2, appearance, pointsOfInterest: [point] };
    render(styled);
    assert.deepEqual(maps[1].configCalls.slice(-3), [['basemap', 'colorLand', '#112233'], ['basemap', 'colorBuildings', '#223344'], ['basemap', 'colorWater', '#334455']]);
    assert.equal(maps[1].paintCalls.some(call => call[0] === 'search-zone-outline' && call[2] === '#aabbcc'), true);
    assert.equal(createdMarkers.length, 1);
    assert.equal(createdMarkers[0].element.textContent, 'Plaza');
    assert.equal(createdMarkers[0].element.style.backgroundColor, '#008800');
    render(styled);
    assert.equal(createdMarkers.length, 1, 'stable point inputs do not duplicate markers');
    render({ ...styled, pointsOfInterest: [] });
    assert.equal(createdMarkers[0].removed, true, 'removed points clean up their map markers');
  } finally {
    globalThis.ResizeObserver = undefined;
    globalThis.requestAnimationFrame = undefined;
    globalThis.cancelAnimationFrame = undefined;
    delete globalThis.window;
    delete globalThis.document;
    if (priorToken === undefined) delete process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    else process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = priorToken;
  }
});

test('artwork map places zone buttons and POIs in geographic bounds and reports image failures honestly', () => {
  const code = transpile('../components/auth/PresentationArtworkMap.tsx');
  const exports = {};
  const hookSlots = [];
  let hookCursor = 0;
  new Function('require', 'exports', code)(id => {
    if (id === 'react') return { useState: initial => { const index = hookCursor++; if (!(index in hookSlots)) hookSlots[index] = initial; return [hookSlots[index], value => { hookSlots[index] = value; }]; } };
    if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    return require(id);
  }, exports);
  const appearance = { ...defaultPresentationSettings.map, mode: 'artwork', artworkUrl: '/maps/plan.png' };
  const point = { id: 'plaza', name: 'Plaza', latitude: zones[0].bounds.north, longitude: zones[0].bounds.west, color: '#ff0000' };
  const selected = [];
  const props = { appearance, areas: [zones[0]], pointsOfInterest: [point, { ...point, id: 'outside', name: 'Outside', latitude: 0, longitude: 0 }], onAreaSelect: id => selected.push(id) };
  const render = () => { hookCursor = 0; const tree = exports.PresentationArtworkMap(props); return { tree, html: renderToStaticMarkup(tree) }; };
  const stylePercent = value => Number.parseFloat(value);
  const expectPosition = (tree, imageRatio) => {
    const zone = nodes(tree, item => item.type === 'button')[0].props.style;
    const poi = nodes(tree, item => item.type === 'span' && item.props.role === 'img')[0].props.style;
    const frameRatio = ((appearance.bounds.east - appearance.bounds.west) * Math.cos((appearance.bounds.north + appearance.bounds.south) / 2 * Math.PI / 180)) / (appearance.bounds.north - appearance.bounds.south);
    const rawX = (zones[0].bounds.west - appearance.bounds.west) / (appearance.bounds.east - appearance.bounds.west) * 100;
    const rawY = (appearance.bounds.north - zones[0].bounds.north) / (appearance.bounds.north - appearance.bounds.south) * 100;
    const width = imageRatio > frameRatio ? 1 : imageRatio / frameRatio;
    const height = imageRatio < frameRatio ? 1 : frameRatio / imageRatio;
    const expectedX = (1 - width) / 2 * 100 + rawX * width;
    const expectedY = (1 - height) / 2 * 100 + rawY * height;
    assert.ok(Math.abs(stylePercent(zone.left) - expectedX) < 0.01, `zone x should be ${expectedX}%`);
    assert.ok(Math.abs(stylePercent(zone.top) - expectedY) < 0.01, `zone y should be ${expectedY}%`);
    assert.ok(Math.abs(stylePercent(poi.left) - expectedX) < 0.01, `POI x should be ${expectedX}%`);
    assert.ok(Math.abs(stylePercent(poi.top) - expectedY) < 0.01, `POI y should be ${expectedY}%`);
  };
  const first = render();
  const html = first.html;
  assert.match(html, /aspect-ratio:/);
  assert.match(readFileSync(new URL('../components/auth/presentation-artwork-map.module.css', import.meta.url), 'utf8'), /object-fit:\s*contain/);
  assert.match(html, /aria-label="Abrir zona Centro"/);
  assert.match(html, /left:35\.5/);
  assert.match(html, /top:44\.13/);
  assert.match(html, /Plaza/);
  assert.doesNotMatch(html, /Outside/);
  assert.match(html, /La alineación depende de que el plano coincida con estos límites geográficos/);
  nodes(first.tree, item => item.type === 'button')[0].props.onClick();
  assert.deepEqual(selected, ['centro']);
  nodes(first.tree, item => item.type === 'img')[0].props.onLoad({ currentTarget: { naturalWidth: 200, naturalHeight: 100 } });
  let loaded = render();
  expectPosition(loaded.tree, 2);
  nodes(loaded.tree, item => item.type === 'img')[0].props.onLoad({ currentTarget: { naturalWidth: 100, naturalHeight: 200 } });
  loaded = render();
  expectPosition(loaded.tree, 0.5);
  nodes(loaded.tree, item => item.type === 'img')[0].props.onError();
  assert.match(render().html, /No se pudo cargar el plano personalizado/);
  const missing = renderToStaticMarkup(createElement(exports.PresentationArtworkMap, { appearance: { ...appearance, artworkUrl: '' }, areas: [], pointsOfInterest: [], onAreaSelect() {} }));
  assert.match(missing, /No hay un plano personalizado disponible/);
});

test('Google aerial POIs are labeled separately from fictional clickable properties and clean up their nonproperty markers', async () => {
  const code = transpile('../components/GoogleAerialArea.tsx');
  const exports = {};
  new Function('require', 'exports', code)(id => {
    if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (id === '@/lib/property-aerial-demo') return { aerialCameraForBounds: () => ({ center: {}, range: 1 }) };
    if (id === '@/lib/google-maps-3d') return { loadGoogleMaps3D: () => Promise.reject(Error()) };
    return require(id);
  }, exports);
  const area = { label: 'Centro', zone: { bounds: zones[0].bounds }, properties: [{ id: 'p1', title: 'Fictional home', latitude: -33.12, longitude: -64.35 }] };
  const aerialPoints = [{ id: 'park', name: 'Plaza', latitude: -33.12, longitude: -64.35, color: '#008800' }, { id: 'outside', name: 'Outside', latitude: 0, longitude: 0, color: '#0000ff' }];
  const html = renderToStaticMarkup(createElement(exports.GoogleAerialArea, { area, onSelect() {}, onClose() {}, onEdit() {}, appearance: defaultPresentationSettings.map, pointsOfInterest: aerialPoints }));
  assert.match(html, /Plaza/);
  assert.match(html, /Puntos de interés/);
  assert.match(html, /Fictional home/);
  assert.doesNotMatch(html, /Outside/);
  assert.match(html, /propiedades ficticias/);

  const listeners = [], maps = [], selected = [], effectCallbacks = [], slots = [];
  const container = { append(element) { this.mapElement = element; } };
  class Map3D {
    constructor(options) { this.options = options; this.style = {}; this.children = []; this.handlers = new globalThis.Map(); maps.push(this); }
    addEventListener(name, callback) { this.handlers.set(name, callback); }
    removeEventListener(name, callback) { if (this.handlers.get(name) === callback) this.handlers.delete(name); }
    append(marker) { this.children.push(marker); }
    replaceChildren() { this.children = []; }
    remove() { this.removed = true; }
  }
  class Marker3D {
    constructor(options) { this.options = options; this.style = {}; this.attributes = {}; this.handlers = new globalThis.Map(); this.removed = false; this.removedListeners = []; listeners.push(this); }
    addEventListener(name, callback) { this.handlers.set(name, callback); }
    removeEventListener(name, callback) { this.removedListeners.push(name); if (this.handlers.get(name) === callback) this.handlers.delete(name); }
    setAttribute(name, value) { this.attributes[name] = value; }
    remove() { this.removed = true; }
  }
  const library = { Map3DElement: Map3D, Marker3DInteractiveElement: Marker3D };
  const hooks = {
    useRef(initial) { const index = effectCallbacks.cursor++; return slots[index] ??= { current: index === 0 ? container : initial }; },
    useState(initial) { const index = effectCallbacks.cursor++; return [slots[index] ??= initial, value => { slots[index] = value; }]; },
    useMemo(callback) { effectCallbacks.cursor++; return callback(); },
    useEffect(callback) { effectCallbacks.push(callback); },
  };
  effectCallbacks.cursor = 0;
  const activeExports = {};
  new Function('require', 'exports', code)(id => {
    if (id === 'react') return hooks;
    if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (id === '@/lib/property-aerial-demo') return { aerialCameraForBounds: () => ({ center: {}, range: 1 }) };
    if (id === '@/lib/google-maps-3d') return { loadGoogleMaps3D: async () => library };
    return require(id);
  }, activeExports);
  const originalWindow = globalThis.window;
  globalThis.window = {};
  try {
    effectCallbacks.cursor = 0;
    activeExports.GoogleAerialArea({ area, onSelect: id => selected.push(id), onClose() {}, onEdit() {}, pointsOfInterest: aerialPoints });
    const mapCleanup = effectCallbacks[0]();
    await new Promise(resolve => setImmediate(resolve));
    const map = maps[0];
    map.handlers.get('gmp-steadychange')?.({ isSteady: true });
    const poiCleanup = effectCallbacks[1]();
    assert.equal(map.children.length, 2);
    const propertyMarker = map.children[0], poiMarker = map.children[1];
    assert.equal(propertyMarker.options.label.includes('Fictional home'), true);
    propertyMarker.handlers.get('gmp-click')?.({ stopPropagation() {} });
    poiMarker.handlers.get('gmp-click')?.({ stopPropagation() {}, preventDefault() {} });
    assert.deepEqual(selected, ['p1'], 'only a property marker starts the property tour');
    assert.equal(poiMarker.options.label, 'PUNTO DE INTERÉS · Plaza');
    assert.equal(poiMarker.style.color, '#008800');
    assert.equal(poiMarker.attributes['aria-label'], 'Punto de interés, sin acción: Plaza');
    poiCleanup();
    assert.equal(poiMarker.removed, true);
    assert.equal(poiMarker.removedListeners.includes('gmp-click'), true);
    mapCleanup();
  } finally {
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  }
});
