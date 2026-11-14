import * as searchApi from '../lib/property-search.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import {defaultDemoConfig, zonesForConfig} from '../lib/property-tour-config.ts';
import * as tourApi from '../lib/property-tour-demo.ts';
import {agencyOfferTargets} from '../lib/agency-offer-targets.ts';
import {presentationZones,effectivePropertyKindColors} from '../lib/presentation-explorer.ts';
const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const result = {};
  new Function('require', 'exports', code)(id => mocks[id] ?? (id.endsWith('.module.css') ? { default: {}, __esModule: true } : require(id)), result);
  return result;
}
const all = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(all) : [tree, ...all(tree.props?.children)];
const text = tree => tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : Array.isArray(tree) ? tree.map(text).join(' ') : text(tree.props?.children);
const property = { id: 'real-cuid', title: 'Casa real', address: 'Calle 100', neighborhood: 'Centro', price: 100, currency: 'USD', area: 50, bedrooms: 1, bathrooms: 1, status: 'DRAFT', type: 'HOUSE', operation: 'SALE', features: [], description: 'Descripción real', media: [{id:'photo',kind:'PHOTO',url:'https://photos.example/a.jpg'}] };
test('replacement artwork retains selectable zones and property markers', () => {
  const { RealArtworkMap } = load('../components/auth/RealArtworkMap.tsx', {
    react: { useState: initial => [initial, () => {}] },
    '@/lib/map-rectangle-selection': { clientPoint() {} },
  });
  const selected = [];
  const bounds = { west: -65, east: -64, south: -34, north: -33 };
  const tree = RealArtworkMap({
    appearance: { bounds, artworkUrl: 'https://example.com/custom-map.webp' },
    areas: [{ id: 'custom-zone', label: 'Zona propia', bounds: { west: -64.8, east: -64.6, south: -33.8, north: -33.6 } }],
    areaColors: { 'custom-zone': '#112233' }, points: [],
    markers: [{ id: 1, address: 'Casa real', latitude: -33.7, longitude: -64.7, showPrice: false }],
    onAreaSelect: id => selected.push(id), onSelect: id => selected.push(id),
  });
  assert.equal(all(tree).find(node => node.type === 'img').props.src, 'https://example.com/custom-map.webp');
  const buttons = all(tree).filter(node => node.type === 'button');
  assert.equal(buttons.length, 2);
  for (const button of buttons) {
    assert.equal(button.props.disabled, false);
    button.props.onClick({ stopPropagation() {} });
  }
  assert.deepEqual(selected, ['custom-zone', 1]);
});
test('focused property detail contains actual selected record only, without sample sidebar', () => {
  const { RealPropertyDetail } = load('../components/auth/RealPropertyDetail.tsx',{'../PropertyWhatsAppButton':{PropertyWhatsAppButton:'whatsapp-button'}});
  const tree = RealPropertyDetail({ property, onBack() {} });
  assert.match(text(tree), /Casa real/);
  assert.match(text(tree), /Calle 100/);
  assert.equal(all(tree).filter(n => n.type === 'aside').length, 0);
  assert.deepEqual(all(tree).filter(n => n.type === 'img').map(n => n.props.src), ['https://photos.example/a.jpg']);
  assert.doesNotMatch(text(tree), /Elige un espacio|DEMO|Tu próxima historia|Plantilla/);
});
test('real creation form captures location hidden and defaults to draft, not templates', () => {
  const { RealMapPropertyForm } = load('../components/auth/RealMapPropertyForm.tsx', {
    react: { ...require('react'), useState: value => [value, () => {}], useRef: value => ({current:value}) },
    '@vercel/blob/client': {upload(){}},
    './Property360Upload':{Property360Upload:'360-upload'},
  });
  const tree = RealMapPropertyForm({ agencySlug:'agency', agencyId:'canonical', position:[-64,-33], photosEnabled:false, onCreate() {}, onSaved() {}, onCancel() {} });
  for (const name of ['latitude','longitude']) assert.equal(all(tree).find(n => n.props?.name === name).props.type, 'hidden');
  assert.equal(all(tree).find(n => n.props?.name === 'status').props.defaultValue, 'DRAFT');
  assert.equal(all(tree).find(n => n.props?.type === 'file').props.disabled, true);
  assert.doesNotMatch(text(tree), /Latitud|Longitud|plantilla|MP4/);
});
test('real map has actual IDs, placement action, no generated fictional listings', () => {
  const source = readFileSync(new URL('../components/auth/RealAgencyMap.tsx', import.meta.url),'utf8');
  assert.match(source, /Agregar propiedad/);
  assert.match(source, /onMapPick=/);
  assert.doesNotMatch(source, /createPresentationArea|PropertyTourDemo/);
  assert.match(source, /RealPropertyDetail/);
  const page = readFileSync(new URL('../app/inmobiliaria/[agencyId]/panel/page.tsx', import.meta.url),'utf8');
  assert.match(page, /listAgencyProperties/);
  assert.match(page, /<RealAgencyMap/);
});

function mapHarness(initialProperties = []) {
  const slots = []; let cursor = 0, refreshed = 0;
  const hooks = { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; }, useRef(initial) { const i = cursor++; return slots[i] ??= {current:initial}; }, useEffect() {}, useMemo: fn => fn() };
  const preferences = { name:'', showLegend:true, showPrices:false, showDetails:false, popupColor:'#ffffff', popupTextColor:'#222222', zones:[], listings:{}, filters:{zone:true,price:true,kind:true,bedrooms:true,garage:true}, kindColors:{Casa:'#123456'} };
  const { RealAgencyMap } = load('../components/auth/RealAgencyMap.tsx', {
    react:hooks, 'next/dynamic':{__esModule:true,default:()=> 'city-map'}, 'next/navigation':{useRouter:()=>({refresh:()=>refreshed++})},
    '@/lib/presentation-explorer':{ defaultExplorerSettings:preferences, effectivePropertyKindColors, presentationZones, enabledPresentationFilters:()=>({}), matchesPresentationFilters:item=>!item.hidden },
    '@/lib/property-tour-config':{zonesForConfig}, './WorkspaceAerialExperience':{WorkspaceAerialExperience:'aerial-experience'},
    './MapWorkspaceLayout':{MapSidebarControls:'sidebar-controls'},'./MapSearchControls':{MapSearchControls:'map-filters'},'./AgencyIntro':{AgencyIntro:'agency-intro'},
    '@/lib/property-search':searchApi,'./PropertySearchResults':{PropertySearchResults:'search-results'},
    './PropertyOffersPopup':{PropertyOffersPopup:'offers-popup'}, '@/lib/agency-offer-targets':{agencyOfferTargets},
    './RealMapPropertyForm':{RealMapPropertyForm:'property-form'}, './RealPropertyDetail':{RealPropertyDetail:'property-detail'}, './RealArtworkMap':{RealArtworkMap:'artwork-map'}, './PresentationFilters':{PresentationFilters:'filters'}, './PresentationVideo':{PresentationVideo:'video'},
  });
  const props = { agencySlug:'slug', agencyId:'canonical', agencyName:'Agency', properties:initialProperties, settings:{map:{mode:'interactive'},intro:{enabled:false,videoUrl:''},points:[],explorer:preferences}, onCreate:async()=>({}), onUpdate:async()=>({}), photosEnabled:false, canCustomize:true };
  const render = () => { cursor=0; return RealAgencyMap(props); };
  const find = type => all(render()).find(node=>node.type===type);
  return { render,find,props,refreshed:()=>refreshed };
}
test('real map button arms one point, opens the short form and shows only the saved real listing', () => {
  const app=mapHarness();
  all(app.render()).find(node=>node.type==='button' && text(node)==='Agregar propiedad').props.onClick();
  app.find('city-map').props.onMapPick([-64.31,-33.11]);
  const form=app.find('property-form');
  assert.deepEqual(form.props.position,[-64.31,-33.11]);
  assert.equal(app.find('city-map'),undefined);
  form.props.onSaved({...property,latitude:-33.11,longitude:-64.31});
  assert.equal(app.find('property-detail').props.property.id,'real-cuid');
  assert.equal(app.find('city-map'),undefined);
  assert.equal(app.refreshed(),1);
  app.find('property-detail').props.onBack();
  const marker=app.find('city-map').props.properties[0];
  assert.equal(marker.showPrice,false);
  app.find('city-map').props.onSelect(marker.id);
  app.find('property-detail').props.onEdit();
  assert.equal(app.find('property-form').props.initial.id,'real-cuid');
  app.find('property-form').props.onCancel();
  assert.equal(app.find('property-detail').props.property.id,'real-cuid');
});
test('canceling property placement cannot create a record and map markers preserve real catalogue identity', () => {
  const app=mapHarness([{...property,latitude:-33,longitude:-64}, {...property,id:'second',title:'Second',latitude:-33.1,longitude:-64.1}]);
  const markers=app.find('city-map').props.properties;
  assert.notEqual(markers[0].id,markers[1].id);
  app.find('city-map').props.onSelect(markers[1].id);
  assert.equal(app.find('property-detail').props.property.id,'second');
  app.find('property-detail').props.onBack();
  all(app.render()).find(node=>node.type==='button' && text(node)==='Agregar propiedad').props.onClick();
  all(app.render()).find(node=>node.type==='button' && text(node)==='Cancelar').props.onClick();
  assert.equal(app.find('city-map').props.onMapPick,undefined);
  assert.equal(app.find('city-map').props.properties.length,2);
  assert.equal(app.refreshed(),0);
});
test('editing reuses existing business values and never removes existing photos', () => {
  const {RealMapPropertyForm}=load('../components/auth/RealMapPropertyForm.tsx', {react:{...require('react'),useState:v=>[v,()=>{}],useRef:v=>({current:v})},'@vercel/blob/client':{upload(){}},'./Property360Upload':{Property360Upload:'360-upload'}});
  const tree=RealMapPropertyForm({agencySlug:'slug',agencyId:'canonical',position:[-64,-33],photosEnabled:true,initial:property,onCreate(){},onSaved(){},onCancel(){}});
  const field=name=>all(tree).find(node=>node.props?.name===name);
  assert.equal(field('title').props.defaultValue,'Casa real');
  assert.equal(field('price').props.defaultValue,100);
  assert.equal(field('area').props.defaultValue,50);
  assert.equal(field('status').props.defaultValue,'DRAFT');
  assert.match(text(tree),/conservan las\s+1\s+fotos/);
});

test('main map retains examples, zone focus and reference pins without replacing real listing actions', () => {
  const app=mapHarness([{...property,latitude:-33,longitude:-64}]);
  app.props.exampleConfig=defaultDemoConfig;
  app.props.settings.explorer.zones=null;
  app.props.settings.points=[{id:'reference',name:'Plaza',latitude:-33.12,longitude:-64.35,color:'#123456'}];
  const initial=app.find('city-map');
  assert.equal(initial.props.areas.length,2);
  assert.equal(initial.props.properties.length,0,'overview must not contain property pins');
  assert.deepEqual(initial.props.pointsOfInterest,[],'reference pins belong only in the aerial view');
  initial.props.onAreaSelect(initial.props.areas[0].id);
  const aerial=app.find('aerial-experience');
  assert.equal(aerial.props.zone.id,initial.props.areas[0].id);
  assert.equal(aerial.props.initialConfig,defaultDemoConfig);
  assert.ok(app.find('city-map').props.zoneRevision>initial.props.zoneRevision);
  assert.equal(app.find('city-map').props.areas.length,1,'camera fits the selected zone');
  aerial.props.onClose();
  assert.equal(app.find('aerial-experience'),undefined);
  assert.equal(app.find('city-map').props.areas.length,2);
  app.find('city-map').props.onAreaSelect(initial.props.areas[0].id);
  const controls=app.find('aerial-experience').props.canvasActions.managementControls;
  all(controls).find(node=>node.type==='button' && text(node)==='Agregar propiedad').props.onClick();
  app.find('aerial-experience').props.canvasActions.onMapPick([-64.32,-33.12]);
  assert.deepEqual(app.find('aerial-experience').props.canvasActions.managementPanel.props.position,[-64.32,-33.12]);
});
test('illustrated zone links include unlocated real properties, exclude hidden ones and preserve catalogue coordinates', () => {
  const record = { ...property, latitude: null, longitude: null };
  const app = mapHarness([record, { ...record, id: 'hidden', title: 'Hidden' }]);
  app.props.exampleConfig = defaultDemoConfig;
  app.props.settings.explorer.zones = null;
  app.props.settings.explorer.listings.hidden = { hidden: true };
  const zone = app.find('city-map').props.areas[0];
  app.props.settings.zoneMaps = { [zone.id]: { mode: 'illustrated', pins: [{ source: 'real', propertyId: record.id, x: .3, y: .7 }, { source: 'real', propertyId: 'hidden', x: .5, y: .5 }] } };
  app.find('city-map').props.onAreaSelect(zone.id);
  const aerial = app.find('aerial-experience');
  assert.deepEqual(aerial.props.artworkProperties.map(target => target.propertyId), [record.id]);
  aerial.props.canvasActions.onCatalogueSelect(record.id);
  assert.equal(app.find('property-detail').props.property.id, record.id);
  assert.equal(record.latitude, null);
  assert.equal(record.longitude, null);
});
test('main page hydrates persisted examples without removing the real catalogue or membership guard', () => {
  const source=readFileSync(new URL('../app/inmobiliaria/[agencyId]/panel/page.tsx',import.meta.url),'utf8');
  assert.match(source,/exampleConfig=\{parseDemoConfig\(presentationConfig\?\.demoTourConfig\) \?\? defaultDemoConfig\}/);
  assert.match(source,/persistDemoConfig=\{saveDemoConfigAction\.bind\(null, agencyId\)\}/);
});

test('focused example interior removes the other-property sidebar while legacy tours retain it', () => {
  let phase='inside';
  const {PropertyTourDemo}=load('../components/PropertyTourDemo.tsx', {
    react:{...require('react'),useReducer:()=>[{propertyId:tourApi.tourProperties[0].id,phase,sceneIndex:0,mode:'video'},()=>{}],useState:value=>[value,()=>{}],useRef:value=>({current:value}),useEffect(){}},
    'next/dynamic':{__esModule:true,default:()=> 'panorama'},'next/link':{__esModule:true,default:'a'},
    'lucide-react':new Proxy({}, {get:()=>()=>null}), '@/lib/property-tour-demo':tourApi, './BuildingTourEntry':{BuildingTourEntry:'entry'}, './auth/PropertySummaryEditor':{PropertySummaryEditor:'summary-editor'},
  });
  const selected=tourApi.tourProperties[0];
  const tree=PropertyTourDemo({initialPropertyId:selected.id,focused:true});
  assert.equal(all(tree).filter(node=>node.type==='aside').length,0);
  assert.equal(all(tree).find(node=>node.type==='h1').props.children,selected.title);
  assert.doesNotMatch(text(tree),/Elige un espacio|Tu próxima historia empieza adentro/);
  assert.equal(all(PropertyTourDemo()).filter(node=>node.type==='aside').length,1,'legacy default is unchanged');
  phase='building';
  assert.deepEqual(PropertyTourDemo({focused:true}).props.properties.map(item=>item.id),[selected.id]);
  assert.equal(PropertyTourDemo().props.properties.length,2);
});
test('zone transition keeps examples and returns to the complete overview', () => {
  const app=mapHarness();app.props.exampleConfig=defaultDemoConfig;app.props.settings.explorer.zones=null;
  const zone=zonesForConfig(defaultDemoConfig)[0];
  app.props.settings.zones={[zone.id]:{transitionEnabled:true,videoUrl:'/demo-assets/tours/location-01.mp4'}};
  app.find('city-map').props.onAreaSelect(zone.id);
  assert.equal(app.find('aerial-experience'),undefined);
  const video=app.find('video');assert.equal(video.props.maxSeconds,4);
  video.props.onContinue();
  assert.equal(app.find('video'),undefined);
  assert.equal(app.find('aerial-experience').props.zone.id,zone.id);
  app.find('aerial-experience').props.onClose();
  assert.equal(app.find('city-map').props.areas.length,2);
});

test('aerial navigation focuses another zone directly and keeps pin management after the video', () => {
  const app=mapHarness([{...property,latitude:-33.12,longitude:-64.35}]);app.props.exampleConfig=defaultDemoConfig;app.props.settings.explorer.zones=null;
  const zones=app.find('city-map').props.areas;
  app.find('city-map').props.onAreaSelect(zones[0].id);
  const aerial=app.find('aerial-experience');
  assert.equal(typeof aerial.props.onZoneSelect,'function');
  aerial.props.onZoneSelect(zones[1].id);
  assert.equal(app.find('aerial-experience').props.zone.id,zones[1].id);
  assert.equal(app.find('city-map').props.areas[0].id,zones[1].id);
  assert.equal(app.find('video'),undefined,'direct zone navigation does not replay a video');
});

test('aerial property creation is the only pin workflow and read-only users have no edit controls', () => {
  const app=mapHarness();app.props.exampleConfig=defaultDemoConfig;app.props.settings.explorer.zones=null;
  app.props.settings.points=[{id:'old-reference',name:'Saved point',latitude:-33.121,longitude:-64.351,color:'#123456'}];
  app.find('city-map').props.onAreaSelect(app.find('city-map').props.areas[0].id);
  const aerial=app.find('aerial-experience');
  assert.deepEqual(aerial.props.pointsOfInterest,[],'old reference data stay stored but are not displayed');
  assert.match(text(aerial.props.canvasActions.managementControls),/Agregar propiedad/);
  assert.doesNotMatch(text(aerial.props.canvasActions.managementControls),/Agregar chincheta|interés/);
  app.props.canCustomize=false;
  assert.equal(app.find('aerial-experience').props.canvasActions.managementControls,undefined);
  assert.equal(app.find('aerial-experience').props.canvasActions.onMapPick,undefined);
  assert.equal(app.find('aerial-experience').props.onSaveExampleDetails,undefined);
});

test('aerial zone selector and previous/next buttons target the requested zone and are absent for legacy callers', () => {
  const api=load('../components/auth/WorkspaceAerialExperience.tsx',{
    react:{useState:value=>[value,()=>{}],useRef:value=>({current:value}),useEffect(){},useMemo:fn=>fn()},
    'lucide-react':{ArrowLeft:()=>null},'@/components/GoogleAerialArea':{GoogleAerialArea:'google-area'},'@/components/PropertyTourDemo':{PropertyTourDemo:'example-tour'},'@/components/TourDemoEditor':{TourDemoEditor:'tour-editor'},
    '@/lib/property-tour-config':{defaultDemoConfig},'@/lib/workspace-aerial-presentation':{createPresentationArea:()=>({properties:[]})},
    '@/lib/presentation-listings':{visiblePresentationArea:()=>({properties:[]})},'@/lib/presentation-explorer':{defaultExplorerSettings:{}},'./PresentationFilters':{PresentationFilters:'filters'},
    './ZoneImageMap':{ZoneImageMap:'zone-image-map'},
  });
  const zones=zonesForConfig(defaultDemoConfig), targets=[];
  const props={zone:{id:zones[0].id,name:zones[0].label},onClose(){},filterZones:zones,onZoneSelect:id=>targets.push(id)};
  const view=api.WorkspaceAerialExperience(props);
  const google=all(view).find(node=>node.type==='google-area');
  const navigation=google.props.zoneNavigation;
  const selector=all(navigation).find(node=>node.type==='select');
  assert.equal(selector.props.value,zones[0].id);
  selector.props.onChange({target:{value:zones[1].id}});
  all(navigation).find(node=>node.props?.['aria-label']==='Zona siguiente').props.onClick();
  all(navigation).find(node=>node.props?.['aria-label']==='Zona anterior').props.onClick();
  assert.deepEqual(targets,[zones[1].id,zones[1].id,zones[1].id]);
  assert.equal(all(api.WorkspaceAerialExperience({...props,onZoneSelect:undefined})).find(node=>node.type==='google-area').props.zoneNavigation,undefined);
});

test('production overview editor no longer offers reference-pin placement before the zone video', () => {
  const source=readFileSync(new URL('../components/auth/PresentationExplorerSettings.tsx',import.meta.url),'utf8');
  assert.match(source,/points=\{realProperties \? \[\] : settings.points\}/);
  assert.match(source,/onPointsChange=\{realProperties \? undefined : onPointsChange\}/);
});

test('focused example view displays price and features, with edit control only when authorized callback is supplied',()=>{
  const source=readFileSync(new URL('../components/PropertyTourDemo.tsx',import.meta.url),'utf8');
  assert.match(source,/aria-label="Precio y características de la propiedad"/);
  assert.match(source,/onSaveDetails&&<button/);
  assert.match(source,/phase:'entering'/);
});

test('authorized sample price edits persist as example preferences without creating real records', async()=>{
  const app=mapHarness();app.props.exampleConfig=defaultDemoConfig;app.props.settings.explorer.zones=null;
  const writes=[];let created=0;app.props.onCreate=async()=>{created++;return{};};app.props.persistSettings=async settings=>{writes.push(settings);return{settings,error:null};};
  const zone=app.find('city-map').props.areas[0];app.find('city-map').props.onAreaSelect(zone.id);
  const id=agencyOfferTargets([],app.props.settings,defaultDemoConfig).find(target=>target.source==='example').id;
  assert.equal(await app.find('aerial-experience').props.onSaveExampleDetails(id,{title:'Ejemplo modificado',amount:250,currency:'ARS',area:85,bedrooms:2,bathrooms:1,features:['Patio']}),null);
  assert.equal(created,0);assert.equal(writes.length,1);
  const saved=writes[0].explorer.listings[id];assert.equal(saved.amount,250);assert.equal(saved.title,'Ejemplo modificado');assert.deepEqual(saved.features,['Patio']);
  assert.equal(app.find('aerial-experience').props.settings.explorer.listings[id].currency,'ARS');
});

test('focused entry waits for the actual motion preference before starting instead of skipping the entrance',()=>{
  const slots=[],effects=[];let cursor=0;
  const hooks={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useRef:value=>({current:value}),useEffect:callback=>effects.push(callback),useReducer:(reducer,initial,initialize)=>[initialize(initial),()=>{}]};
  const {PropertyTourDemo}=load('../components/PropertyTourDemo.tsx',{react:hooks,'next/dynamic':{__esModule:true,default:()=>null},'next/link':{__esModule:true,default:'a'},'lucide-react':new Proxy({},{get:()=>()=>null}),'@/lib/property-tour-demo':tourApi,'./BuildingTourEntry':{BuildingTourEntry:'entry'},'./auth/PropertySummaryEditor':{PropertySummaryEditor:'summary-editor'}});
  const props={focused:true,initialPropertyId:tourApi.tourProperties[0].id};
  const render=()=>{cursor=0;return PropertyTourDemo(props);};
  assert.equal(render().props.role,'status');
  const previous=globalThis.window;globalThis.window={matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})};
  try{effects[0]();const entry=render();assert.equal(entry.type,'entry');assert.equal(entry.props.entering,true);assert.equal(entry.props.reducedMotion,false);}finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});

test('explicit example offer selection clears conflicting visitor filters before opening its target',()=>{
  const app=mapHarness();app.props.exampleConfig=defaultDemoConfig;app.props.settings.explorer.zones=null;
  const target=agencyOfferTargets([],app.props.settings,defaultDemoConfig).find(item=>item.source==='example');
  app.props.settings.explorer.offers=[{id:'offer-1',source:'example',propertyId:target.id,title:'Oferta',description:'',price:100,currency:'USD',enabled:true}];
  const promotedOffer=app.find('offers-popup');
  app.find('filters').props.onChange({min:'999999999',kind:'Lote',bedrooms:'50',garage:'yes'});
  promotedOffer.props.onSelect(target);
  const aerial=app.find('aerial-experience');
  assert.deepEqual(aerial.props.filters,{});
  assert.equal(aerial.props.searchResults,null);
  assert.equal(aerial.props.initialPropertyId,target.id);
});

test('an example removed by filters returns a safe unavailable view rather than dereferencing missing scenes',()=>{
  const {PropertyTourDemo}=load('../components/PropertyTourDemo.tsx',{
    react:{useReducer:(reducer,id,initialize)=>[initialize(id),()=>{}],useState:value=>[value,()=>{}],useRef:value=>({current:value}),useEffect(){}},
    'next/dynamic':{__esModule:true,default:()=>null},'next/link':{__esModule:true,default:'a'},'lucide-react':new Proxy({},{get:()=>()=>null}),'@/lib/property-tour-demo':tourApi,'./BuildingTourEntry':{BuildingTourEntry:'entry'},'./auth/PropertySummaryEditor':{PropertySummaryEditor:'summary-editor'},
  });
  let returned=false;const view=PropertyTourDemo({focused:true,initialPropertyId:'missing-example',properties:[],onReturn:()=>{returned=true;}});
  assert.match(text(view),/no está disponible/);
  all(view).find(node=>node.type==='button').props.onClick();assert.equal(returned,true);
});

test('fullscreen search filters float outside operation and selection opens the matched property',()=>{
  const app=mapHarness([{...property,latitude:-33.12,longitude:-64.35}]);app.props.fullscreen=true;
  const sidebar=app.find('sidebar-controls');assert.ok(sidebar);assert.equal(all(sidebar).some(node=>node.type==='filters'),false);assert.equal(all(app.render()).filter(node=>node.type==='filters').length,1);
  const search=all(app.find('map-filters')).find(node=>node.type==='input'&&node.props.type==='search');
  search.props.onChange({target:{value:'CASA REAL'}});
  const results=app.find('search-results');assert.ok(results);assert.equal(results.props.items[0].title,'Casa real');
  results.props.onSelect(results.props.items[0]);assert.equal(app.find('property-detail').props.property.id,'real-cuid');
});


test('filtered marketplace selection preserves criteria and forwards matching IDs inside the aerial dialog',()=>{
 const app=mapHarness([]);app.props.fullscreen=true;app.props.exampleConfig=defaultDemoConfig;app.props.settings.explorer.zones=null;
 const input=all(app.find('map-filters')).find(node=>node.type==='input'&&node.props.type==='search');input.props.onChange({target:{value:'luz'}});
 const results=app.find('search-results');assert.ok(results.props.items.length);const target=results.props.items[0];
 results.props.onSelect(target);
 const aerial=app.find('aerial-experience');assert.equal(aerial.props.initialPropertyId,target.id);assert.ok(aerial.props.matchedExampleIds.includes(target.id));assert.ok(aerial.props.searchControls);assert.ok(aerial.props.searchResults);
 assert.equal(all(app.find('map-filters')).find(node=>node.type==='input'&&node.props.type==='search').props.value,'luz');
});


test('optional area filtering updates map markers and marketplace results together and clears cleanly',()=>{
 const app=mapHarness([{...property,latitude:-33.12,longitude:-64.35}]);app.props.fullscreen=true;
 assert.equal(app.find('city-map').props.properties.length,1);
 app.find('filters').props.onChange({minArea:'999999'});
 assert.equal(app.find('city-map').props.properties.length,0);assert.equal(app.find('search-results').props.items.length,0);
 app.find('search-results').props.onClear();assert.equal(app.find('city-map').props.properties.length,1);assert.equal(app.find('search-results'),undefined);
});

test('agency catalogue permission allows real editing but not example or advanced customization',()=>{
 const app=mapHarness([{...property,latitude:-33.12,longitude:-64.35}]);app.props.canCustomize=false;app.props.canManageCatalogue=true;
 const selected=app.find('city-map');selected.props.onSelect(selected.props.properties[0].id);
 assert.equal(typeof app.find('property-detail').props.onEdit,'function');app.find('property-detail').props.onEdit();assert.ok(app.find('property-form'));
 const examples=mapHarness([]);examples.props.exampleConfig=defaultDemoConfig;examples.props.settings.explorer.zones=null;examples.props.canCustomize=false;examples.props.canManageCatalogue=true;
 examples.find('city-map').props.onAreaSelect('centro');const aerial=examples.find('aerial-experience');
 assert.equal(aerial.props.canEdit,false);assert.equal(aerial.props.onSaveExampleDetails,undefined);assert.ok(aerial.props.canvasActions.managementControls);
});
test('legend swatches retain exact selected category backgrounds independently from text color',()=>{
 const app=mapHarness([]);app.props.fullscreen=true;app.props.settings.explorer.kindColors={Casa:'#ee1100',Departamento:'#0044cc',PH:'#aa22cc',Lote:'#aa8800'};
 const colors=all(app.find('sidebar-controls')).filter(node=>node.type==='i').map(node=>node.props.style.backgroundColor);
 assert.ok(colors.includes('#ee1100'));assert.ok(colors.includes('#0044cc'));assert.ok(colors.includes('#aa22cc'));
});

test('zone navigation never starts a search and explicit filters stay inside the aerial modal', () => {
  const app = mapHarness([]);
  app.props.fullscreen = true;
  app.props.exampleConfig = defaultDemoConfig;
  app.props.settings.explorer.zones = null;
  const zones = app.find('city-map').props.areas;
  app.find('city-map').props.onAreaSelect(zones[0].id);
  assert.equal(app.find('aerial-experience').props.searchResults, null);
  app.find('aerial-experience').props.onZoneSelect(zones[1].id);
  assert.equal(app.find('aerial-experience').props.searchResults, null);
  app.find('aerial-experience').props.onFiltersChange({ kind: 'Casa' });
  const aerial = app.find('aerial-experience');
  assert.ok(aerial.props.searchResults);
  assert.equal(all(app.render()).filter(node => node.props?.['data-map-search-results']).length, 0);
  aerial.props.searchResults.props.onClear();
  assert.equal(app.find('aerial-experience').props.searchResults, null);
});

test('plan pins obey selected zone, price and text filters and route selected real records', () => {
 const unlocated={...property,id:'unlocated',title:'Affordable home',price:100,latitude:null,longitude:null};
 const costly={...unlocated,id:'costly',title:'Expensive home',price:900000};
 const app=mapHarness([unlocated,costly]); app.props.exampleConfig=defaultDemoConfig;app.props.settings.explorer.zones=null;
 const zones=app.find('city-map').props.areas; const zone=zones[0];
 app.props.settings.zoneMaps={[zone.id]:{mode:'illustrated',pins:[unlocated,costly].map(p=>({source:'real',propertyId:p.id,x:.3,y:.6}))}};
 app.find('city-map').props.onAreaSelect(zone.id);
 const filters=all(app.find('aerial-experience').props.searchControls).find(n=>n.type==='filters');
 filters.props.onChange({zone:zone.id,max:'500'});
 assert.deepEqual(app.find('aerial-experience').props.artworkProperties.map(p=>p.propertyId),['unlocated']);
 const controls=app.find('aerial-experience').props.searchControls;
 all(controls).find(n=>n.type==='input'&&n.props.type==='search').props.onChange({target:{value:'nothing matches'}});
 assert.deepEqual(app.find('aerial-experience').props.artworkProperties,[]);
 all(app.find('aerial-experience').props.searchControls).find(n=>n.type==='input'&&n.props.type==='search').props.onChange({target:{value:'Affordable'}});
 assert.equal(app.find('aerial-experience').props.artworkProperties[0].propertyId,'unlocated');
 app.find('aerial-experience').props.canvasActions.onCatalogueSelect('unlocated');
 assert.equal(app.find('property-detail').props.property.id,'unlocated');
 assert.equal(unlocated.latitude,null);assert.equal(unlocated.longitude,null);
});
