import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPropertySearchResults} from '../lib/property-search.ts';
import {defaultPresentationSettings} from '../lib/agency-presentation.ts';
import {defaultExplorerSettings} from '../lib/presentation-explorer.ts';
import {defaultDemoConfig} from '../lib/property-tour-config.ts';
const record={id:'real-1',title:'Casa con balcón',description:'Muy luminosa',type:'HOUSE',operation:'SALE',status:'PUBLISHED',price:120000,currency:'USD',neighborhood:'Centro',address:'Belgrano 123',area:95,bedrooms:3,bathrooms:2,features:['Patio','Cochera'],latitude:-33.12,longitude:-64.35,media:[{kind:'PHOTO',url:'/photo.jpg'}]};
const settings={...structuredClone(defaultPresentationSettings),explorer:structuredClone(defaultExplorerSettings)};
const zones=[{id:'centro',label:'Centro',kind:'neighborhood',bounds:{west:-65,east:-64,south:-34,north:-33}}];
const search=(filters={},properties=[record],examples)=>buildPropertySearchResults({properties,settings,zones,examples,filters});
test('blank search fields leave all visible properties and legacy filter flags intact',()=>{
 assert.equal(search().length,1);
 assert.equal(search({query:' ',min:'',max:'',currency:'',minArea:'',maxArea:'',minBedrooms:'',maxBedrooms:'',bathrooms:'',operation:'',status:'',features:'',offersOnly:''}).length,1);
 assert.equal(search({garage:'yes'})[0].image,'/photo.jpg');
 const hidden=structuredClone(settings);hidden.explorer.listings[record.id]={hidden:true,offer:false,kind:'Casa',bedrooms:3,garage:true};
 assert.equal(buildPropertySearchResults({properties:[record],settings:hidden,zones,filters:{}}).length,0);
 const disabled=structuredClone(settings);disabled.explorer.filters.kind=false;
 assert.equal(buildPropertySearchResults({properties:[record],settings:disabled,zones,filters:{kind:'Lote'}}).length,1);
});
test('combined optional criteria support normalized text, currency, ranges, operation, status, amenities and offers',()=>{
 assert.equal(search({query:'BALCON belgrano',currency:'USD',operation:'SALE',status:'PUBLISHED',minArea:'90',maxArea:'100',minBedrooms:'2',maxBedrooms:'3',bathrooms:'2',features:'patio, cochera'}).length,1);
 for(const criteria of [{query:'pileta'},{currency:'ARS'},{operation:'RENT'},{status:'DRAFT'},{minArea:'100'},{maxArea:'90'},{minBedrooms:'4'},{maxBedrooms:'2'},{bathrooms:'3'},{features:'pileta'},{offersOnly:'yes'},{min:'130000',max:'100000'}])assert.equal(search(criteria).length,0,JSON.stringify(criteria));
 const offered=structuredClone(settings);offered.explorer.offers=[{id:'o',source:'real',propertyId:record.id,title:'Oferta',description:'',price:100000,currency:'USD',enabled:true}];
 assert.equal(buildPropertySearchResults({properties:[record],settings:offered,zones,filters:{offersOnly:'yes'}}).length,1);
});
test('example results use saved characteristics and honest missing-operation semantics',()=>{
 const examples=search({},[],defaultDemoConfig);assert.ok(examples.length);
 const first=examples[0];assert.ok(first.image);assert.equal(first.source,'example');
 const custom=structuredClone(settings);custom.explorer.listings[first.id]={hidden:false,offer:false,kind:'Casa',bedrooms:4,garage:true,area:180,bathrooms:3,features:['Pileta'],title:'Casa personalizada'};
 const filtered=buildPropertySearchResults({properties:[],settings:custom,zones,examples:defaultDemoConfig,filters:{query:'personalizada',minArea:'170',bathrooms:'3',features:'pileta',minBedrooms:'4'}});
 assert.equal(filtered.length,1);assert.equal(filtered[0].id,first.id);
 assert.equal(search({operation:'SALE'},[],defaultDemoConfig).length,0);
 assert.equal(search({},[{...record,media:[]}])[0].image,undefined);
});
