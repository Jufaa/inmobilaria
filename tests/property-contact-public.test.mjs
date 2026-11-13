import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as contactsApi from '../lib/properties/property-whatsapp.ts';
const contact={whatsappNumber:'5493581234567',message:'Mensaje del propietario'};
function service({published=true,allowed=true,configured=true}={}){
 const exports={};let query;
 const prisma={agency:{findUnique:async()=>({id:'presenter',slug:'presenter',name:'Presenter'})},property:{findFirst:async args=>{
  query=args;assert.equal(args.where.status,'PUBLISHED');assert.equal(args.where.id,'property-1');
  if(!published||!allowed)return null;
  return{id:'property-1',title:'Casa',description:'',type:'HOUSE',operation:'SALE',price:{toNumber:()=>100},currency:'USD',neighborhood:'Centro',area:{toNumber:()=>90},bedrooms:2,bathrooms:1,features:[],agencyId:'owner',agency:{name:'Owner',presentationConfig:{presentationSettings:{propertyContacts:configured?{'property-1':contact,other:{...contact,message:'Do not expose'}}:{}}}}};
 }}};
 const code=ts.transpileModule(readFileSync(new URL('../lib/properties/public-inquiry-service.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('require','exports',code)(id=>id==='server-only'?{}:id==='@/lib/prisma'?{prisma}:id==='./property-whatsapp'?contactsApi:(()=>{throw Error(id);})(),exports);
 return{api:exports,get query(){return query;}};
}
test('public shared detail exposes only the published selected property owner contact, never presenter configuration',async()=>{
 const before=process.env.DATABASE_URL;process.env.DATABASE_URL='mock-only-never-connected';
 try{
  const app=service();const result=await app.api.getPublicPropertyDetails('property-1','presenter');
  assert.deepEqual(result.whatsappContact,contact);assert.equal(result.propertyContacts,undefined);assert.equal(result.presentingAgencyName,'Presenter');assert.equal(result.agencyName,'Owner');
  assert.deepEqual(app.query.where.OR[1],{shareGrants:{some:{recipientAgencyId:'presenter',active:true,connection:{status:'ACCEPTED'}}}});
  assert.equal((await service({configured:false}).api.getPublicPropertyDetails('property-1')).whatsappContact,undefined);
  assert.equal(await service({published:false}).api.getPublicPropertyDetails('property-1'),null);
  assert.equal(await service({allowed:false}).api.getPublicPropertyDetails('property-1','presenter'),null);
 }finally{if(before===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=before;}
});
