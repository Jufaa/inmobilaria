import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as settingsApi from '../lib/agency-presentation.ts';
import * as contactApi from '../lib/properties/property-whatsapp.ts';
const contact={whatsappNumber:'5493581234567',message:'Quiero visitar {propiedad}'};
function service({owner=true,conflict=false}={}){
 let stored={...structuredClone(settingsApi.defaultPresentationSettings),propertyContacts:{other:{...contact,message:'Other contact'}}};let attempts=0,writes=0;
 const prisma={$transaction:async(fn,options)=>{
  assert.equal(options.isolationLevel,'Serializable');attempts++;
  let pending=null;
  const tx={property:{findFirst:async args=>{assert.deepEqual(args.where,{id:'property-1',agencyId:'canonical'});return owner?{id:'property-1'}:null;}},agencyPresentationConfig:{findUnique:async()=>({presentationSettings:structuredClone(stored)}),upsert:async args=>{writes++;assert.equal(args.where.agencyId,'canonical');pending=structuredClone(args.update.presentationSettings);}}};
  const result=await fn(tx);
  if(conflict&&attempts===1){stored.propertyContacts.concurrent={...contact,message:'Concurrent contact'};throw Object.assign(Error('retry'),{code:'P2034'});}
  stored=pending;return result;
 }};
 const exports={};const code=ts.transpileModule(readFileSync(new URL('../lib/properties/property-contact-service.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('require','exports',code)(id=>id==='server-only'?{}:id==='@/lib/prisma'?{prisma}:id==='@/lib/agency-presentation'?settingsApi:id==='./property-whatsapp'?contactApi:(()=>{throw Error(id);})(),exports);
 return{api:exports,get stored(){return stored;},get attempts(){return attempts;},get writes(){return writes;}};
}
test('contact save/delete preserve other contacts/settings and a serializable retry reads current data',async()=>{
 const db=service({conflict:true});await db.api.savePropertyWhatsAppContact('canonical','property-1',contact);
 assert.equal(db.attempts,2);assert.equal(db.stored.propertyContacts.concurrent.message,'Concurrent contact');assert.equal(db.stored.propertyContacts.other.message,'Other contact');assert.equal(db.stored.propertyContacts['property-1'].whatsappNumber,contact.whatsappNumber);assert.deepEqual(db.stored.map,settingsApi.defaultPresentationSettings.map);
 await db.api.savePropertyWhatsAppContact('canonical','property-1',null);assert.equal(db.stored.propertyContacts['property-1'],undefined);assert.ok(db.stored.propertyContacts.other);
});
test('wrong property ownership rejects before configuration writes',async()=>{
 const db=service({owner:false}),before=JSON.stringify(db.stored);await assert.rejects(()=>db.api.savePropertyWhatsAppContact('canonical','property-1',contact),/belong/);assert.equal(db.writes,0);assert.equal(JSON.stringify(db.stored),before);
});
test('general appearance writes preserve current contacts rather than submitted stale contacts',async()=>{
 const db=service({conflict:true});const submitted={...structuredClone(settingsApi.defaultPresentationSettings),propertyContacts:{bad:{...contact,message:'Stale'}}};submitted.map.accentColor='#eab308';
 await db.api.savePresentationPreservingContacts('canonical',submitted);assert.equal(db.stored.map.accentColor,'#eab308');assert.ok(db.stored.propertyContacts.other);assert.ok(db.stored.propertyContacts.concurrent);assert.equal(db.stored.propertyContacts.bad,undefined);
});
