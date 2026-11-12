import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../components/auth/PresentationVideo.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
function nodes(tree,predicate){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(item=>nodes(item,predicate));return[...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)];}
test('video gates provide controls, skip, explicit failure continuation and consume completion once',()=>{
 const slots=[],effects=[];let cursor=0,continued=0,back=0,started=0;
 const exports={};
 new Function('require','exports',code)(id=>{
  if(id==='react')return {useRef:initial=>{const i=cursor++;return slots[i]??={current:initial};},useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>{slots[i]=v;}];},useEffect:fn=>effects.push(fn)};
  if(id.endsWith('.module.css'))return{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
  return require(id);
 },exports);
 const render=()=>{cursor=0;return exports.PresentationVideo({src:'/demo-assets/tours/location-01.mp4',title:'Transición al Centro',continueLabel:'Omitir y explorar',onStarted:()=>started++,onContinue:()=>continued++,onBack:()=>back++});};
 let tree=render();let video=nodes(tree,n=>n.type==='video')[0];assert.equal(video.props.controls,true);assert.equal(video.props.muted,true);assert.equal(video.props.playsInline,true);
 video.props.onError();assert.equal(started,0);video.props.onPlaying();assert.equal(started,1);tree=render();assert.ok(nodes(tree,n=>n.props?.role==='alert').length);
 nodes(tree,n=>n.type==='button'&&n.props.children==='Volver al mapa')[0].props.onClick();assert.equal(back,1);
 tree=render();nodes(tree,n=>n.type==='button'&&n.props.children==='Omitir y explorar')[0].props.onClick();video.props.onEnded();assert.equal(continued,1);
});


test('integrated zone transition cuts off by played time, has no controls and can only complete once',()=>{
 const slots=[]; let cursor=0,continued=0;
 const exports={};
 new Function('require','exports',code)(id=>{
  if(id==='react')return {useRef:initial=>{const i=cursor++;return slots[i]??={current:initial};},useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>{slots[i]=v;}];},useEffect:()=>{}};
  if(id.endsWith('.module.css'))return{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
  return require(id);
 },exports);
 for (const limit of [3,4]) {
  slots.length=0;cursor=0;continued=0;
  const tree=exports.PresentationVideo({src:'/demo-assets/tours/location-01.mp4',title:'Mi zona',continueLabel:'Omitir',integrated:true,maxSeconds:limit,onContinue:()=>continued++});
  const video=nodes(tree,n=>n.type==='video')[0];
  assert.equal(video.props.controls,false);
  let paused=0;
  video.props.onTimeUpdate({currentTarget:{currentTime:limit-0.1,pause(){paused++;}}}); assert.equal(continued,0);
  video.props.onTimeUpdate({currentTarget:{currentTime:limit,pause(){paused++;}}}); assert.equal(continued,1);assert.equal(paused,1);
  video.props.onEnded();assert.equal(continued,1);
 }
});

test('autoStart explicitly plays inline without native controls and exposes a blocked-play retry', async () => {
 const slots=[],effects=[];let cursor=0,plays=0,continued=0;
 const exports={};
 new Function('require','exports',code)(id=>{
  if(id==='react')return {useRef:v=>slots[cursor++]??={current:v},useState:v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return[slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value];},useEffect:fn=>effects.push(fn)};
  if(id.endsWith('.module.css'))return{__esModule:true,default:{}};
  return require(id);
 },exports);
 const render=()=>{cursor=0;effects.length=0;return exports.PresentationVideo({src:'/intro.mp4',title:'Presentación',continueLabel:'Continuar',autoStart:true,onContinue(){continued++;}});};
 let tree=render();const video=nodes(tree,n=>n.type==='video')[0];
 assert.equal(video.props.controls,false);
 video.props.ref.current={muted:false,playsInline:false,play(){plays++;return Promise.reject(Error('blocked'));}};
 globalThis.document={activeElement:null};globalThis.window={matchMedia(){return{matches:false};}};globalThis.HTMLElement=class{};
 try {
  nodes(tree,n=>n.type==='dialog')[0].props.ref.current={showModal(){},close(){}};
  effects.forEach(fn=>fn()); await Promise.resolve();await Promise.resolve();
  assert.equal(plays,1);tree=render();assert.ok(nodes(tree,n=>n.props?.role==='alert').length);
  video.props.onEnded();assert.equal(continued,1);
 } finally { delete globalThis.document;delete globalThis.window;delete globalThis.HTMLElement; }
});

test('automatic presentation honors reduced motion and ignores late rejected playback after disposal', async () => {
 for (const reduced of [true,false]) {
  const slots=[],effects=[];let cursor=0,plays=0,continued=0,rejectPlay;
  const exports={};
  new Function('require','exports',code)(id=>{
   if(id==='react')return {useRef:v=>slots[cursor++]??={current:v},useState:v=>{const i=cursor++;if(!(i in slots))slots[i]=v;return[slots[i],value=>slots[i]=value];},useEffect:fn=>effects.push(fn)};
   if(id.endsWith('.module.css'))return{__esModule:true,default:{}};
   return require(id);
  },exports);
  const render=()=>{cursor=0;effects.length=0;return exports.PresentationVideo({src:'/intro.mp4',title:'Inicio',continueLabel:'Continuar',autoStart:true,onContinue(){continued++;}});};
  const tree=render();const video=nodes(tree,n=>n.type==='video')[0];
  video.props.ref.current={pause(){},play(){plays++;return new Promise((_,reject)=>rejectPlay=reject);}};
  nodes(tree,n=>n.type==='dialog')[0].props.ref.current={showModal(){},close(){}};
  globalThis.document={activeElement:null};globalThis.window={matchMedia(){return{matches:reduced};}};globalThis.HTMLElement=class{};
  try {
   const cleanups=effects.map(fn=>fn());assert.equal(plays,reduced?0:1);assert.equal(continued,reduced?1:0);
   cleanups.forEach(fn=>fn?.());rejectPlay?.(Error('late'));await Promise.resolve();await Promise.resolve();
   assert.equal(nodes(render(),n=>n.props?.role==='alert').length,0);
  } finally {delete globalThis.document;delete globalThis.window;delete globalThis.HTMLElement;}
 }
});
