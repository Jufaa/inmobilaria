import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as contactApi from '../lib/properties/property-whatsapp.ts';
function load({denied=false,failed=false}={}){
 const writes=[],refresh=[];const exports={};
 const code=ts.transpileModule(readFileSync(new URL('../app/inmobiliaria/[agencyId]/panel/propiedades/contact-actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('require','exports',code)(id=>id==='next/cache'?{revalidatePath:path=>refresh.push(path)}:id==='@/lib/agency-access'?{requireAgencyPropertyContactAccess:async()=>{if(denied)throw Error('denied');return{membership:{agency:{id:'canonical'}}};}}:id==='@/lib/properties/property-whatsapp'?contactApi:id==='@/lib/properties/property-contact-service'?{savePropertyWhatsAppContact:async(...args)=>{writes.push(args);if(failed)throw Error('not owned');}}:(()=>{throw Error(id);})(),exports);
 return{api:exports,writes,refresh};
}
const data=()=>{const form=new FormData();form.set('propertyId','property-1');form.set('whatsappNumber','+54 9 358 1234567');form.set('message','Visitar esta propiedad');return form;};
test('only validated scoped contact updates refresh the selected property and agency pages',async()=>{
 const app=load();const result=await app.api.savePropertyContactAction('agency-slug',data());assert.ok(result.success);assert.deepEqual(app.writes[0],['canonical','property-1',{whatsappNumber:'5493581234567',message:'Visitar esta propiedad'}]);assert.equal(app.refresh.length,3);
 const remove=data();remove.set('intent','remove');await app.api.savePropertyContactAction('agency-slug',remove);assert.equal(app.writes[1][2],null);
});
test('denied, malformed and ownership/database failures cannot report success or invalidate caches',async()=>{
 const denied=load({denied:true});await assert.rejects(()=>denied.api.savePropertyContactAction('slug',data()),/denied/);assert.equal(denied.writes.length,0);assert.equal(denied.refresh.length,0);
 for(const [field,value] of [['propertyId','../other'],['whatsappNumber','javascript:alert(1)'],['message','']]){const app=load(),form=data();form.set(field,value);assert.ok((await app.api.savePropertyContactAction('slug',form)).error);assert.equal(app.writes.length,0);assert.equal(app.refresh.length,0);}
 const failed=load({failed:true});assert.ok((await failed.api.savePropertyContactAction('slug',data())).error);assert.equal(failed.refresh.length,0);
});
