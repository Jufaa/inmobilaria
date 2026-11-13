import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as colors from '../lib/panel-colors.ts';

const require = createRequire(import.meta.url);
const compile = path => ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
function contrast(a, b) {
  const luminance = hex => hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

test('brand variables keep arbitrary accents readable without overriding the page or user map palette', () => {
  for (const color of ['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#777777', ...colors.panelColorPresets.map(color => color.value)]) {
    const style = colors.panelBrandStyles(color);
    assert.equal(style['--panel-accent'], color);
    assert.ok(contrast(color, style['--panel-button-text']) >= 4.5);
    assert.ok(contrast(style['--panel-accent-hover'], style['--panel-button-text']) >= 4.5);
    for (const background of ['#ffffff', '#f5f7f5', '#e8f0eb']) assert.ok(contrast(style['--panel-brand-link-light'], background) >= 4.5);
    for (const background of ['#101a16', '#1a2d23', '#213c2e']) assert.ok(contrast(style['--panel-brand-link-dark'], background) >= 4.5);
    assert.equal(style['--panel-canvas'], undefined);
    assert.equal(style['--popup-bg'], undefined);
  }
  for (const invalid of [null, '', '#abc', 'red', 'url(https://example.com)', '#123456;display:none']) assert.deepEqual(colors.panelBrandStyles(invalid), {});
});

function themeHarness() {
  const slots = [], effects = [], deps = [], cleanups = []; let cursor = 0;
  const listeners = new Set();
  const originalWindow = globalThis.window, originalEvent = globalThis.CustomEvent;
  globalThis.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  globalThis.window = { addEventListener(type, callback) { listeners.add(callback); }, removeEventListener(type, callback) { listeners.delete(callback); }, dispatchEvent(event) { [...listeners].forEach(listener => listener(event)); return true; } };
  const exports = {};
  new Function('require', 'exports', compile('components/auth/PanelBrandTheme.tsx'))(id => {
    if (id === 'react') return {
      useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = value; }]; },
      useEffect(callback, dependencies) { const index = cursor++; effects[index] = { callback, dependencies }; },
    };
    if (id === '@/lib/panel-colors') return colors;
    return require(id);
  }, exports);
  let props = { agencySlug: 'agency-a', initialColor: '#ff0000', className: 'shell', children: 'content' };
  const render = (next = props) => {
    props = next; cursor = 0; effects.length = 0;
    const tree = exports.PanelBrandTheme(props);
    for (const [index, effect] of effects.entries()) {
      if (!effect) continue;
      if (!deps[index] || effect.dependencies.some((value, position) => value !== deps[index][position])) {
        cleanups[index]?.(); deps[index] = effect.dependencies; cleanups[index] = effect.callback();
      }
    }
    return tree;
  };
  return { render, api: exports, close() { cleanups.forEach(cleanup => cleanup?.()); if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow; if (originalEvent === undefined) delete globalThis.CustomEvent; else globalThis.CustomEvent = originalEvent; } };
}

test('preview is immediate and agency-scoped, reset restores defaults, prop changes and reload use persisted color', () => {
  const app = themeHarness();
  try {
    assert.equal(app.render().props.style['--panel-accent'], '#ff0000');
    app.api.previewPanelBrandColor('agency-b', '#00ff00');
    assert.equal(app.render().props.style['--panel-accent'], '#ff0000');
    app.api.previewPanelBrandColor('agency-a', '#0000ff');
    assert.equal(app.render().props.style['--panel-accent'], '#0000ff');
    assert.equal(app.api.previewPanelBrandColor('agency-a', 'red'), false);
    assert.equal(app.render().props.style['--panel-accent'], '#0000ff');
    app.api.previewPanelBrandColor('agency-a', '');
    assert.deepEqual(app.render().props.style, {});
    app.api.previewPanelBrandColor('agency-a', '#00ff00');
    assert.equal(app.render({ agencySlug: 'agency-b', initialColor: '#ff00ff' }).props.style['--panel-accent'], '#ff00ff');
    app.api.previewPanelBrandColor('agency-a', '#000000');
    assert.equal(app.render().props.style['--panel-accent'], '#ff00ff');
    assert.equal(app.render({ agencySlug: 'agency-b', initialColor: '#00ffff' }).props.style['--panel-accent'], '#00ffff');
  } finally { app.close(); }
  const reload = themeHarness();
  try { assert.equal(reload.render().props.style['--panel-accent'], '#ff0000', 'unsaved previews are not persisted across reloads'); } finally { reload.close(); }
});

test('branding action retains access guard and validation, stores tenant color and revalidates every panel page', async () => {
  let allowed = true; let failWrite = false; let stored = '#123456'; const writes = [], revalidated = [];
  const exports = {};
  new Function('require', 'exports', compile('app/inmobiliaria/[agencyId]/panel/personalizacion/actions.ts'))(id => {
    if (id === 'next/cache') return { revalidatePath: path => revalidated.push(path) };
    if (id === '@/lib/agency-access') return { requireAgencyPlatformEditAccess: async slug => { if (!allowed) throw Error('denied'); assert.equal(slug, 'agency-a'); return { membership: { agency: { id: 'tenant-a' } } }; } };
    if (id === '@/lib/prisma') return { prisma: { agency: { updateMany: async query => { if (failWrite) throw Error('unavailable'); writes.push(query); stored = query.data.brandPrimaryColor; return { count: 1 }; } } } };
    return require(id);
  }, exports);
  const form = color => { const data = new FormData(); data.set('brandPrimaryColor', color); return data; };
  assert.equal((await exports.updateAgencyBranding('agency-a', {}, form('red'))).status, 'error'); assert.equal(stored, '#123456');
  allowed = false; await assert.rejects(exports.updateAgencyBranding('agency-a', {}, form('#abcdef')), /denied/); assert.equal(writes.length, 0);
  allowed = true;
  assert.equal((await exports.updateAgencyBranding('agency-a', {}, form('#ABCDEF'))).status, 'success');
  assert.equal(stored, '#abcdef'); assert.deepEqual(writes[0].where, { id: 'tenant-a' });
  for (const suffix of ['', '/propiedades', '/consultas', '/analiticas', '/zonas', '/colaboracion', '/alquileres', '/personalizacion']) assert.ok(revalidated.includes(`/inmobiliaria/agency-a/panel${suffix}`), suffix || 'main panel');
  failWrite = true;
  const beforeFailure = JSON.stringify({ stored, writes, revalidated });
  await assert.rejects(exports.updateAgencyBranding('agency-a', {}, form('#000000')), /unavailable/);
  assert.equal(JSON.stringify({ stored, writes, revalidated }), beforeFailure, 'failed saves do not change stored state or revalidate as if saved');
  failWrite = false;
  assert.equal((await exports.updateAgencyBranding('agency-a', {}, form(''))).status, 'success'); assert.equal(stored, null);
});

test('server shell hands stored agency color to its scoped client boundary', () => {
  const exports = {};
  function PanelBrandTheme() {}
  new Function('require', 'exports', compile('components/auth/WorkspaceShell.tsx'))(id => {
    if (id === './PanelBrandTheme') return { PanelBrandTheme };
    if (id === './MapWorkspaceLayout') return { MapWorkspaceLayout: 'map-layout' };
    if (id === './WorkspaceEditPermission') return { WorkspaceEditPermissionProvider() {} };
    if (id === './GoogleSignOut') return { GoogleSignOut() {} };
    if (id === './AgencySectionTabs') return { AgencySectionTabs() {} };
    if (id === '@/components/theme/ThemeToggle') return { ThemeToggle() {} };
    if (id === 'next/link') return { __esModule: true, default() {} };
    if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    return require(id);
  }, exports);
  const tree = exports.WorkspaceShell({ agencyName: 'Agency A', agencySlug: 'agency-a', brandPrimaryColor: '#ff0000', activeSection: 'map', children: 'content' });
  assert.equal(tree.type, PanelBrandTheme);
  assert.equal(tree.props.initialColor, '#ff0000');
  assert.equal(tree.props.agencySlug, 'agency-a');
  assert.equal(tree.props.className, 'shell');
});

test('allowed panel routes forward stored brand color without changing their access guards', () => {
  for (const route of ['propiedades', 'consultas', 'analiticas', 'zonas', 'colaboracion', 'alquileres']) {
    const source = readFileSync(new URL(`../app/inmobiliaria/[agencyId]/panel/${route}/page.tsx`, import.meta.url), 'utf8');
    assert.match(source, /brandPrimaryColor=\{membership\.agency\.brandPrimaryColor\}/);
    assert.match(source, /requireAgency(?:Dashboard|Collaboration|Finance)Access/);
  }
});
