import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const text=t=>t==null||typeof t==='boolean'?'':typeof t!=='object'?String(t):Array.isArray(t)?t.map(text).join(' '):text(t.props?.children);
const nodes=t=>!t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(nodes):[t,...nodes(t.props?.children)];
function load(path,mocks={}) {const output={};const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;new Function('require','exports',code)(id=>mocks[id]??(id.endsWith('.module.css')?{__esModule:true,default:new Proxy({},{get:(_,key)=>key})}:require(id)),output);return output;}
test('sidebar navigation separates operation and administration without changing default navigation',()=>{
 const {AgencySectionTabs}=load('../components/auth/AgencySectionTabs.tsx',{'next/link':{__esModule:true,default:'a'}});
 const props={panelPath:'/panel',activeSection:'map',canManageCollaboration:true,canManageRentals:true,canEdit:true};
 const left=AgencySectionTabs({...props,group:'operation',vertical:true}),right=AgencySectionTabs({...props,group:'administration',vertical:true});
 assert.match(text(left),/Propiedades/);assert.doesNotMatch(text(left),/Barrios|Ofertas/);
 assert.match(text(right),/Barrios/);assert.doesNotMatch(text(right),/Consultas|Estadísticas/);
 assert.match(text(AgencySectionTabs(props)),/Operación.*Administración/);
 assert.doesNotMatch(text(AgencySectionTabs({...props,group:'administration',canEdit:false})),/Ofertas/);
});
test('main route opts into fullscreen shell and map while other pages keep their layout',()=>{
 const source=readFileSync(new URL('../app/inmobiliaria/[agencyId]/panel/page.tsx',import.meta.url),'utf8');
 assert.match(source,/<WorkspaceShell\s+fullscreenMap/);assert.match(source,/<RealAgencyMap\s+fullscreen/);
 const other=readFileSync(new URL('../app/inmobiliaria/[agencyId]/panel/personalizacion/page.tsx',import.meta.url),'utf8');assert.doesNotMatch(other,/<WorkspaceShell\s+fullscreenMap/);
});
test('fullscreen map and drawers use viewport bounds rather than a short centered canvas',()=>{
 const css=readFileSync(new URL('../components/auth/map-workspace-layout.module.css',import.meta.url),'utf8');assert.match(css,/height:\s*100dvh/);assert.match(css,/position:\s*fixed/);assert.match(css,/\.operationPane[^}]*left:/s);assert.match(css,/\.administrationPane[^}]*right:/s);
 const map=readFileSync(new URL('../components/auth/real-agency-map.module.css',import.meta.url),'utf8');assert.match(map,/\.fullscreen\s+\.canvas\s*\{[^}]*inset:\s*0/s);
});

function layoutHarness(wide,administration='administration') {
 const slots=[],effects=[];let cursor=0,focused='';const context={value:null,Provider:'provider'};const media={matches:wide,addEventListener(){},removeEventListener(){}};
 const api=load('../components/auth/MapWorkspaceLayout.tsx',{
  react:{createContext:()=>context,useContext:()=>context.value,useId:()=>'layout-test',useRef(initial){const i=cursor++;return slots[i]??=({current:initial});},useEffect:callback=>effects.push(callback),useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];}},
  'react-dom':{createPortal:(children,host)=>({children,host})},
 });
 const old=globalThis.window;globalThis.window={matchMedia:query=>query.includes('min-width')?media:{matches:!wide}};
 const render=()=>{cursor=0;const tree=api.MapWorkspaceLayout({header:'header',operation:'operation',administration,children:'map'});context.value=tree.props.value;return tree;};
 const aside=side=>nodes(render()).find(node=>node.type==='aside'&&node.props.id.endsWith(`-${side}`));
 const toggle=side=>nodes(render()).find(node=>node.type==='button'&&node.props['aria-controls']?.endsWith(`-${side}`));
 const init=()=>{render();effects[0]();};
 return{api,render,aside,toggle,init,context,focus:()=>focused,setFocus:side=>{toggle(side).props.ref.current={focus:()=>{focused=side;}};},close:()=>{if(old===undefined)delete globalThis.window;else globalThis.window=old;}};
}
test('desktop drawers can coexist, close accessibly, and keep a single portal host',()=>{
 const app=layoutHarness(true);
 try{
  app.init();assert.equal(app.aside('operation').props.hidden,false);assert.equal(app.aside('administration').props.hidden,true);
  app.toggle('administration').props.onClick();assert.equal(app.aside('operation').props.hidden,false);assert.equal(app.aside('administration').props.hidden,false);
  const host={id:'controls-host'};nodes(app.aside('operation')).find(node=>node.props?.ref&&node.type==='div').props.ref(host);app.render();
  assert.deepEqual(app.api.MapSidebarControls({children:'filters'}),{children:'filters',host});
  const operation=app.aside('operation');app.setFocus('operation');operation.props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}});
  assert.equal(app.aside('operation').props.hidden,true);assert.equal(app.focus(),'operation');
 }finally{app.close();}
});
test('small screens expose one drawer at a time without removing map content',()=>{
 const app=layoutHarness(false);
 try{
  app.init();assert.equal(app.aside('operation').props.hidden,true);assert.equal(app.aside('administration').props.hidden,true);
  app.toggle('operation').props.onClick();assert.equal(app.aside('operation').props.hidden,false);
  app.toggle('administration').props.onClick();assert.equal(app.aside('operation').props.hidden,true);assert.equal(app.aside('administration').props.hidden,false);
  assert.match(text(app.render()),/map/);
 }finally{app.close();}
});

test('fullscreen control offsets target CityMap actual map-top wrapper, including the administration drawer',()=>{
 const city=readFileSync(new URL('../components/CityMap.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../components/auth/map-workspace-layout.module.css',import.meta.url),'utf8');
 assert.match(city,/className="map-top"/);
 assert.match(css,/\.viewport\s+:global\(\.map-top\)\s*\{[^}]*top:\s*148px/);
 assert.match(css,/data-administration-open='true'\]\s+:global\(\.map-top\)/);
 assert.doesNotMatch(css,/:global\(\.map-view-switch\)/);
});


test('layout has no administration toggle or drawer when the shell omits that role-only content',()=>{
 const app=layoutHarness(true,null);
 try{app.init();assert.equal(app.toggle('administration'),undefined);assert.equal(app.aside('administration'),undefined);assert.equal(nodes(app.render()).find(node=>node.props?.['data-administration-open']!==undefined).props['data-administration-open'],false);assert.match(text(app.render()),/operation/);}finally{app.close();}
});
