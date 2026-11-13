import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const load=(path,mocks)=>{const output={};const code=ts.transpileModule(readFileSync(new URL(`../${path}`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;new Function('require','exports',code)(id=>{if(!(id in mocks))throw Error(`Unexpected import ${id}`);return mocks[id];},output);return output;};
function access(role='ADMIN',global=false,signedIn=true){return load('lib/agency-access.ts',{'server-only':{},'next/navigation':{redirect:path=>{throw Error(`redirect:${path}`);}},'@/auth':{auth:async()=>signedIn?{user:{id:'user',platformRole:'OWNER'}}:null},'@/lib/prisma':{prisma:{user:{findUnique:async()=>({platformRole:global?'OWNER':'USER'})},membership:{findFirst:async args=>args.where.agency.slug==='own'&&args.where.role.in.includes(role)?{role,agency:{id:'canonical',slug:'own'}}:null},agency:{findUnique:async args=>args.where.slug==='own'?{id:'canonical',slug:'own'}:null}}}});}
function form(){const data=new FormData();for(const [key,value] of Object.entries({propertyId:'p',title:'Casa',type:'HOUSE',operation:'SALE',currency:'USD',status:'PUBLISHED',price:'100',area:'60',bedrooms:'2',bathrooms:'1',neighborhood:'Centro',address:'Calle123',latitude:'-33.12',longitude:'-64.35'}))data.set(key,value);data.set('agencyId','other');return data;}
function actions(guards){const calls=[],cache=[];const write=async(...args)=>{calls.push(args);return{id:'p',media:[]};};const api=load('app/inmobiliaria/[agencyId]/panel/actions.ts',{'next/cache':{revalidatePath:path=>cache.push(path)},'@/lib/agency-access':guards,'@vercel/blob':{head:async()=>({})},'@/lib/properties/property-photo-policy':{parsePropertyPhotoUrls:()=>[],verifyPropertyPhotos:async()=>{}},'@/lib/properties/agency-property-service':{propertyCurrencies:['ARS','USD'],propertyOperations:['SALE','RENT'],propertyStatuses:['DRAFT','PUBLISHED'],propertyTypes:['HOUSE'],createAgencyProperty:write,updateAgencyProperty:write,updateAgencyPropertyStatus:write,updateAgencyPropertyWithPhotos:write}});return{api,calls,cache};}
const invoke=(api,name,slug='own')=>name==='createMapPropertyAction'?api[name](slug,form()):name==='updateMapPropertyAction'?api[name](slug,'p',form()):api[name](slug,{},form());
test('own-agency OWNER/ADMIN and global admin can mutate real catalogue without gaining advanced edit permission',async()=>{
 for(const [role,global] of [['OWNER',false],['ADMIN',false],[null,true]]){
  const guards=access(role,global);const app=actions(guards);
  for(const name of Object.keys(app.api))await invoke(app.api,name);
  assert.equal(app.calls.length,5);assert.ok(app.calls.every(args=>args[0]==='canonical'));
  const read=await guards.requireAgencyDashboardAccess('own');assert.equal(read.canManageCatalogue,true);assert.equal(read.canEdit,global);
  if(!global)await assert.rejects(()=>guards.requireAgencyPlatformEditAccess('own'),/redirect:/);
 }
});
test('editors, visitors and other agencies cannot trigger catalogue service or cache writes',async()=>{
 for(const [role,global,signedIn,slug] of [['EDITOR',false,true,'own'],['AGENT',false,true,'own'],[null,false,true,'own'],['ADMIN',false,false,'own'],['ADMIN',false,true,'other']]){
  const app=actions(access(role,global,signedIn));for(const name of Object.keys(app.api))await assert.rejects(()=>invoke(app.api,name,slug),/redirect:/);
  assert.equal(app.calls.length,0);assert.equal(app.cache.length,0);
 }
});

test('catalogue page uses a local edit boundary while global shell and advanced map flags stay separate',()=>{
 const page=readFileSync(new URL('../app/inmobiliaria/[agencyId]/panel/propiedades/page.tsx',import.meta.url),'utf8');assert.match(page,/<WorkspaceEditPermissionProvider canEdit=\{canManageCatalogue\}>/);assert.match(page,/<WorkspaceShell[\s\S]*?canEdit=\{canEdit\}/);
 const main=readFileSync(new URL('../app/inmobiliaria/[agencyId]/panel/page.tsx',import.meta.url),'utf8');assert.match(main,/canCustomize=\{canEdit\} canManageCatalogue=\{canManageCatalogue\}/);
 const manager=readFileSync(new URL('../components/auth/PropertyManager.tsx',import.meta.url),'utf8');assert.match(manager,/<Property360Upload propertyId=\{property\?\.id\} disabled=\{pending\}/);
 const mapForm=readFileSync(new URL('../components/auth/RealMapPropertyForm.tsx',import.meta.url),'utf8');assert.match(mapForm,/<Property360Upload propertyId=\{initial\?\.id\} disabled=\{busy\}/);
});
