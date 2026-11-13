import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const code = ts.transpileModule(readFileSync('components/BuildingTourEntry.tsx','utf8'), {compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
function nodes(tree, type) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(t=>nodes(t,type)); return [...(tree.type===type?[tree]:[]),...nodes(tree.props?.children,type)]; }
function mount({reject=false,reducedMotion=false}={}) {
 const slots=[],effects=[]; let cursor=0,plays=0,entered=0;
 const exports={};
 new Function('require','exports',code)(id=>{
  if(id==='react') return {useRef:v=>slots[cursor++]??={current:v},useState:v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return[slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value];},useEffect:fn=>effects.push(fn)};
  if(id==='@/lib/property-tour-demo')return{tourProperties:[]};
  if(id==='next/link')return{__esModule:true,default:'a'};
  if(id.endsWith('.module.css'))return{__esModule:true,default:{}};
  return require(id);
 },exports);
 const property={id:'p',entranceVideo:'/entry.mp4',buildingPoster:'/poster.jpg'};
 const render=()=>{cursor=0;effects.length=0;return exports.BuildingTourEntry({property,properties:[property],entering:true,reducedMotion,onSelect(){},onReturn(){},onEntered(){entered++;}});};
 let tree=render(); const video=nodes(tree,'video')[0];
 video.props.ref.current={muted:false,playsInline:false,play(){plays++;return reject?Promise.reject(Error('blocked')):Promise.resolve();},pause(){}};
 const cleanup=effects.map(fn=>fn());
 return {render,video,get plays(){return plays;},get entered(){return entered;},cleanup};
}
test('entering plays muted inline automatically without a routine start button and ends inside',async()=>{
 const h=mount(); await Promise.resolve(); assert.equal(h.plays,1); assert.equal(h.video.props.controls,false);
 assert.ok(!nodes(h.render(),'button').some(n=>JSON.stringify(n.props.children).includes('Reproducir video')));
 h.video.props.onEnded();assert.equal(h.entered,1);
});
test('entry autoplay rejection offers retry, while reduced motion bypasses entry video',async()=>{
 const blocked=mount({reject:true});await Promise.resolve();await Promise.resolve();
 assert.ok(nodes(blocked.render(),'button').some(n=>JSON.stringify(n.props.children).includes('Reintentar')));
 const reduced=mount({reducedMotion:true});assert.equal(reduced.plays,0);assert.equal(reduced.entered,1);
});
