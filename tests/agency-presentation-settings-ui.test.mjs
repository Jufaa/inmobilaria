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
    if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (id === '@/lib/agency-presentation') return presentationApi;
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
    button('Guardar ajustes').props.onClick?.();
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
