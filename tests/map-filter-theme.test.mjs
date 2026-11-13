import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const fields=read('components/auth/agency-presentation-map.module.css');
const block=(source,selector)=>source.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*\\{([^}]+)\\}'))?.[1]??'';
test('filter fields, dropdown options, clear button and nested panels use theme tokens rather than fixed light colors',()=>{
 const inputs=block(fields,'.filterFields input, .filterFields select');
 assert.match(inputs,/background:\s*var\(--panel-input/);assert.match(inputs,/color:\s*var\(--panel-text/);assert.doesNotMatch(inputs,/background:\s*#fff\b|color:\s*#213c32/);
 const panel=block(fields,'.filterPanel');assert.match(panel,/background:\s*var\(--panel-surface/);assert.match(panel,/color:\s*var\(--panel-text/);
 const buttons=block(fields,'.filterFields button');assert.match(buttons,/background:\s*var\(--panel-soft/);assert.match(buttons,/color:\s*var\(--panel-text/);
 assert.match(fields,/\.filterFields select option\s*\{[^}]*background:\s*var\(--panel-input/);
 assert.match(fields,/:global\(html\[data-theme='dark'\]\)[^{]*\.filterFields[^{]*\{[^}]*color-scheme:\s*dark/);
});
test('floating filters and marketplace results also inherit public theme fallbacks without a workspace shell',()=>{
 for(const path of ['components/auth/map-search-controls.module.css','components/auth/property-search-results.module.css']){
  const source=read(path);assert.match(source,/var\(--panel-surface,\s*var\(--white/);assert.match(source,/var\(--panel-text,\s*var\(--ink/);
  assert.match(source,/:global\(html\[data-theme='dark'\]\)[^{]*\{[^}]*color-scheme:\s*dark/);
 }
});

test('inherited light and dark panel palettes keep filter text, placeholders, clear buttons and borders readable',()=>{
 const source=read('components/auth/workspace-shell.module.css');
 const tokens=body=>Object.fromEntries([...body.matchAll(/--panel-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(([,key,value])=>[key,value]));
 const light=tokens(block(source,'.shell')),dark={...light,...tokens(block(source,":global(html[data-theme='dark']) .shell"))};
 const luminance=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const contrast=(a,b)=>{const [max,min]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return(max+.05)/(min+.05);};
 for(const palette of [light,dark]){
  for(const [foreground,background] of [['text','surface'],['text','input'],['text','soft'],['muted','surface'],['placeholder','input']])assert.ok(contrast(palette[foreground],palette[background])>=4.5,`${foreground}/${background}`);
  assert.ok(contrast(palette.border,palette.input)>=3);assert.ok(contrast(palette.focus,palette.input)>=3);
 }
 assert.notEqual(light.input,dark.input);assert.notEqual(light.surface,dark.surface);
});
