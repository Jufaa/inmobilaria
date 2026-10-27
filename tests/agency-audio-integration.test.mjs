import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as configApi from '../lib/property-tour-config.ts';
import * as areaApi from '../lib/workspace-aerial-presentation.ts';
import { defaultPresentationSettings } from '../lib/agency-presentation.ts';
import { createTourState } from '../lib/property-tour-demo.ts';
const require = createRequire(import.meta.url);
const compile = path => ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
function nodes(tree,predicate){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(item=>nodes(item,predicate));return[...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)];}

test('actual aerial wrapper always plays the property drone before entry, honors replacement clips, and preserves immutable samples',()=>{
 const code=compile('../components/auth/WorkspaceAerialExperience.tsx');
 const slots=[];let cursor=0;
 function GoogleAerialArea(){} function PropertyTourDemo(){} function TourDemoEditor(){}
 const exports={};
 new Function('require','exports',code)(id=>{
  if(id==='react')return{useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{slots[i]=value;}];},useRef:initial=>{const i=cursor++;return slots[i]??={current:initial};},useEffect(){},useMemo:fn=>{cursor++;return fn();}};
  if(id==='@/components/GoogleAerialArea')return{GoogleAerialArea};
  if(id==='@/components/PropertyTourDemo')return{PropertyTourDemo};
  if(id==='@/components/TourDemoEditor')return{TourDemoEditor};
  if(id==='@/lib/property-tour-config')return configApi;
  if(id==='@/lib/workspace-aerial-presentation')return areaApi;
  if(id==='@/lib/property-tour-config')return configApi;
  if(id==='@/lib/workspace-aerial-presentation')return areaApi;
  if(id.endsWith('.module.css'))return{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
  return require(id);
 },exports);
 const props={zone:{id:'centro',name:'Centro',latitude:-33.12,longitude:-64.35},settings:structuredClone(defaultPresentationSettings),pointsOfInterest:[{id:'poi',name:'Escuela',latitude:-33.12,longitude:-64.35,color:'#446655'}],onClose(){}};
 const before=JSON.stringify(configApi.defaultDemoConfig);
 const render=()=>{cursor=0;return exports.WorkspaceAerialExperience(props);};
 const originalDocument=globalThis.document,originalElement=globalThis.HTMLElement;
 globalThis.document={activeElement:null};globalThis.HTMLElement=class{};
 try{
  let aerial=nodes(render(),n=>n.type===GoogleAerialArea)[0];
  assert.equal(aerial.props.pointsOfInterest,props.pointsOfInterest);
  aerial.props.onSelect(aerial.props.area.properties[0].id);
  let tour=nodes(render(),n=>n.type===PropertyTourDemo)[0];
  assert.equal(createTourState(tour.props.initialPropertyId,tour.props.properties).phase,'entering');
  const id=tour.props.initialPropertyId;
  props.settings.properties[id]={droneEnabled:false,videoUrl:'/demo-assets/tours/entrance-02.mp4'};
  tour=nodes(render(),n=>n.type===PropertyTourDemo)[0];
  assert.equal(createTourState(id,tour.props.properties).phase,'entering');
  assert.equal(tour.props.properties.find(p=>p.id===id).entranceVideo,'/demo-assets/tours/entrance-02.mp4');
  delete props.settings;
  tour=nodes(render(),n=>n.type===PropertyTourDemo)[0];
  assert.equal(createTourState(id,tour.props.properties).phase,'entering');
  assert.equal(JSON.stringify(configApi.defaultDemoConfig),before);
 }finally{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;if(originalElement===undefined)delete globalThis.HTMLElement;else globalThis.HTMLElement=originalElement;}
});

test('aerial property tours and their editor use the persisted agency template and save it back',async()=>{
 const code=compile('../components/auth/WorkspaceAerialExperience.tsx');
 const slots=[];let cursor=0;let persisted;
 function GoogleAerialArea(){} function PropertyTourDemo(){} function TourDemoEditor(){}
 const exports={};
 new Function('require','exports',code)(id=>{
  if(id==='react')return{useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},useRef:initial=>{const i=cursor++;return slots[i]??={current:initial};},useEffect(){},useMemo:fn=>{cursor++;return fn();}};
  if(id==='@/components/GoogleAerialArea')return{GoogleAerialArea};
  if(id==='@/components/PropertyTourDemo')return{PropertyTourDemo};
  if(id==='@/components/TourDemoEditor')return{TourDemoEditor};
  if(id==='@/lib/property-tour-config')return configApi;
  if(id==='@/lib/workspace-aerial-presentation')return areaApi;
  if(id.endsWith('.module.css'))return{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
  return require(id);
 },exports);
 const initialConfig=structuredClone(configApi.defaultDemoConfig);
 initialConfig.properties[0].interiorVideo='/demo-assets/tours/interior-02.mp4';
 let parentSaved;
 const props={zone:{id:'centro',name:'Centro',latitude:-33.12,longitude:-64.35},initialConfig,persistDemoConfig:async value=>{persisted=value;return{config:value,error:null};},onConfigSaved:value=>{parentSaved=value;},onClose(){}};
 const render=()=>{cursor=0;return exports.WorkspaceAerialExperience(props);};
 const originalDocument=globalThis.document,originalElement=globalThis.HTMLElement;
 globalThis.document={activeElement:null};globalThis.HTMLElement=class{};
 try{
  let aerial=nodes(render(),n=>n.type===GoogleAerialArea)[0];
  assert.equal(aerial.props.area.properties[0].tour.interiorVideo,initialConfig.properties[0].interiorVideo);
  aerial.props.onEdit();
  let editor=nodes(render(),n=>n.type===TourDemoEditor)[0];
  const updated=structuredClone(initialConfig);updated.properties[0].interiorVideo='/demo-assets/tours/interior-01.mp4';
  assert.equal(await editor.props.onSave(updated),null);
  assert.equal(persisted.properties[0].interiorVideo,updated.properties[0].interiorVideo);
  assert.deepEqual(parentSaved,updated);
 }finally{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;if(originalElement===undefined)delete globalThis.HTMLElement;else globalThis.HTMLElement=originalElement;}
});

test('private personalization preserves branding/access and adds the agency-scoped presentation editor',async()=>{
 const code=compile('../app/inmobiliaria/[agencyId]/panel/personalizacion/page.tsx');
 function WorkspaceShell(){} function BrandingForm(){} function AgencyPresentationSettings(){}
 const calls=[],exports={};
 new Function('require','exports',code)(id=>{
  if(id==='@/lib/agency-access')return{requireAgencyCollaborationAccess:async(slug)=>{calls.push(slug);return{user:{email:'test@example.com'},membership:{agency:{id:'authorized-id',name:'Example'}}};}};
  if(id==='@/lib/prisma')return{prisma:{agencyPresentationConfig:{findUnique:async()=>null}}};
  if(id==='@/lib/agency-presentation')return{defaultPresentationSettings,parsePresentationSettings:value=>value??null};
  if(id==='@/lib/property-tour-config')return configApi;
  if(id==='./presentation-actions')return{savePresentationSettingsAction:async()=>({settings:null,error:null})};
  if(id==='@/components/auth/WorkspaceShell')return{WorkspaceShell};
  if(id==='@/components/auth/AgencyPresentationSettings')return{AgencyPresentationSettings};
  if(id==='./BrandingForm')return{BrandingForm};
  if(id.endsWith('.module.css'))return{__esModule:true,default:{}};
  return require(id);
 },exports);
 const page=await exports.default({params:Promise.resolve({agencyId:'requested-slug'})});
 assert.deepEqual(calls,['requested-slug']);
 assert.equal(page.type,WorkspaceShell);
 assert.equal(nodes(page,n=>n.type===BrandingForm).length,1);
 assert.equal(nodes(page,n=>n.type===AgencyPresentationSettings)[0].props.agencyId,'authorized-id');
});

test('the institutional sample is a real 24-second fast-start MP4, not a missing placeholder',()=>{
 const media=readFileSync(new URL('../public/demo-assets/tours/agency-intro-sample.mp4',import.meta.url));
 assert.equal(media.subarray(4,8).toString(),'ftyp');
 assert.ok(media.indexOf('moov')<media.indexOf('mdat'));
 const header=media.indexOf('mvhd');assert.ok(header>0);
 assert.equal(media[header+4],0);
 assert.equal(media.readUInt32BE(header+20)/media.readUInt32BE(header+16),24);
});
