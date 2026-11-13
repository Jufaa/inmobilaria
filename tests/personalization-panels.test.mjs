import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../components/auth/PersonalizationPanels.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const text = tree => tree == null || typeof tree === 'boolean' ? '' : typeof tree === 'string' || typeof tree === 'number' ? String(tree) : Array.isArray(tree) ? tree.map(text).join(' ') : text(tree.props?.children);
function nodes(tree, visible = false) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(item => nodes(item, visible));
  if (visible && tree.props?.hidden) return [];
  if (typeof tree.type === 'function') return nodes(tree.type(tree.props), visible);
  return [tree, ...nodes(tree.props?.children, visible)];
}
function harness() {
  const slots = []; let cursor = 0;
  const exports = {};
  new Function('require', 'exports', code)(id => {
    if (id === 'react') return { ...require('react'), useId: () => 'personalization-test', useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; } };
    if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    return require(id);
  }, exports);
  const identity = createElement('form', { id: 'identity-form' }, createElement('input', { defaultValue: 'existing identity draft' }));
  const draft = { retained: true };
  const presentation = createElement('presentation-editor', { key: 'single-editor', initialSettings: draft });
  const render = () => { cursor = 0; return exports.PersonalizationPanels({ identity, presentation }); };
  const click = label => nodes(render()).find(node => node.props?.role === 'tab' && text(node) === label).props.onClick();
  return { exports, render, click, identity, draft };
}

test('personalization has four focused panels and only one is visible at a time', () => {
  const app = harness();
  assert.deepEqual(nodes(app.render()).filter(node => node.props?.role === 'tab').map(text), ['Identidad', 'Mapa', 'Inmuebles', 'Apariencia']);
  assert.equal(nodes(app.render(), true).filter(node => node.type === 'form').length, 1);
  assert.equal(nodes(app.render(), true).filter(node => node.type === 'presentation-editor').length, 0);
  for (const [label, section] of [['Mapa', 'map'], ['Inmuebles', 'properties'], ['Apariencia', 'appearance']]) {
    app.click(label);
    const tree = app.render();
    const editors = nodes(tree).filter(node => node.type === 'presentation-editor');
    assert.equal(editors.length, 1);
    assert.equal(editors[0].props.section, section);
    assert.equal(editors[0].props.hideNavigation, true);
    assert.equal(editors[0].props.initialSettings, app.draft);
    assert.equal(editors[0].key, 'single-editor');
    assert.equal(nodes(tree, true).filter(node => node.type === 'form').length, 0);
    assert.equal(nodes(tree, true).filter(node => node.type === 'presentation-editor').length, 1);
    assert.equal(nodes(tree).find(node => node.type === 'form'), app.identity, 'identity form remains mounted to retain its own draft');
  }
  app.click('Identidad');
  assert.equal(nodes(app.render(), true).filter(node => node.type === 'form').length, 1);
});

test('tab actions do not submit and support directional keyboard navigation', () => {
  const app = harness(); let selected; let focused = '';
  const tree = app.exports.PresentationPanelTabs({ id: 'test-tabs', sections: [{ id: 'map', label: 'Mapa' }, { id: 'properties', label: 'Inmuebles' }, { id: 'appearance', label: 'Apariencia' }], value: 'map', onChange: value => { selected = value; } });
  const tabs = nodes(tree).filter(node => node.props?.role === 'tab');
  assert.ok(tabs.every(node => node.props.type === 'button'));
  assert.equal(tabs[0].props.tabIndex, 0); assert.equal(tabs[1].props.tabIndex, -1);
  tabs[0].props.onKeyDown({ key: 'ArrowRight', preventDefault() {}, currentTarget: { parentElement: { querySelector(selector) { focused = selector; return { focus() {} }; } } } });
  assert.equal(selected, 'properties'); assert.match(focused, /properties/);
});
