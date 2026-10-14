import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultAgencies, agencyStorageKey, agencyFavoritesKey, agencyPropertyPath, createAgencyRepository, parseAgencies } from '../lib/agencies.ts';
import { mergeDemoSeeds, selectPublicProperties } from '../lib/demo-repository.ts';
test('tenant persistence retains original storage while separating agencies',()=>{
 assert.equal(agencyStorageKey('principal'),'territorio-demo-v1');
 assert.equal(agencyFavoritesKey('principal'),'territorio-favorites');
 assert.equal(new Set(defaultAgencies.map(a=>agencyStorageKey(a.id))).size,3);
 assert.equal(new Set(defaultAgencies.map(a=>agencyFavoritesKey(a.id))).size,3);
});
test('agency catalog seeds and mutations do not blend listings or inquiries',()=>{
 const first=createAgencyRepository(defaultAgencies[0]);const second=createAgencyRepository(defaultAgencies[1]);const third=createAgencyRepository(defaultAgencies[2]);
 const firstIds=new Set(first.catalog.map(p=>p.id));assert.ok(second.catalog.every(p=>!firstIds.has(p.id)));
 assert.ok(third.catalog.every(p=>!second.catalog.some(s=>s.id===p.id)));
 second.catalog[0].title='Independent edit';second.leads.push({id:50,propertyId:second.catalog[0].id,name:'Demo',email:'demo@example.com',phone:'',message:'Test',stage:'new',note:'',createdAt:'2026-10-14'});
 assert.equal(first.leads.length,2);assert.equal(third.leads.length,0);
 assert.notEqual(first.catalog[0].title,second.catalog[0].title);
 assert.ok(selectPublicProperties(second.catalog).length>0);
 assert.equal(mergeDemoSeeds(first,first.catalog).catalog.length,first.catalog.length);
});
test('new agencies start empty and sharing keeps tenant identity',()=>{
 const agency={id:'empresa-test',name:'Mi empresa',color:'#0f766e',logo:'',status:'active',sample:3};
 const repo=createAgencyRepository(agency);assert.equal(repo.catalog.length,0);assert.equal(repo.leads.length,0);assert.equal(repo.visits.length,0);assert.equal(repo.brand.name,'Mi empresa');
 assert.equal(agencyPropertyPath(agency.id,88),'/inmobiliaria/empresa-test#propiedad=88');
 assert.ok(parseAgencies([...defaultAgencies,agency]));assert.equal(parseAgencies([...defaultAgencies,defaultAgencies[0]]),null);assert.equal(parseAgencies([{...defaultAgencies[0],logo:'javascript:alert(1)'}]),null);
});
