import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultExplorerSettings, parseExplorerSettings } from '../lib/presentation-explorer.ts';
import { resolvePropertyOffers } from '../lib/property-offers.ts';
test('offers are optional and retain legacy settings shape; invalid offers cannot be saved',()=>{
  const old=structuredClone(defaultExplorerSettings);assert.deepEqual(parseExplorerSettings(old,()=>true),old);
  const offer={id:'offer-1',source:'real',propertyId:'property-1',title:'Oferta',description:'Precio especial',price:100,currency:'USD',enabled:true};
  assert.equal(parseExplorerSettings({...old,offers:[offer]},()=>true).offers[0].price,100);
  for(const change of [{price:-1},{currency:'INVALID'},{source:'other'},{enabled:'true'},{title:''},{description:'x'.repeat(501)}])assert.equal(parseExplorerSettings({...old,offers:[{...offer,...change}]},()=>true),null);
  assert.equal(parseExplorerSettings({...old,offers:[offer,offer]},()=>true),null);
});
test('offer cards resolve only the current agency targets and keep real and example identities separate',()=>{
  const offer={id:'o',source:'real',propertyId:'same',title:'Oferta',description:'',price:90,currency:'USD',enabled:true};
  const targets=[{id:'same',source:'example',title:'Ejemplo',price:100,currency:'USD'}];
  assert.deepEqual(resolvePropertyOffers([offer],targets),[]);
  const resolved=resolvePropertyOffers([{...offer,source:'example'}],targets);
  assert.equal(resolved[0].property.title,'Ejemplo');assert.equal(resolved[0].price,90);
  assert.deepEqual(resolvePropertyOffers([{...offer,source:'example',enabled:false}],targets),[]);
});
test('sample detail overrides are validated while old listing preferences stay compatible',()=>{
  const listing={hidden:false,offer:false,kind:'Casa',bedrooms:2,garage:null};
  const base={...structuredClone(defaultExplorerSettings),listings:{sample:{...listing,title:'Casa nueva',amount:250,currency:'ARS',area:70,bathrooms:1,features:['Patio']}}};
  assert.equal(parseExplorerSettings(base,()=>true).listings.sample.amount,250);
  for(const change of [{amount:-1},{area:0},{bathrooms:1.5},{currency:'EUR'},{features:['x'.repeat(81)]}])assert.equal(parseExplorerSettings({...base,listings:{sample:{...base.listings.sample,...change}}},()=>true),null);
});

test('fictional intro replaces only the former built-in sample and respects saved opt-outs/custom media', async()=>{
  const {withAgencyFictionalIntro,defaultPresentationSettings}=await import('../lib/agency-presentation.ts');
  const old={...defaultPresentationSettings,intro:{enabled:false,videoUrl:'/demo-assets/tours/agency-intro-sample.mp4'}};
  assert.equal(withAgencyFictionalIntro(old).intro.enabled,true);
  assert.equal(old.intro.enabled,false,'does not mutate stored settings');
  const disabled={...old,intro:{enabled:false,videoUrl:'/demo-assets/tours/agency-fictional-intro.mp4'}};
  assert.equal(withAgencyFictionalIntro(disabled),disabled);
  const custom={...old,intro:{enabled:false,videoUrl:'https://example.org/custom.mp4'}};
  assert.equal(withAgencyFictionalIntro(custom),custom);
});

test('offer colors are optional validated hex colors and preserve old offers',()=>{
 const offer={id:'color',source:'example',propertyId:'sample',title:'Oferta',description:'',price:90,currency:'USD',enabled:true};
 const settings=color=>({...structuredClone(defaultExplorerSettings),offers:[{...offer,...color}]});
 assert.equal(parseExplorerSettings(settings({color:'#eab308'}),()=>true)?.offers[0].color,'#eab308');
 assert.equal(parseExplorerSettings(settings({color:'red;position:fixed'}),()=>true),null);
 assert.equal(parseExplorerSettings(settings({}),()=>true)?.offers[0].color,undefined);
});
