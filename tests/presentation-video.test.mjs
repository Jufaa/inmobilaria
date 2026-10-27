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
 const slots=[],effects=[];let cursor=0,continued=0,back=0;
 const exports={};
 new Function('require','exports',code)(id=>{
  if(id==='react')return {useRef:initial=>{const i=cursor++;return slots[i]??={current:initial};},useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>{slots[i]=v;}];},useEffect:fn=>effects.push(fn)};
  if(id.endsWith('.module.css'))return{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
  return require(id);
 },exports);
 const render=()=>{cursor=0;return exports.PresentationVideo({src:'/demo-assets/tours/location-01.mp4',title:'Transición al Centro',continueLabel:'Omitir y explorar',onContinue:()=>continued++,onBack:()=>back++});};
 let tree=render();let video=nodes(tree,n=>n.type==='video')[0];assert.equal(video.props.controls,true);assert.equal(video.props.muted,true);assert.equal(video.props.playsInline,true);
 video.props.onError();tree=render();assert.ok(nodes(tree,n=>n.props?.role==='alert').length);
 nodes(tree,n=>n.type==='button'&&n.props.children==='Volver al mapa')[0].props.onClick();assert.equal(back,1);
 tree=render();nodes(tree,n=>n.type==='button'&&n.props.children==='Omitir y explorar')[0].props.onClick();video.props.onEnded();assert.equal(continued,1);
});
