import test from 'node:test';
import assert from 'node:assert/strict';
import {hasSeenAgencyIntro,rememberAgencyIntro} from '../lib/agency-intro.ts';
test('intro history is browser-persistent and scoped to the agency and video',()=>{
 const rows=new Map();const storage={getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value)};
 assert.equal(hasSeenAgencyIntro(storage,'agency-a','/intro.mp4'),false);
 rememberAgencyIntro(storage,'agency-a','/intro.mp4');
 assert.equal(hasSeenAgencyIntro(storage,'agency-a','/intro.mp4'),true);
 assert.equal(hasSeenAgencyIntro(storage,'agency-b','/intro.mp4'),false);
 assert.equal(hasSeenAgencyIntro(storage,'agency-a','/new-intro.mp4'),false);
});
test('blocked browser storage does not break entry and still remembers during this app session',()=>{
 const storage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.equal(hasSeenAgencyIntro(storage,'blocked','/intro.mp4'),false);
 rememberAgencyIntro(storage,'blocked','/intro.mp4');
 assert.equal(hasSeenAgencyIntro(storage,'blocked','/intro.mp4'),true);
});

import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as introApi from '../lib/agency-intro.ts';
const require=createRequire(import.meta.url);
function introHarness(props){
 const slots=[],effects=[];let cursor=0;const exports={};
 const code=ts.transpileModule(readFileSync(new URL('../components/auth/AgencyIntro.tsx',import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 new Function('require','exports',code)(id=>id==='react'?{useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{slots[i]=value;}];},useEffect(fn){effects.push(fn);}}:id==='@/lib/agency-intro'?introApi:id==='./PresentationVideo'?{PresentationVideo:'presentation-video'}:require(id),exports);
 const render=()=>{cursor=0;return exports.AgencyIntro(props);};return{render,effects};
}
test('intro waits for history, survives repeated mount effects, and does not replay after playback or skip',()=>{
 const previous=globalThis.window,rows=new Map();globalThis.window={localStorage:{getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value)}};
 try{
  const props={agencyId:'ui-once',src:'/intro.mp4',title:'Agency',enabled:true};
  const first=introHarness(props);assert.equal(first.render(),null);first.effects[0]();first.effects[0]();
  const video=first.render();assert.equal(video.type,'presentation-video');assert.equal(rows.size,0,'mounting alone is not successful playback');
  video.props.onStarted();assert.equal(rows.size,1);
  const revisit=introHarness(props);revisit.render();revisit.effects[0]();assert.equal(revisit.render(),null);
  const skipped=introHarness({...props,agencyId:'skip-once'});skipped.render();skipped.effects[0]();skipped.render().props.onContinue();assert.equal(skipped.render(),null);
  assert.equal(hasSeenAgencyIntro(globalThis.window.localStorage,'skip-once','/intro.mp4'),true);
  const disabled=introHarness({...props,agencyId:'disabled',enabled:false});disabled.render();disabled.effects[0]();assert.equal(disabled.render(),null);
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
