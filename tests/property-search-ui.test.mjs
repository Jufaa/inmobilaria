import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {defaultExplorerSettings} from '../lib/presentation-explorer.ts';
const require=createRequire(import.meta.url);
const nodes=t=>!t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(nodes):[t,...nodes(t.props?.children)];
const text=t=>t==null||typeof t==='boolean'?'':typeof t==='string'||typeof t==='number'?String(t):Array.isArray(t)?t.map(text).join(' '):text(t.props?.children);
function harness(file,props){
 const slots=[];let cursor=0;const exports={};
 const code=ts.transpileModule(readFileSync(new URL(`../components/auth/${file}.tsx`,import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 new Function('require','exports',code)(id=>id==='react'?{useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];}}:id.endsWith('.module.css')?{__esModule:true,default:{}}:require(id),exports);
 return()=>{cursor=0;return exports[file](props);};
}
test('advanced filter inputs are optional, emit individual criteria and reset together without changing legacy controls',()=>{
 const props={value:{},settings:structuredClone(defaultExplorerSettings),zones:[],advanced:true,onChange:next=>{props.value=next;}};
 const render=harness('PresentationFilters',props);
 const field=label=>nodes(nodes(render()).find(n=>n.type==='label'&&text(n).startsWith(label))).find(n=>['input','select'].includes(n.type));
 for(const [label,key,value] of [['Operación','operation','RENT'],['Superficie mínima','minArea','90'],['Superficie máxima','maxArea','180'],['Dormitorios desde','minBedrooms','2'],['Dormitorios hasta','maxBedrooms','4'],['Baños desde','bathrooms','2'],['Características','features','patio, pileta'],['Estado','status','PUBLISHED'],['Ofertas','offersOnly','yes']]){field(label).props.onChange({target:{value}});assert.equal(props.value[key],value);}
 field('Superficie mínima').props.onChange({target:{value:''}});assert.equal(props.value.minArea,'');
 assert.equal(field('Moneda').props.value,'');
 nodes(render()).find(n=>n.type==='button'&&text(n)==='Limpiar filtros').props.onClick();assert.deepEqual(props.value,{});
 props.advanced=false;assert.equal(field('Moneda').props.value,'USD');assert.equal(nodes(render()).some(n=>n.type==='label'&&text(n).startsWith('Operación')),false);
});
test('marketplace cards show thumbnails, matching metadata, exact selection and optional collapse/pagination',()=>{
 const selected=[];let cleared=false;
 const items=Array.from({length:14},(_,i)=>({id:`p-${i}`,source:i?'example':'real',title:`Casa ${i}`,price:100,currency:'USD',area:90,bedrooms:2,bathrooms:1,features:[],garage:false,offer:false,image:i?undefined:'/photo.jpg'}));
 const render=harness('PropertySearchResults',{items,onSelect:item=>selected.push(item),onClear:()=>{cleared=true;}});
 assert.equal(nodes(render()).filter(n=>n.type==='img').length,1);
 assert.equal(nodes(render()).filter(n=>n.type==='button'&&nodes(n).some(c=>c.type==='b')).length,12);
 nodes(render()).find(n=>n.type==='button'&&text(n).trim().startsWith('Casa 0')).props.onClick();assert.equal(selected[0],items[0]);
 nodes(render()).find(n=>n.type==='button'&&text(n)==='Ver más propiedades').props.onClick();assert.equal(nodes(render()).filter(n=>n.type==='button'&&nodes(n).some(c=>c.type==='b')).length,14);
 nodes(render()).find(n=>n.type==='button'&&text(n)==='Limpiar búsqueda y filtros').props.onClick();assert.equal(cleared,true);
 nodes(render()).find(n=>n.props?.['aria-label']==='Ocultar resultados').props.onClick();assert.equal(render().type,'button');
});
test('search overlays are present inside the native aerial dialog and controls precede navigation',()=>{
 const shell=readFileSync(new URL('../components/auth/MapWorkspaceLayout.tsx',import.meta.url),'utf8');assert.ok(shell.indexOf('ref={setControlsHost}')<shell.indexOf('/>{operation}'));
 const aerial=readFileSync(new URL('../components/auth/WorkspaceAerialExperience.tsx',import.meta.url),'utf8');assert.match(aerial,/<GoogleAerialArea[^>]*searchControls=\{searchControls\} searchResults=\{searchResults\}/);
 const google=readFileSync(new URL('../components/GoogleAerialArea.tsx',import.meta.url),'utf8');assert.match(google,/searchControls&&<aside/);assert.match(google,/searchResults&&<div/);
});

test('map filters have an independent map button outside the operation sidebar',()=>{
 const source=readFileSync(new URL('../components/auth/RealAgencyMap.tsx',import.meta.url),'utf8');
 assert.match(source,/<MapSidebarControls>\{operationExtras\}<\/MapSidebarControls>/);
 assert.match(source,/data-map-filter-controls><MapSearchControls>\{filterControls\}/);
 assert.doesNotMatch(source,/<MapSidebarControls>\{sidebarControls\}/);
});

test('filter button stays pinned to the top-left edge instead of moving with operation',()=>{
 const css=readFileSync(new URL('../components/auth/real-agency-map.module.css',import.meta.url),'utf8');
 assert.match(css,/\.filterPosition\s*\{[^}]*top:\s*16px;[^}]*left:\s*16px/);
 const shell=readFileSync(new URL('../components/auth/map-workspace-layout.module.css',import.meta.url),'utf8');
 assert.doesNotMatch(shell,/data-operation-open[^\n]*data-map-filter-controls/);
});
