import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {defaultPresentationSettings} from '../lib/agency-presentation.ts';
import {resolvePropertyOffers} from '../lib/property-offers.ts';
const require=createRequire(import.meta.url);
const nodes=t=>!t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(nodes):[t,...nodes(t.props?.children)];
function harness(path,props,mocks={}) {
 const slots=[];let cursor=0;const exports={};
 const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 new Function('require','exports',code)(id=>mocks[id]??(id==='react'?{useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];}}:id.endsWith('.module.css')?{__esModule:true,default:{}}:require(id)),exports);
 const render=()=>{cursor=0;return Object.values(exports)[0](props);};return{render};
}
test('offers admin selects the target currency and persists only explicit offer settings',async()=>{
 const writes=[];const props={initialSettings:structuredClone(defaultPresentationSettings),targets:[{id:'real-1',source:'real',title:'Casa real',price:1200,currency:'ARS'}],onPersist:async settings=>{writes.push(settings);return{settings,error:null};}};
 const app=harness('../components/auth/AgencyOffersManager.tsx',props,{'./PanelColorPicker':{PanelColorPicker:'PanelColorPicker'},'@/lib/presentation-explorer':{defaultExplorerSettings:{listings:{},kindColors:{}}}});
 nodes(app.render()).find(n=>n.type==='select'&&!n.props.name).props.onChange({target:{value:'real|real-1'}});
 assert.equal(nodes(app.render()).find(n=>n.props?.name==='currency').props.value,'ARS');
 nodes(app.render()).find(n=>n.type==='PanelColorPicker').props.onChange('#2563eb');
 const Original=globalThis.FormData;
 globalThis.FormData=class{get(key){return{title:'Oferta nueva',description:'Descripción',enabled:'on'}[key]??null;}};
 try{await nodes(app.render()).find(n=>n.type==='form').props.onSubmit({preventDefault(){},currentTarget:{reset(){}}});}finally{globalThis.FormData=Original;}
 assert.equal(writes.length,1);const offer=writes[0].explorer.offers[0];
 assert.equal(offer.propertyId,'real-1');assert.equal(offer.source,'real');assert.equal(offer.price,1200);assert.equal(offer.currency,'ARS');assert.equal(offer.enabled,true);assert.equal(offer.color,'#2563eb');
 assert.deepEqual(writes[0].points,props.initialSettings.points,'offers never replace catalogue/reference data');
});
test('offers popup selects the resolved real property and can be dismissed',()=>{
 const selected=[];const target={id:'real-1',source:'real',title:'Casa real',price:100,currency:'USD'};
 const props={targets:[target],offers:[{id:'offer-1',source:'real',propertyId:'real-1',title:'Oferta',description:'',price:90,currency:'USD',enabled:true,color:'#2563eb'}],onSelect:p=>selected.push(p)};
 const app=harness('../components/auth/PropertyOffersPopup.tsx',props,{'@/lib/property-offers':{resolvePropertyOffers}});
 const view=app.render();assert.equal(view.type,'aside');
 assert.equal(nodes(view).filter(n=>n.type==='header').length,0,'no outer offers frame');
 assert.equal(nodes(view).filter(n=>n.type==='article').length,1);
 assert.ok(nodes(nodes(view).find(n=>n.type==='article')).some(n=>n.props?.['aria-label']==='Cerrar ofertas'),'close belongs to the card');
 assert.deepEqual(nodes(view).find(n=>n.type==='article').props.style,{backgroundColor:'#2563eb',color:'#ffffff'});
 nodes(view).find(n=>n.type==='button'&&n.props.children==='Ver propiedad').props.onClick();assert.equal(selected[0],target);
 nodes(view).find(n=>n.props?.['aria-label']==='Cerrar ofertas').props.onClick();
 assert.equal(app.render().type,'button');assert.equal(app.render().props.children,'Ver ofertas');
});
test('overview buttons no longer override every nested tour control',()=>{
 const css=readFileSync(new URL('../components/auth/real-agency-map.module.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/\.workspace button\s*,|\.workspace a\s*,/);
 assert.match(css,/\.offersPosition\s*\{[^}]*right:\s*16px/);
 const tour=readFileSync(new URL('../components/property-tour-demo.module.css',import.meta.url),'utf8');assert.match(tour,/\.propertySummary/);
});

test('offer checkbox uses an inline row and fullscreen offers stay in the lower right',()=>{
 const css=readFileSync(new URL('../components/auth/property-offers.module.css',import.meta.url),'utf8');
 assert.match(css,/\.form\s+\.checkboxRow\s*\{[^}]*display:\s*flex/);
 assert.match(css,/input\[type=['"]checkbox['"]\][^{]*\{[^}]*width:\s*(?:auto|18px)/);
 const layout=readFileSync(new URL('../components/auth/map-workspace-layout.module.css',import.meta.url),'utf8');
 assert.doesNotMatch(layout,/data-operation-open='true'\]\s+\[data-map-offers\]\s*\{\s*left:\s*312px/);
 const map=readFileSync(new URL('../components/auth/real-agency-map.module.css',import.meta.url),'utf8');
 assert.match(map,/\.offersPosition\s*\{[^}]*bottom:\s*48px/);
 const aerial=readFileSync(new URL('../components/aerial-experience.module.css',import.meta.url),'utf8');
 assert.match(aerial,/\.aerialOffers\s*\{[^}]*right:\s*18px;[^}]*bottom:\s*48px/);
});
