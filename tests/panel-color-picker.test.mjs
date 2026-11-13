import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as colors from '../lib/panel-colors.ts';

const require = createRequire(import.meta.url);
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const content = tree => tree == null || typeof tree === 'boolean' ? '' : typeof tree === 'string' || typeof tree === 'number' ? String(tree) : Array.isArray(tree) ? tree.map(content).join(' ') : content(tree.props?.children);
const compile = path => ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
function picker() {
  let nextId = 0;
  const exports = {};
  new Function('require', 'exports', compile('components/auth/PanelColorPicker.tsx'))(id => {
    if (id === 'react') return { useId: () => `color-${nextId++}` };
    if (id === '@/lib/panel-colors') return colors;
    if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    return require(id);
  }, exports);
  return exports.PanelColorPicker;
}

test('color helpers preserve six-digit hex and calculate RGB without accepting unsafe values', () => {
  assert.equal(colors.normalizeHexColor('#A1b2C3'), '#a1b2c3');
  assert.deepEqual(colors.hexToRgb('#A1b2C3'), { r: 161, g: 178, b: 195 });
  assert.equal(colors.formatRgbColor('#ff8000'), 'RGB(255, 128, 0)');
  for (const value of ['', null, '#abc', 'red', 'rgb(1,2,3)', '#ffffff;display:none']) assert.equal(colors.normalizeHexColor(value), null);
  assert.equal(new Set(colors.panelColorPresets.map(preset => preset.value)).size, colors.panelColorPresets.length);
});

test('swatches and arbitrary colors update RGB while keeping the submitted hex field', () => {
  const Component = picker();
  let value = '#236b58';
  const render = () => Component({ label: 'Color principal', name: 'brandPrimaryColor', value, onChange: next => { value = next; } });
  let tree = render();
  const swatch = nodes(tree).find(node => node.type === 'button' && node.props['data-color']);
  assert.equal(swatch.props.type, 'button');
  swatch.props.onClick();
  tree = render();
  assert.equal(value, swatch.props['data-color']);
  assert.equal(nodes(tree).find(node => node.type === 'button' && node.props['data-color'] === value).props['aria-pressed'], true);
  assert.ok(content(tree).includes(colors.formatRgbColor(value)));
  const native = nodes(tree).find(node => node.type === 'input' && node.props.type === 'color');
  native.props.onChange({ target: { value: '#12ABef' } });
  tree = render();
  assert.equal(value, '#12abef');
  assert.ok(content(tree).includes('RGB(18, 171, 239)'));
  const hidden = nodes(tree).find(node => node.type === 'input' && node.props.name === 'brandPrimaryColor');
  assert.equal(hidden.props.type, 'hidden'); assert.equal(hidden.props.value, '#12abef');
  assert.equal(nodes(tree).filter(node => node.type === 'input' && node.props.name).length, 1);
});

test('empty/default mode, reset and multiple picker labels stay accessible without submitting', () => {
  const Component = picker();
  let value = null;
  const render = () => Component({ label: 'Color principal', name: 'brandPrimaryColor', value, allowDefault: true, onChange: next => { value = next; } });
  let tree = render();
  assert.equal(nodes(tree).find(node => node.type === 'input' && node.props.type === 'hidden').props.value, '');
  assert.ok(content(tree).includes('Predeterminado'));
  const swatch = nodes(tree).find(node => node.type === 'button' && node.props['data-color']);
  swatch.props.onClick();
  tree = render();
  const reset = nodes(tree).find(node => node.type === 'button' && content(node) === 'Usar predeterminado');
  assert.equal(reset.props.type, 'button'); reset.props.onClick();
  assert.equal(value, '');
  const second = Component({ label: 'Otro color', value: '#ffffff', onChange() {} });
  const firstId = nodes(tree).find(node => node.type === 'input' && node.props.type === 'color').props.id;
  const secondId = nodes(second).find(node => node.type === 'input' && node.props.type === 'color').props.id;
  assert.notEqual(firstId, secondId);
  assert.equal(nodes(tree).filter(node => node.type === 'button' && node.props.type !== 'button').length, 0);
  const disabled = Component({ label: 'Color', value: '#ffffff', disabled: true, onChange() {} });
  assert.equal(disabled.props.disabled, true);
});

test('branding keeps its original action and non-color FormData fields when using the visual picker', () => {
  const Component = picker();
  const slots = [], effects = []; let cursor = 0;
  const previewed = [];
  let actionState = { status: 'idle', message: '' };
  const hooks = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], next => { slots[index] = next; }]; },
    useEffect(effect) { effects.push(effect); },
    useActionState(action) { cursor++; return [actionState, action, false]; },
  };
  const exports = {};
  new Function('require', 'exports', compile('app/inmobiliaria/[agencyId]/panel/personalizacion/BrandingForm.tsx'))(id => {
    if (id === 'react') return hooks;
    if (id === '@/components/auth/WorkspaceEditPermission') return {EditableForm:'form'};
    if (id === '@/components/auth/PanelColorPicker') return { PanelColorPicker: Component };
    if (id === './actions') return { updateAgencyBranding: (...args) => args };
    if (id === '@/components/auth/PanelBrandTheme') return { previewPanelBrandColor: (...args) => previewed.push(args) };
    if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    return require(id);
  }, exports);
  const initial = { brandPrimaryColor: '#abcdef', logoUrl: 'https://example.com/logo.png', coverUrl: null, welcomeVideoUrl: null, welcomeVideoDescription: 'Presentación' };
  const render = () => { cursor = 0; return exports.BrandingForm({ agencySlug: 'agency-a', initial }); };
  let tree = render();
  let control = nodes(tree).find(node => node.type === Component);
  assert.ok(control); assert.equal(control.props.name, 'brandPrimaryColor'); assert.equal(control.props.value, '#abcdef');
  control.props.onChange('#123456');
  assert.deepEqual(previewed, [['agency-a', '#123456']]);
  tree = render(); control = nodes(tree).find(node => node.type === Component);
  assert.equal(control.props.value, '#123456');
  for (const name of ['logoUrl', 'coverUrl', 'welcomeVideoUrl', 'welcomeVideoDescription']) assert.ok(nodes(tree).some(node => node.props?.name === name));
  assert.deepEqual(tree.props.action('previous', 'form-data'), ['agency-a', 'previous', 'form-data']);
  assert.equal(nodes(tree).find(node => node.type === 'button' && node.props.type === 'submit').props.children, 'Guardar identidad');
  actionState = { status: 'error', message: 'No se pudo guardar.' };
  tree = render();
  assert.ok(content(tree).includes('No se pudo guardar.'));
  assert.ok(content(tree).includes('Vista previa del panel'));
});
