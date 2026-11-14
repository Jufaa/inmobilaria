import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as mapApi from '../lib/zone-map.ts';
import * as explorerApi from '../lib/presentation-explorer.ts';
import * as configApi from '../lib/property-tour-config.ts';
import * as listingsApi from '../lib/presentation-listings.ts';
import { defaultPresentationSettings, parsePresentationSettings } from '../lib/agency-presentation.ts';
const require = createRequire(import.meta.url);
const all = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(all) : [tree, ...all(tree.props?.children)];
function surface() {
  const slots = []; let cursor = 0;
  const code = ts.transpileModule(readFileSync(new URL('../components/auth/ZoneImageMap.tsx', import.meta.url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function('require', 'exports', code)(id => {
    if (id === 'react') return { useRef: value => { const i = cursor++; return slots[i] ??= { current: value }; }, useState: value => { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = next; }]; } };
    if (id === '@/lib/zone-map') return mapApi;
    if (id.endsWith('.css')) return { default: {} };
    return require(id);
  }, exports);
  return props => { cursor = 0; return exports.ZoneImageMap(props); };
}
const map = { mode: 'illustrated', imageUrl: 'https://example.com/plan.webp', bounds: { west: -65, east: -64, south: -34, north: -33 }, pins: [{ source: 'real', propertyId: 'house', x: .2, y: .4 }, { source: 'example', propertyId: 'tour', x: .5, y: .5 }] };
const targets = [{ source: 'real', propertyId: 'house', title: 'Casa', latitude: null, longitude: null }, { source: 'example', propertyId: 'tour', title: 'Recorrido', latitude: -33.5, longitude: -64.5 }];
test('image map routes linked properties and tours without depending on GPS', () => {
  const render = surface(), selected = [];
  const tree = render({ map, targets, onSelect: target => selected.push(mapApi.pinKey(target)) });
  const buttons = all(tree).filter(node => node.type === 'button');
  assert.equal(buttons.length, 2);
  buttons.forEach(button => button.props.onClick({ stopPropagation() {} }));
  assert.deepEqual(selected, ['real:house', 'example:tour']);
});
test('manual drag, cancellation and keyboard movement update plan positions only', () => {
  const render = surface(), moved = [], placed = [];
  const before = structuredClone(targets);
  const props = { map, targets, onSelect() {}, onMove: (target, point) => moved.push({ key: mapApi.pinKey(target), ...point }), onPlace: point => placed.push(point) };
  const viewport = { left: 100, top: 50, width: 400, height: 200 };
  const parent = { getBoundingClientRect: () => viewport };
  const button = () => all(render(props)).find(node => node.type === 'button');
  const target = { parentElement: parent, setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {} };
  const event = (x, y) => ({ button: 0, pointerId: 1, clientX: x, clientY: y, currentTarget: target, stopPropagation() {}, preventDefault() {} });
  button().props.onPointerDown(event(180, 130));
  button().props.onPointerMove(event(400, 100));
  button().props.onPointerCancel(event(400, 100));
  assert.equal(moved.length, 0, 'cancel does not save the drag');
  button().props.onPointerDown(event(180, 130));
  button().props.onPointerMove(event(400, 100));
  button().props.onPointerUp(event(400, 100));
  assert.deepEqual(moved[0], { key: 'real:house', x: .75, y: .25 });
  button().props.onKeyDown({ key: 'ArrowRight', preventDefault() {}, stopPropagation() {} });
  assert.equal(moved[1].key, 'real:house');
  assert.ok(Math.abs(moved[1].x - .21) < 1e-10);
  assert.equal(moved[1].y, .4);
  const imageSurface = all(render(props)).find(node => node.props?.['data-zone-image-surface']);
  imageSurface.props.onClick({ clientX: 300, clientY: 150, currentTarget: { querySelector: () => ({ naturalWidth: 800, getBoundingClientRect: () => viewport }) } });
  assert.deepEqual(placed, [{ x: .5, y: .5 }]);
  assert.deepEqual(targets, before, 'catalogue GPS and target identities never mutate');
});

test('admin links and moves real properties on a per-zone draft, with no catalogue mutation', () => {
  let settings = structuredClone(defaultPresentationSettings), cursor = 0;
  const slots = [], records = [{ id: 'house', title: 'Casa', latitude: null, longitude: null }];
  const before = structuredClone(records);
  const code = ts.transpileModule(readFileSync(new URL('../components/auth/ZoneMapSettings.tsx', import.meta.url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function('require', 'exports', code)(id => {
    if (id === 'react') return { useEffect() {}, useRef: value => { const i = cursor++; return slots[i] ??= { current: value }; }, useState: value => { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = next; }]; } };
    if (id === '@/lib/zone-map') return mapApi;
    if (id === '@/lib/presentation-explorer') return explorerApi;
    if (id === '@/lib/property-tour-config') return configApi;
    if (id === '@/lib/presentation-listings') return listingsApi;
    if (id === './ZoneImageMap') return { ZoneImageMap: 'image-map' };
    if (id.endsWith('.css')) return { default: {} };
    return require(id);
  }, exports);
  const render = () => { cursor = 0; return exports.ZoneMapSettings({ settings, config: configApi.defaultDemoConfig, records, onChange: maps => { settings = { ...settings, zoneMaps: maps }; } }); };
  const text = tree => tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : Array.isArray(tree) ? tree.map(text).join('') : text(tree.props?.children);
  const select = label => all(render()).find(node => node.type === 'label' && text(node).startsWith(label)).props.children.find(node => node?.type === 'select');
  const zoneId = select('Zona a configurar').props.value;
  select('Tipo de mapa interno').props.onChange({ target: { value: 'illustrated' } });
  all(render()).find(node => node.type === 'input' && node.props.value === '').props.onChange({ target: { value: 'https://example.com/plan.webp' } });
  select('Propiedad para ubicar').props.onChange({ target: { value: 'real:house' } });
  let image = all(render()).find(node => node.type === 'image-map');
  image.props.onPlace({ x: .3, y: .7 });
  image = all(render()).find(node => node.type === 'image-map');
  image.props.onMove(image.props.targets.find(target => target.propertyId === 'house'), { x: .8, y: .4 });
  assert.deepEqual(settings.zoneMaps[zoneId].pins, [{ source: 'real', propertyId: 'house', x: .8, y: .4 }]);
  assert.ok(parsePresentationSettings(settings));
  select('Tipo de mapa interno').props.onChange({ target: { value: 'geographic' } });
  assert.equal(settings.zoneMaps[zoneId].pins.length, 1, 'switching modes retains manual links');
  assert.deepEqual(records, before);
  const Reader = globalThis.FileReader;
  let pending;
  globalThis.FileReader = class { constructor() { pending = this; } readAsDataURL() {} };
  try {
    const file = all(render()).find(node => node.type === 'input' && node.props.type === 'file');
    file.props.onChange({ target: { files: [{ type: 'image/png', size: 10 }], value: 'file' } });
    const otherZone = configApi.zonesForConfig(configApi.defaultDemoConfig).find(zone => zone.id !== zoneId).id;
    select('Zona a configurar').props.onChange({ target: { value: otherZone } });
    pending.result = 'data:image/png;base64,YQ=='; pending.onload();
    assert.equal(settings.zoneMaps[otherZone], undefined, 'late uploads cannot change a different selected zone');
    assert.equal(select('Tipo de mapa interno').props.value, 'google');
  } finally { if (Reader === undefined) delete globalThis.FileReader; else globalThis.FileReader = Reader; }
});
