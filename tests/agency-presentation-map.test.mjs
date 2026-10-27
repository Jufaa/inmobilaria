import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as presentationApi from '../lib/agency-presentation.ts';
import * as configApi from '../lib/property-tour-config.ts';
import { tourIdForMapProperty } from '../lib/property-tour-map.ts';
import { createPresentationArea } from '../lib/workspace-aerial-presentation.ts';

const require = createRequire(import.meta.url);
const code = ts.transpileModule(readFileSync(new URL('../components/auth/AgencyPresentationMap.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(item => nodes(item, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function AgencyPresentationSettings() {}
function harness(input = {}) {
  const slots = [], effects = [];
  let cursor = 0;
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useMemo(callback) { cursor++; return callback(); },
    useEffect(callback) { effects.push(callback); },
  };
  function CityMap() {}
  function WorkspaceAerialExperience() {}
  function TourDemoEditor() {}
  function PresentationVideo() {}
  function PresentationArtworkMap() {}
  const exports = {};
  new Function('require', 'exports', code)(id => {
    if (id === 'react') return hooks;
    if (id === 'next/dynamic') return { __esModule: true, default: () => CityMap };
    if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (id.endsWith('.css')) return {};
    if (id === '@/lib/property-tour-config') return configApi;
    if (id === '@/lib/property-tour-map') return { tourIdForMapProperty };
    if (id === '@/lib/agency-presentation') return presentationApi;
    if (id === './PresentationVideo') return { PresentationVideo };
    if (id === './AgencyPresentationSettings') return { AgencyPresentationSettings };
    if (id === './PresentationArtworkMap') return { PresentationArtworkMap };
    if (id === './WorkspaceAerialExperience') return { WorkspaceAerialExperience };
    if (id === '@/components/TourDemoEditor') return { TourDemoEditor };
    return require(id);
  }, exports);
  const props = { title: 'Mapa de agencia', agencyId: 'agency-a', agencyName: 'Agencia de prueba', properties: [], zones: [], points: [], ...input };
  const render = () => { cursor = 0; effects.length = 0; return exports.AgencyPresentationMap(props); };
  render(); for (const effect of [...effects]) effect();
  return { render, effects, video: () => nodes(render(), n => n.type === PresentationVideo)[0], map: () => nodes(render(), n => n.type === CityMap)[0], aerial: () => nodes(render(), n => n.type === WorkspaceAerialExperience)[0], editor: () => nodes(render(), n => n.type === TourDemoEditor)[0] };
}

const fastSettings = structuredClone(presentationApi.defaultPresentationSettings);
fastSettings.intro.enabled = false;
for (const zone of Object.values(fastSettings.zones)) zone.transitionEnabled = false;
function withStorage(callback, settings = fastSettings) {
  const original = globalThis.window;
  const data = new Map();
  globalThis.window = { addEventListener() {}, removeEventListener() {}, localStorage: { getItem: key => data.get(key) ?? (key === presentationApi.presentationStorageKey('agency-a') ? JSON.stringify(settings) : null), setItem: (key, value) => data.set(key, value) } };
  try { callback(data); } finally { if (original === undefined) delete globalThis.window; else globalThis.window = original; }
}

test('the initial presentation is the 3D overview; each square, marker and direct zone shortcut opens six aerial properties before any tour', () => withStorage(() => {
  const app = harness();
  const initial = app.render();
  const map = app.map();
  assert.equal(map.props.visible, true);
  assert.equal(map.props.controlsBlocked, false);
  assert.equal(map.props.zoneRevision, 1);
  assert.equal(map.props.areas.length, 2);
  assert.equal(app.aerial(), undefined);
  assert.equal(nodes(initial, n => n.type === 'video').length, 0);
  const nav = nodes(initial, n => n.props?.['aria-label'] === 'Zonas de la presentación')[0];
  const shortcuts = nodes(nav, n => n.type === 'button');
  assert.equal(shortcuts.length, 2);
  for (const [index, area] of map.props.areas.entries()) {
    for (const open of [() => map.props.onAreaSelect(area.id), () => map.props.onSelect(map.props.properties[index].id), () => shortcuts[index].props.onClick()]) {
      open();
      const aerial = app.aerial();
      assert.equal(aerial.props.zone.id, area.id);
      const presentation = createPresentationArea(aerial.props.zone, configApi.defaultDemoConfig);
      assert.equal(presentation.properties.length, 6);
      assert.deepEqual(presentation.zone.bounds, area.bounds);
      assert.equal(presentation.properties[0].tour.entranceVideo, configApi.defaultDemoConfig.properties[index].entranceVideo);
      assert.equal(app.map().type, map.type);
      assert.equal(app.map().props.visible, false);
      assert.equal(app.map().props.controlsBlocked, true);
      aerial.props.onClose();
      assert.equal(app.aerial(), undefined);
      assert.equal(app.map().props.visible, true);
      assert.equal(app.map().props.zoneRevision, 1, 'returning without edits must not refit the camera');
    }
  }
  map.props.onAreaSelect('unknown');
  map.props.onSelect(999);
  assert.equal(app.aerial(), undefined);
}));

test('presentation editing keeps validated local settings, rejects failed saves and refreshes zone coordinates on aerial return', () => withStorage(data => {
  const app = harness();
  const edit = nodes(app.render(), n => n.type === 'button' && n.props.className === 'edit')[0];
  edit.props.onClick();
  assert.equal(app.map().props.controlsBlocked, true);
  assert.equal(app.editor().props.onSave({ version: 3 }), 'Revisa los campos: se requieren dos propiedades, coordenadas válidas, videos MP4 e imágenes con URL pública HTTPS o de la demo.');
  assert.equal(data.size, 0);
  assert.equal(app.map().props.zoneRevision, 1);
  const edited = structuredClone(configApi.defaultDemoConfig);
  edited.properties[0].neighborhood = 'Zona personalizada';
  edited.properties[0].latitude += .01;
  assert.equal(app.editor().props.onSave(edited), null);
  assert.equal(data.size, 1);
  assert.equal(app.editor(), undefined);
  assert.equal(app.map().props.areas[0].label, 'Zona personalizada');
  assert.equal(app.map().props.zoneRevision, 2);
  app.map().props.onAreaSelect('centro');
  edited.properties[0].neighborhood = 'Actualizada desde la vista aérea';
  data.set(configApi.demoConfigKey, JSON.stringify(edited));
  app.aerial().props.onClose();
  assert.equal(app.map().props.areas[0].label, edited.properties[0].neighborhood);
  assert.equal(app.map().props.zoneRevision, 3);
  edit.props.onClick();
  globalThis.window.localStorage.setItem = () => { throw Error('storage denied'); };
  assert.ok(app.editor().props.onSave(configApi.defaultDemoConfig));
  assert.ok(app.editor(), 'failed persistence keeps the editor open');
  assert.equal(app.map().props.areas[0].label, edited.properties[0].neighborhood);
  assert.equal(app.map().props.zoneRevision, 3);
}));

test('known zone templates keep their own videos even when the local presentation order changes', () => {
  for (const config of [configApi.defaultDemoConfig, { ...configApi.defaultDemoConfig, properties: [...configApi.defaultDemoConfig.properties].reverse() }]) {
    const before = JSON.stringify(config);
    for (const template of config.properties) {
      const area = createPresentationArea({ id: template.id, name: template.neighborhood, latitude: template.latitude, longitude: template.longitude }, config);
      for (const property of area.properties) {
        assert.equal(property.tour.entranceVideo, template.entranceVideo);
        assert.equal(property.tour.interiorVideo, template.interiorVideo);
      }
    }
    assert.equal(JSON.stringify(config), before);
  }
});

test('opening the aerial scene receives the saved agency tour templates and their persistence action', () => withStorage(() => {
  const initialDemoConfig = structuredClone(configApi.defaultDemoConfig);
  const persistDemoConfig = async value => ({ config: value, error: null });
  const app = harness({ initialDemoConfig, persistDemoConfig });
  app.map().props.onAreaSelect('centro');
  const aerial = app.aerial();
  assert.equal(aerial.props.initialConfig, initialDemoConfig);
  assert.equal(aerial.props.persistDemoConfig, persistDemoConfig);
}));

test('reopening presentation settings uses the most recently saved server settings', () => withStorage(() => {
  const app = harness({ initialSettings: structuredClone(presentationApi.defaultPresentationSettings), persistSettings: async value => ({ settings: value, error: null }) });
  const edit = nodes(app.render(), n => n.type === 'button' && n.props.className === 'edit')[0];
  edit.props.onClick();
  const editor = nodes(app.render(), n => n.type === AgencyPresentationSettings)[0];
  const saved = structuredClone(presentationApi.defaultPresentationSettings);
  saved.map.accentColor = '#327755';
  editor.props.onSaved(saved);
  assert.equal(nodes(app.render(), n => n.type === AgencyPresentationSettings)[0].props.initialSettings.map.accentColor, '#327755');
}));


test('optional real intro and zone clips retain skip/back and stale completion protection when explicitly enabled', () => {
  const enabledSettings = structuredClone(presentationApi.defaultPresentationSettings);
  enabledSettings.intro.enabled = true;
  enabledSettings.zones.centro.transitionEnabled = true;
  enabledSettings.zones['banda-norte'].transitionEnabled = true;
  return withStorage(() => {
  const app = harness();
  assert.equal(app.map(), undefined, 'map SDK must not load before the institutional presentation');
  assert.ok(app.video().props.title.includes('Agencia de prueba'));
  app.video().props.onContinue();
  const originalMap = app.map();
  assert.equal(originalMap.props.overview, true);
  originalMap.props.onAreaSelect('centro');
  const cancelled = app.video();
  assert.equal(cancelled.props.src, presentationApi.defaultPresentationSettings.zones.centro.videoUrl);
  assert.equal(app.aerial(), undefined);
  cancelled.props.onBack();
  cancelled.props.onContinue();
  assert.equal(app.aerial(), undefined, 'a cancelled transition must not later enter its zone');
  originalMap.props.onAreaSelect('banda-norte');
  app.video().props.onContinue();
  assert.equal(app.aerial().props.zone.id, 'banda-norte');
  assert.equal(app.aerial().props.settings.properties['presentation-banda-norte-1'].droneEnabled, true);
  assert.equal(app.map().type, originalMap.type);
  app.aerial().props.onClose();
  assert.equal(app.map().props.visible, true);
  assert.equal(app.map().props.zoneRevision, originalMap.props.zoneRevision);
}, enabledSettings);
});


test('sample intro and zone clips are opt-in, while interactive zone selection animates the camera before opening aerial view', () => {
  assert.equal(presentationApi.defaultPresentationSettings.intro.enabled, false);
  assert.equal(presentationApi.defaultPresentationSettings.zones.centro.transitionEnabled, false);
  assert.equal(presentationApi.defaultPresentationSettings.zones['banda-norte'].transitionEnabled, false);
  const cityMap = readFileSync(new URL('../components/CityMap.tsx', import.meta.url), 'utf8');
  assert.match(cityMap, /map\.stop\(\);[\s\S]*map\.once\('moveend', finishAreaFocus\)/);
  assert.match(cityMap, /setTimeout\(finishAreaFocus, 1800\)/);
  assert.match(cityMap, /if \(focusingArea\) return/);
  assert.match(cityMap, /maxZoom: 16\.5[\s\S]*duration:[\s\S]*1200/);
});

test('shared presentation combines real shared markers and catalogue with the existing fictional tours', () => withStorage(() => {
  const real = { id: 'real-shared', title: 'Casa real compartida', status: 'PUBLISHED', price: 112000, currency: 'USD', neighborhood: 'Centro', latitude: -33.124, longitude: -64.34, ownerAgency: 'Inmobiliaria real' };
  const app = harness({ sharedCatalogue: true, properties: [real, { ...real, id: 'unlocated', title: 'Sin coordenadas', latitude: null }] });
  const demos = configApi.mapPropertiesForConfig(configApi.defaultDemoConfig);
  assert.equal(app.map().props.properties.length, demos.length + 1);
  assert.deepEqual(app.map().props.properties.filter(p => p.id > 0), demos);
  const marker = app.map().props.properties.find(p => p.id < 0);
  assert.equal(marker.latitude, real.latitude);
  assert.equal(marker.longitude, real.longitude);
  assert.equal(marker.price, real.price);
  assert.equal(marker.currency, real.currency);
  const catalogue = nodes(app.render(), n => n.props?.['aria-label'] === 'Propiedades reales compartidas')[0];
  assert.ok(catalogue);
  assert.match(JSON.stringify(catalogue), /Inmobiliaria real/);
  assert.match(JSON.stringify(catalogue), /Sin coordenadas/);
  app.map().props.onSelect(marker.id);
  assert.equal(app.aerial(), undefined, 'real records must never open a fictional tour');
  assert.equal(app.map().props.selected, marker.id);
  assert.equal(app.map().props.focusProperty.latitude, real.latitude);
  assert.match(JSON.stringify(app.render()), /PUBLISHED/);
  app.map().props.onSelect(demos[0].id);
  assert.ok(app.aerial(), 'fictional markers must retain their existing tours');
}));

test('shared presentation retains examples when no real properties have been shared', () => withStorage(() => {
  const app = harness({ sharedCatalogue: true });
  assert.deepEqual(app.map().props.properties, configApi.mapPropertiesForConfig(configApi.defaultDemoConfig));
  assert.match(JSON.stringify(app.render()), /No hay propiedades reales compartidas/);
}));
