import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const shell = read('components/auth/workspace-shell.module.css');
const tokens = block => Object.fromEntries([...block.matchAll(/(--panel-[\w-]+)\s*:\s*(#[a-f0-9]{6})/gi)].map(([, key, value]) => [key, value]));
function luminance(hex) {
  assert.ok(hex, 'palette token must exist');
  return hex.slice(1).match(/../g).map(part => parseInt(part, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
}
function ratio(a, b) { const values = [luminance(a), luminance(b)].sort((a, b) => b - a); return (values[0] + .05) / (values[1] + .05); }

test('one explicit panel palette supplies readable text, status, controls and focus in both themes', () => {
  const light = tokens(shell.match(/\.shell\s*\{([^}]+)\}/)?.[1] ?? '');
  const dark = tokens(shell.match(/:global\(html\[data-theme='dark'\]\)\s+\.shell\s*\{([^}]+)\}/)?.[1] ?? '');
  assert.ok(Object.keys(dark).length >= 15, 'dark theme must define a complete panel palette');
  for (const [theme, palette] of [['light', light], ['dark', { ...light, ...dark }]]) {
    for (const [foreground, background] of [['text', 'canvas'], ['text', 'surface'], ['muted', 'surface'], ['muted', 'canvas'], ['muted', 'soft'], ['text', 'input'], ['placeholder', 'input'], ['button-text', 'accent'], ['error', 'error-surface'], ['success', 'success-surface'], ['warning', 'warning-surface']]) {
      assert.ok(ratio(palette[`--panel-${foreground}`], palette[`--panel-${background}`]) >= 4.5, `${theme}: ${foreground} on ${background}`);
    }
    for (const control of ['border', 'focus']) assert.ok(ratio(palette[`--panel-${control}`], palette['--panel-input']) >= 3, `${theme}: ${control}`);
  }
});

test('all administrative panel modules adopt the palette without universal color overrides', () => {
  for (const path of [
    'app/inmobiliaria/[agencyId]/panel/personalizacion/branding.module.css',
    'components/auth/agency-collaboration.module.css', 'components/auth/rental-manager.module.css',
    'components/auth/personalization-panels.module.css', 'components/auth/panel-color-picker.module.css',
    'components/auth/property-manager.module.css', 'components/auth/inquiry-manager.module.css',
    'components/auth/agency-analytics-dashboard.module.css', 'components/auth/agency-presentation-settings.module.css',
  ]) {
    const css = read(path);
    assert.match(css, /var\(--panel-text/, `${path} must consume the shared text color`);
    assert.match(css, /var\(--panel-(?:surface|soft)/, `${path} must consume the shared surface color`);
    assert.doesNotMatch(css, /(?:\.shell|\.page|\.editor)\s+\*\s*\{[^}]*color\s*:/, 'no blanket selectors over map content');
  }
});

test('map editor dialog uses its full padded width, shared colors and readable template controls', () => {
  const css = read('components/aerial-experience.module.css');
  const dialog = css.match(/\.editorDialog\s*\{([^}]+)\}/)?.[1] ?? '';
  assert.match(dialog, /padding:\s*(?:1[6-9]|[2-9]\d)px/);
  assert.match(dialog, /background:\s*var\(--panel-/);
  assert.match(dialog, /overflow-y:\s*auto/);
  const admin = read('components/auth/agency-presentation-map.module.css');
  assert.match(admin, /\.closeSettings\s*\{[^}]*float:\s*none/);
  assert.match(admin, /--popup-bg/); assert.match(admin, /--popup-text/);
  assert.match(css, /\.editorGrid label\s*\{[^}]*font-size:\s*var\(--type-sm\)/);
  const rentals = read('components/auth/rental-manager.module.css');
  assert.match(rentals, /\.draft\s*\{[^}]*background:\s*#fff[^}]*color:\s*#1b2822/);
});
