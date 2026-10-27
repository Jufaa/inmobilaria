import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { buildDemoAreas, aerialCameraForBounds } from '../lib/property-aerial-demo.ts';
import { defaultDemoConfig } from '../lib/property-tour-config.ts';

const source = readFileSync(new URL('../components/GoogleAerialArea.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const require = createRequire(import.meta.url);
let sdkLoads = 0;
const exports = {};
new Function('require', 'exports', compiled)((id) => {
  if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
  if (id === '@/lib/property-aerial-demo') return { aerialCameraForBounds };
  if (id === '@/lib/google-maps-3d') return { loadGoogleMaps3D: () => { sdkLoads++; throw Error('SSR must not request Google'); } };
  return require(id);
}, exports);

test('the aerial zone presents six direct property options rather than a video carousel and never loads Google during SSR', () => {
  for (const area of buildDemoAreas(defaultDemoConfig)) {
    const noop = () => {};
    const html = renderToStaticMarkup(createElement(exports.GoogleAerialArea, { area, onSelect: noop, onClose: noop, onEdit: noop }));
    assert.equal((html.match(/aria-label="Entrar a /g) ?? []).length, 6);
    for (const property of area.properties) assert.ok(html.includes(`aria-label="Entrar a ${property.title}"`));
    assert.ok(!html.includes('<video'));
    assert.ok(html.includes('Cargando la vista aérea de Google'));
    assert.ok(html.includes('Rotar vista aérea'));
    assert.ok(html.includes('Centrar zona'));
    assert.ok(html.includes('Los videos de muestra se reutilizan'));
  }
  assert.equal(sdkLoads, 0);
});
