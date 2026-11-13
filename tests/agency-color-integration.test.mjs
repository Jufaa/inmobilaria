import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
test('property legend uses a real selected-color swatch rather than inherited text coloring',()=>{
 const map=read('components/auth/RealAgencyMap.tsx');assert.match(map,/className=\{styles.legendSwatch\} style=\{\{backgroundColor:color\}\}/);
 const css=read('components/auth/real-agency-map.module.css');assert.match(css,/\.legendSwatch\s*\{[^}]*width:\s*12px/);
});
test('Barrios inherits branded agency tokens and edit actions receive the same button styling',()=>{
 const css=read('components/auth/zone-manager.module.css');assert.match(css,/:global\(html\)\s+:global\(\[data-panel-brand='custom'\]\)\s+\.page/);
 assert.match(css,/--zone-accent:\s*var\(--panel-accent/);assert.match(css,/--zone-button-text:\s*var\(--panel-button-text/);assert.match(css,/\.editForm button/);
});

test('client property forms keep their client directive before integration imports',()=>{
 for(const path of ['components/auth/PropertyManager.tsx','components/auth/RealMapPropertyForm.tsx'])assert.match(read(path),/^'use client';/);
});
