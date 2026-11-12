import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../components/auth/zone-manager.module.css', import.meta.url), 'utf8');
const tokens = block => Object.fromEntries([...block.matchAll(/(--zone-[\w-]+)\s*:\s*(#[a-f0-9]{6})/gi)].map(([, key, value]) => [key, value]));
const luminance = hex => hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const contrast = (foreground, background) => {
  assert.ok(foreground && background, 'both palette colors must be explicit');
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
};

test('zone manager has readable text, controls and focus in light and dark palettes', () => {
  const light = tokens(css.match(/\.page\s*\{([^}]+)\}/)?.[1] ?? '');
  const dark = tokens(css.match(/:global\(html\[data-theme='dark'\]\)\s+\.page\s*\{([^}]+)\}/)?.[1] ?? '');
  for (const [theme, palette] of [['light', light], ['dark', { ...light, ...dark }]]) {
    for (const [text, background] of [['ink', 'canvas'], ['ink', 'surface'], ['muted', 'surface'], ['muted', 'canvas'], ['ink', 'input'], ['placeholder', 'input'], ['ink', 'note'], ['button-text', 'accent'], ['success', 'surface'], ['error', 'surface']]) {
      assert.ok(contrast(palette[`--zone-${text}`], palette[`--zone-${background}`]) >= 4.5, `${theme}: ${text} on ${background} must reach 4.5:1`);
    }
    assert.ok(contrast(palette['--zone-line'], palette['--zone-input']) >= 3, `${theme}: input borders must be distinguishable`);
    assert.ok(contrast(palette['--zone-focus'], palette['--zone-input']) >= 3, `${theme}: keyboard focus must be distinguishable`);
  }
  assert.ok(Object.keys(dark).length >= 10, 'dark mode cannot inherit the light text colors');
  assert.match(css, /\.header h1\s*\{[^}]*color:\s*var\(--zone-ink\)/);
  assert.match(css, /\.fields label\s*\{[^}]*color:\s*var\(--zone-muted\)/);
  assert.match(css, /\.fields input::placeholder[^}]*color:\s*var\(--zone-placeholder\)/);
});
