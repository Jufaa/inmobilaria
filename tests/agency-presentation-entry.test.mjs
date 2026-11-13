import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require=createRequire(import.meta.url);
function RealAgencyMap(){}
function LegacyWorkspacePropertyMap(){}
function WorkspaceShell(){}
const source=readFileSync(new URL('../app/inmobiliaria/[agencyId]/panel/page.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;

test('entering the agency map renders the real catalogue map as the initial page, never the old static map with an extra launch button',async()=>{
  const calls=[];
  const exports={};
  new Function('require','exports',code)((id)=>{
    if(id==='@/components/auth/WorkspaceShell')return {WorkspaceShell};
    if(id==='@/components/auth/RealAgencyMap')return {RealAgencyMap};
    if(id==='@/lib/properties/agency-property-service')return {listAgencyProperties:async(id)=>{calls.push(['catalogue',id]);return [];}};
    if(id==='./actions')return {updateMapPropertyAction:async()=>({}),createMapPropertyAction:async()=>({})};
    if(id==='@/components/auth/WorkspacePropertyMap')return {__esModule:true,default:LegacyWorkspacePropertyMap};
    if(id==='@/lib/agency-access')return {requireAgencyDashboardAccess:async(id)=>{calls.push(['access',id]);return {canEdit:true,user:{email:'test@example.com'},membership:{agency:{id:'authorized-agency',name:'Inmobiliaria de prueba'},role:'OWNER'}};}};
    if(id==='@/lib/prisma')return {prisma:{...Object.fromEntries(['property','zone','pointOfInterest'].map(model=>[model,{findMany:async(query)=>{calls.push([model,query]);return [];}}])),agencyPresentationConfig:{findUnique:async(query)=>{calls.push(['agencyPresentationConfig',query]);return null;}}}};
    if(id==='@/lib/agency-presentation')return {defaultPresentationSettings:{},parsePresentationSettings:value=>value,withAgencyFictionalIntro:value=>value};
    if(id==='@/lib/property-tour-config')return {defaultDemoConfig:{},parseDemoConfig:value=>value};
    if(id==='./personalizacion/presentation-actions')return {saveDemoConfigAction:async()=>({ok:true}),savePresentationSettingsAction:async()=>({ok:true})};
    return require(id);
  },exports);
  const page=await exports.default({params:Promise.resolve({agencyId:'requested-slug'})});
  assert.equal(page.type,WorkspaceShell);
  assert.equal(page.props.children.type,RealAgencyMap);
  assert.notEqual(page.props.children.type,LegacyWorkspacePropertyMap);
  assert.equal(page.props.children.props.agencyName,'Inmobiliaria de prueba');
  assert.match(source,/onCreate=\{createMapPropertyAction\.bind\(null,\s*agencyId\)\}/);
  assert.match(source,/exampleConfig=\{parseDemoConfig/);
  assert.match(source,/persistDemoConfig=\{saveDemoConfigAction\.bind/);
  assert.deepEqual(page.props.children.props.exampleConfig,{});
  assert.deepEqual(calls[0],['access','requested-slug']);
  assert.deepEqual(calls.find(([model])=>model==='catalogue'),['catalogue','authorized-agency']);
  for(const [model,query] of calls.slice(1))if(model!=='catalogue')assert.deepEqual(query.where,{agencyId:'authorized-agency'});
});
