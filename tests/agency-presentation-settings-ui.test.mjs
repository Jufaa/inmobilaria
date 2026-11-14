import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as presentationApi from '../lib/agency-presentation.ts';

const require = createRequire(import.meta.url);
const code = ts.transpileModule(readFileSync(new URL('../components/auth/AgencyPresentationSettings.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;

function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(item => nodes(item, predicate));
  if (typeof tree.type === 'function') return nodes(tree.type(tree.props), predicate);
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
function content(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  return Array.isArray(tree) ? tree.map(content).join(' ') : content(tree.props?.children);
}

function harness(initialAgency = 'agency-a', storage = new Map(), eventLog = []) {
  const slots = [], effectDeps = [], effectCleanups = [];
  let cursor = 0;
  const hooks = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(callback, deps) {
      const i = cursor++;
      if (effectDeps[i] === undefined || deps.some((value, index) => value !== effectDeps[i][index])) {
        effectCleanups[i]?.();
        effectDeps[i] = deps;
        effectCleanups[i] = callback();
      }
    },
  };
  const originalWindow = globalThis.window, originalEvent = globalThis.CustomEvent;
  globalThis.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  globalThis.window = {
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    dispatchEvent: event => { eventLog.push(event); return true; },
  };
  const exports = {};
  new Function('require', 'exports', code)(id => {
    if (id === 'react') return hooks;
    if (id === './WorkspaceEditPermission') return {EditableForm:'form'};
    if (id === './ExamplePropertyFields') return {ExamplePropertyFields:()=>null};
    if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (id === '@/lib/agency-presentation') return presentationApi;
    if (id === './PanelColorPicker') return { PanelColorPicker: ({ label, value, onChange }) => require('react/jsx-runtime').jsx('label', { children: [label, require('react/jsx-runtime').jsx('input', { type: 'color', 'aria-label': label, value, onChange: event => onChange(event.target.value) })] }) };
    if (id === './PresentationExplorerSettings') return { PresentationExplorerSettings: () => null };
    if (id === './PersonalizationPanels') return {
      presentationSections: [{ id: 'map', label: 'Mapa' }, { id: 'properties', label: 'Inmuebles' }, { id: 'appearance', label: 'Apariencia' }],
      PresentationPanelTabs: ({ sections, value, onChange }) => require('react/jsx-runtime').jsx('nav', { children: sections.map(section => require('react/jsx-runtime').jsx('button', { type: 'button', role: 'tab', 'aria-selected': value === section.id, onClick: () => onChange(section.id), children: section.label }, section.id)) }),
    };
    return require(id);
  }, exports);
  let props = { agencyId: initialAgency };
  const render = nextProps => {
    if (nextProps) props = nextProps;
    cursor = 0;
    exports.AgencyPresentationSettings(props);
    cursor = 0;
    return exports.AgencyPresentationSettings(props);
  };
  return {
    render, storage, eventLog,
    unmount() { effectCleanups.forEach(cleanup => cleanup?.()); if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow; if (originalEvent === undefined) delete globalThis.CustomEvent; else globalThis.CustomEvent = originalEvent; },
  };
}

test('settings editor exposes the institutional, zone, map artwork, POI and required property drone media with local-only notices', () => {
  const app = harness();
  try {
    const tree = app.render();
    const labels = nodes(tree, item => item.type === 'legend' || item.type === 'label').map(content);
    for (const expected of ['Video institucional', 'Modo de presentación del plano', 'URL de la imagen o ruta local', 'Longitud oeste', 'Longitud este', 'Latitud sur', 'Latitud norte', 'Color de acento', 'Color del terreno', 'Color de las construcciones', 'Color del agua', 'Transición', 'Video de dron']) {
      assert.ok(labels.some(label => label.toLocaleLowerCase().includes(expected.toLocaleLowerCase())), `missing accessible label: ${expected}`);
    }
    assert.ok(nodes(tree, item => item.type === 'select').length >= 1, 'map mode selector is present');
    assert.equal(nodes(tree, item => item.type === 'input' && item.props.type === 'checkbox').length, 3, 'only institutional and zone videos are optional');
    assert.equal(nodes(tree, item => item.type === 'input' && item.props.type === 'text').length, 16, 'URL del plano, intro, zonas y las doce propiedades disponibles');
    assert.match(content(tree), /navegador/i);
    assert.match(content(tree), /ficticios/i);
    assert.match(content(tree), /prepararse externamente/i);
    assert.equal(nodes(tree, item => item.type === 'input' && item.props.type === 'file').length, 1);
  } finally { app.unmount(); }
});

test('agency changes reload isolated settings; successful saves notify, while rejected saves do not mutate or notify', () => {
  const storage = new Map(), eventLog = [];
  const app = harness('agency-a', storage, eventLog);
  try {
    const savedA = structuredClone(presentationApi.defaultPresentationSettings);
    savedA.map.accentColor = '#117755';
    storage.set(presentationApi.presentationStorageKey('agency-a'), JSON.stringify(savedA));
    const treeA = app.render();
    assert.equal(nodes(treeA, item => item.type === 'input' && item.props['aria-label'] === 'Color de acento')[0].props.value, '#117755');
    const treeB = app.render({ agencyId: 'agency-b', onSaved: settings => eventLog.push({ type: 'saved', settings }) });
    assert.equal(nodes(treeB, item => item.type === 'input' && item.props['aria-label'] === 'Color de acento')[0].props.value, presentationApi.defaultPresentationSettings.map.accentColor);
    nodes(treeB, item => item.type === 'input' && item.props['aria-label'] === 'Color de acento')[0].props.onChange({ target: { value: '#22aa66' } });
    const button = label => nodes(app.render(), item => item.type === 'button' && content(item) === label)[0];
    button('Guardar cambios').props.onClick?.();
    const form = nodes(app.render(), item => item.type === 'form')[0];
    form.props.onSubmit({ preventDefault() {} });
    assert.equal(app.storage.get(presentationApi.presentationStorageKey('agency-b')) !== undefined, true);
    assert.equal(eventLog[0].type, 'territorio:presentation-updated');
    assert.equal(eventLog[0].detail.agencyId, 'agency-b');
    assert.equal(eventLog[1].type, 'saved');
    assert.equal(eventLog[1].settings.map.accentColor, '#22aa66');

    const before = JSON.stringify([...storage]);
    const originalSet = globalThis.window.localStorage.setItem;
    globalThis.window.localStorage.setItem = () => { throw Error('storage full'); };
    nodes(app.render(), item => item.type === 'input' && item.props['aria-label'] === 'Color de acento')[0].props.onChange({ target: { value: 'red' } });
    nodes(app.render(), item => item.type === 'form')[0].props.onSubmit({ preventDefault() {} });
    assert.equal(eventLog.length, 2);
    assert.equal(JSON.stringify([...storage]), before);
    assert.ok(nodes(app.render(), item => item.props?.role === 'alert').length);
    globalThis.window.localStorage.setItem = originalSet;
  } finally { app.unmount(); }
});

test('point editor supports add/remove and reset restores the loaded draft without persisting', () => {
  const storage = new Map(), app = harness('agency-a', storage);
  try {
    const click = label => nodes(app.render(), item => item.type === 'button' && content(item) === label)[0].props.onClick();
    click('Agregar punto de interés');
    assert.equal(nodes(app.render(), item => item.type === 'h3' && /Punto de interés\s+1/.test(content(item))).length, 1);
    const pointLabels = nodes(app.render(), item => item.type === 'label').map(content);
    for (const expected of ['Nombre del punto', 'Latitud del punto', 'Longitud del punto', 'Color del punto']) assert.ok(pointLabels.some(label => label.trim().startsWith(expected)), `missing accessible label: ${expected}`);
    click('Quitar punto');
    assert.equal(nodes(app.render(), item => item.type === 'h3' && /Punto de interés\s+1/.test(content(item))).length, 0);
    click('Agregar punto de interés');
    click('Restablecer borrador');
    assert.equal(nodes(app.render(), item => item.type === 'h3' && /Punto de interés\s+1/.test(content(item))).length, 0);
    assert.equal(storage.size, 0, 'restablecer el borrador no guarda cambios');
  } finally { app.unmount(); }
});

test('localStorage property access failures show an alert and preserve the draft without notifications or writes', () => {
  const storage = new Map(), eventLog = [], saved = [];
  const app = harness('agency-a', storage, eventLog);
  try {
    Object.defineProperty(globalThis.window, 'localStorage', { configurable: true, get() { throw Error('storage unavailable'); } });
    const tree = app.render({ agencyId: 'agency-a', onSaved: settings => saved.push(settings) });
    assert.match(content(nodes(tree, item => item.props?.role === 'alert')[0]), /No se pudo acceder al almacenamiento local/);
    nodes(tree, item => item.type === 'input' && item.props['aria-label'] === 'Color de acento')[0].props.onChange({ target: { value: '#22aa66' } });
    nodes(app.render(), item => item.type === 'form')[0].props.onSubmit({ preventDefault() {} });
    const after = app.render();
    assert.equal(nodes(after, item => item.type === 'input' && item.props['aria-label'] === 'Color de acento')[0].props.value, '#22aa66', 'el borrador queda intacto');
    assert.match(content(nodes(after, item => item.props?.role === 'alert')[0]), /Los ajustes anteriores no se modificaron/);
    assert.equal(storage.size, 0);
    assert.equal(eventLog.length, 0);
    assert.equal(saved.length, 0);
  } finally { app.unmount(); }
});

test('simple editor keeps technical sections behind a single closed advanced disclosure', () => {
  const app = harness();
  try {
    const tree = app.render();
    const advanced = nodes(tree, node => node.type === 'details' && content(node.props.children[0]) === 'Avanzado')[0];
    assert.ok(advanced);
    assert.ok(!advanced.props.open);
    assert.ok(nodes(advanced, node => node.type === 'input' && node.props.type === 'number').length >= 4);
    assert.equal(nodes(tree, node => node.type === 'button' && content(node) === 'Guardar cambios').length, 1);
  } finally { app.unmount(); }
});

function visibleNodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(item => visibleNodes(item, predicate));
  if (tree.props?.hidden) return [];
  if (typeof tree.type === 'function') return visibleNodes(tree.type(tree.props), predicate);
  return [...(predicate(tree) ? [tree] : []), ...visibleNodes(tree.props?.children, predicate)];
}

test('real agency admin can replace the map, save its bounds and return to interactive mode', async () => {
  const app = harness();
  const initialSettings = structuredClone(presentationApi.defaultPresentationSettings);
  const saved = [];
  const props = { agencyId: 'agency-a', realProperties: [], initialSettings,
    onPersist: async value => {
      const settings = presentationApi.parsePresentationSettings(value);
      assert.ok(settings);
      saved.push(structuredClone(settings));
      return { settings, error: null };
    },
  };
  try {
    const field = label => visibleNodes(app.render(), node => node.type === 'label' && content(node).startsWith(label))[0];
    const control = label => nodes(field(label), node => node.type === 'input' || node.type === 'select')[0];
    app.render(props);
    assert.ok(field('Modo de presentación del plano'), 'real agency map controls must be available');
    control('Modo de presentación del plano').props.onChange({ target: { value: 'artwork' } });
    control('URL de la imagen o ruta local').props.onChange({ target: { value: 'https://example.com/agency-map.webp' } });
    for (const [label, value] of [['Longitud oeste', -65], ['Longitud este', -64], ['Latitud sur', -34], ['Latitud norte', -33]]) {
      control(label).props.onChange({ target: { value: String(value) } });
    }
    assert.equal(saved.length, 0, 'draft edits must not persist automatically');
    await nodes(app.render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
    assert.equal(saved[0].map.mode, 'artwork');
    assert.equal(saved[0].map.artworkUrl, 'https://example.com/agency-map.webp');
    assert.deepEqual(saved[0].map.bounds, { west: -65, east: -64, south: -34, north: -33 });
    assert.deepEqual(initialSettings, presentationApi.defaultPresentationSettings, 'initial settings remain unchanged');
    control('Modo de presentación del plano').props.onChange({ target: { value: 'interactive' } });
    await nodes(app.render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
    assert.equal(saved[1].map.mode, 'interactive');
    assert.equal(saved[1].map.artworkUrl, saved[0].map.artworkUrl, 'switching modes retains the prepared map');
    app.render({ ...props, agencyId: 'agency-b', initialSettings: structuredClone(initialSettings) });
    assert.equal(control('URL de la imagen o ruta local').props.value, initialSettings.map.artworkUrl, 'another agency retains its own map');
  } finally { app.unmount(); }
});

test('editor panels retain one draft and a single save action while showing only their own controls', () => {
  const app = harness();
  try {
    const choose = label => nodes(app.render(), node => node.props?.role === 'tab' && content(node) === label)[0].props.onClick();
    choose('Apariencia');
    let tree = app.render();
    assert.equal(visibleNodes(tree, node => node.props?.role === 'tabpanel').length, 1);
    assert.ok(nodes(tree, node => node.props?.role === 'tabpanel' && node.props.hidden).every(node => node.props.disabled), 'hidden fields must not block native validation before shared draft validation runs');
    assert.equal(visibleNodes(tree, node => node.type === 'input' && node.props.type === 'file').length, 0);
    const color = visibleNodes(tree, node => node.type === 'input' && node.props['aria-label'] === 'Color de acento')[0];
    color.props.onChange({ target: { value: '#123456' } });
    choose('Inmuebles');
    tree = app.render();
    assert.equal(visibleNodes(tree, node => node.type === 'input' && node.props.type === 'file').length, 0);
    assert.equal(visibleNodes(tree, node => node.type === 'input' && node.props.type === 'text').length, 12, 'only property drone clips are visible in the property panel');
    choose('Mapa');
    tree = app.render();
    assert.equal(visibleNodes(tree, node => node.type === 'input' && node.props.type === 'file').length, 1);
    assert.equal(nodes(tree, node => node.type === 'input' && node.props['aria-label'] === 'Color de acento')[0].props.value, '#123456');
    assert.equal(nodes(tree, node => node.type === 'button' && content(node) === 'Guardar cambios').length, 1);
    assert.equal(app.storage.size, 0, 'tab changes must not save');
    nodes(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
    assert.equal(JSON.parse(app.storage.get(presentationApi.presentationStorageKey('agency-a'))).map.accentColor, '#123456');
  } finally { app.unmount(); }
});

test('outer personalization navigation controls the same draft without duplicate editor navigation', () => {
  const app = harness();
  try {
    let tree = app.render({ agencyId: 'agency-a', section: 'appearance', hideNavigation: true });
    nodes(tree, node => node.type === 'input' && node.props['aria-label'] === 'Color de acento')[0].props.onChange({ target: { value: '#abcdef' } });
    tree = app.render({ agencyId: 'agency-a', section: 'properties', hideNavigation: true });
    assert.equal(nodes(tree, node => node.props?.role === 'tab').length, 0);
    assert.equal(nodes(tree, node => node.type === 'input' && node.props['aria-label'] === 'Color de acento')[0].props.value, '#abcdef');
    assert.match(content(nodes(tree, node => node.type === 'h2')[0]), /inmuebles/i);
  } finally { app.unmount(); }
});

test('property template editor is displayed in Inmuebles outside the settings form', () => {
  const app = harness(); let templateSaves = 0;
  const propertyEditor = require('react/jsx-runtime').jsx('form', { 'aria-label': 'Plantillas', onSubmit: event => { event.preventDefault(); templateSaves++; }, children: require('react/jsx-runtime').jsx('button', { type: 'submit', children: 'Guardar plantillas' }) });
  try {
    let tree = app.render({ agencyId: 'agency-a', section: 'properties', propertyEditor });
    const forms = nodes(tree, node => node.type === 'form');
    assert.equal(forms.length, 2);
    assert.ok(forms.every(form => nodes(form, node => node.type === 'form').length === 1), 'template and presentation forms cannot nest');
    assert.equal(visibleNodes(tree, node => node.type === 'form').length, 2);
    forms[1].props.onSubmit({ preventDefault() {} });
    assert.equal(templateSaves, 1); assert.equal(app.storage.size, 0, 'saving a template cannot submit presentation settings');
    tree = app.render({ agencyId: 'agency-a', section: 'appearance', propertyEditor });
    assert.equal(visibleNodes(tree, node => node.type === 'form').length, 1, 'template editor is hidden outside Inmuebles');
  } finally { app.unmount(); }
});
