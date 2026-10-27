import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const code = readFileSync(new URL('../components/auth/WorkspacePropertyMap.tsx',import.meta.url),'utf8')
  .replace('process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim()', "'pk.test-only'");
const compiled = ts.transpileModule(code, {compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const geometry = {type:'Polygon',coordinates:[[[-64.36,-33.13],[-64.34,-33.13],[-64.34,-33.11],[-64.36,-33.11],[-64.36,-33.13]]]};
const feature = {type:'Feature',id:'reference-zone-1',properties:{name:'Zona 1'},geometry};
const savedZone = {id:'agency-zone-abc',name:'Barrio propio',city:'Río Cuarto',geometry:null,latitude:-33.12,longitude:-64.35};
function nodes(tree,predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(item=>nodes(item,predicate));
  return [...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)];
}
async function harness(enabled) {
  const slots=[], effects=[], instances=[];let cursor=0;
  const hooks={
    useRef(value){const index=cursor++;return slots[index]??= {current:value};},
    useState(value){const index=cursor++;if(!(index in slots))slots[index]=typeof value==='function'?value():value;return [slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next;}];},
    useMemo(callback){cursor++;return callback();},
    useEffect(callback){effects.push(callback);},
  };
  class Map {
    events=new globalThis.Map();
    constructor(){instances.push(this);}
    addControl(){} addSource(){} addLayer(){} fitBounds(){} setFeatureState(){} remove(){this.removed=true;}
    on(name,layer,callback){this.events.set(typeof layer==='string'?`${name}:${layer}`:name,callback??layer);}
    getCanvas(){return {style:{}};}
  }
  function WorkspaceAerialExperience(){}
  const exports={};
  new Function('require','exports',compiled)((id)=>{
    if(id==='react')return hooks;
    if(id==='mapbox-gl')return {__esModule:true,default:{Map,supported:()=>true,NavigationControl:class{},AttributionControl:class{}}};
    if(id.endsWith('.module.css'))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
    if(id.endsWith('.css'))return {};
    if(id==='./WorkspaceAerialExperience')return {WorkspaceAerialExperience};
    return require(id);
  },exports);
  const props={title:'Mapa de inmobiliaria',properties:[],zones:[savedZone],enableAerialPresentation:enabled};
  const render=()=>{cursor=0;effects.length=0;return exports.default(props);};
  let tree=render();slots[0].current={};
  const originalFetch=globalThis.fetch, originalObserver=globalThis.ResizeObserver;
  globalThis.fetch=async()=>({ok:true,json:async()=>({type:'FeatureCollection',features:[feature]})});
  globalThis.ResizeObserver=class{observe(){}disconnect(){}};
  let cleanup;
  try{
    cleanup=effects[0]();await new Promise(resolve=>setImmediate(resolve));
    instances[0].events.get('load')();await new Promise(resolve=>setImmediate(resolve));
    tree=render();
    return {render,tree,map:instances[0],presentation:()=>nodes(render(),node=>node.type===WorkspaceAerialExperience),cleanup:()=>{cleanup?.();}};
  }finally{globalThis.fetch=originalFetch;globalThis.ResizeObserver=originalObserver;}
}

test('private-panel opt-in opens the clicked full reference polygon and keeps the base map mounted',async()=>{
  const app=await harness(true);
  try{
    assert.equal(app.presentation().length,0);
    app.map.events.get('click:reference-zones-fill')({features:[{id:feature.id}]});
    const overlays=app.presentation();assert.equal(overlays.length,1);
    assert.deepEqual(overlays[0].props.zone,{id:feature.id,name:feature.properties.name,geometry});
    assert.ok(!app.map.removed);
    overlays[0].props.onClose();assert.equal(app.presentation().length,0);
    assert.ok(!app.map.removed);
    const chip=nodes(app.render(),node=>node.type==='button'&&node.props.children===savedZone.name)[0];
    chip.props.onClick();
    assert.equal(app.presentation()[0].props.zone.id,savedZone.id);
    assert.equal(nodes(app.render(),node=>node.type==='button'&&node.props.children===savedZone.name)[0].props['aria-pressed'],true);
  }finally{app.cleanup();}
});

test('shared-map default still selects boundaries and filters saved zones without opening fictional presentations',async()=>{
  const app=await harness(undefined);
  try{
    app.map.events.get('click:reference-zones-fill')({features:[{id:feature.id}]});
    assert.equal(app.presentation().length,0);
    assert.equal(nodes(app.render(),node=>node.props?.['aria-label']==='Zonas disponibles para la presentación').length,0);
    const chip=nodes(app.render(),node=>node.type==='button'&&node.props.children===savedZone.name)[0];
    chip.props.onClick();assert.equal(app.presentation().length,0);
    assert.equal(nodes(app.render(),node=>node.type==='button'&&node.props.children===savedZone.name)[0].props['aria-pressed'],true);
  }finally{app.cleanup();}
});
