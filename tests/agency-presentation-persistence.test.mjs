import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { defaultPresentationSettings, parsePresentationSettings } from '../lib/agency-presentation.ts';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('agency presentation and demo templates hydrate and persist through membership-guarded PostgreSQL actions', () => {
  const schema = read('../prisma/schema.prisma');
  const migration = read('../prisma/migrations/20261023150000_agency_presentation_config/migration.sql');
  const actions = read('../app/inmobiliaria/[agencyId]/panel/personalizacion/presentation-actions.ts');
  const panel = read('../app/inmobiliaria/[agencyId]/panel/page.tsx');
  const settingsPage = read('../app/inmobiliaria/[agencyId]/panel/personalizacion/page.tsx');
  const map = read('../components/auth/AgencyPresentationMap.tsx');
  const settingsEditor = read('../components/auth/AgencyPresentationSettings.tsx');
  const tourConfig = read('../lib/property-tour-config.ts');
  const nextConfig = read('../next.config.ts');

  assert.match(schema, /model AgencyPresentationConfig\s*\{[\s\S]*?agencyId\s+String\s+@unique[\s\S]*?presentationSettings\s+Json\?[\s\S]*?demoTourConfig\s+Json\?/);
  assert.match(migration, /CREATE TABLE "AgencyPresentationConfig"/);
  assert.match(migration, /"presentationSettings" JSONB/);
  assert.match(migration, /"demoTourConfig" JSONB/);
  assert.match(migration, /FOREIGN KEY \("agencyId"\) REFERENCES "Agency"\("id"\)/);
  assert.match(actions, /requireAgencyPlatformEditAccess/);
  assert.match(actions, /parsePresentationSettings/);
  assert.match(actions, /parseDemoConfig/);
  assert.match(actions, /savePresentationPreservingContacts/);
  assert.match(read('../lib/properties/property-contact-service.ts'), /presentationSettings/);
  assert.match(actions, /demoTourConfig/);
  assert.match(panel, /presentationSettings/);
  assert.match(panel, /demoTourConfig/);
  assert.match(panel, /listAgencyProperties/);
  assert.match(settingsPage, /realProperties=\{properties\}/);
  assert.match(settingsPage, /presentationSettings/);
  assert.match(settingsPage, /<PersonalizationPanels\s+identity=/);
  assert.equal((settingsPage.match(/<AgencyPresentationSettings\b/g) ?? []).length, 1, 'all presentation panels share one persisted draft instance');
  assert.match(map, /persistSettings/);
  assert.match(map, /persistDemoConfig/);
  assert.match(settingsEditor, /if \(onPersist\)/);
  assert.match(settingsEditor, /await onPersist\(settings\)/);
  assert.match(tourConfig, /parseDemoConfig/);
  assert.match(nextConfig, /serverActions:\s*\{\s*bodySizeLimit:\s*'3mb'/);
});

test('zone map saves use canonical agency scope and invalid configurations preserve stored data', async () => {
const code=ts.transpileModule(read('../app/inmobiliaria/[agencyId]/panel/personalizacion/presentation-actions.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
let stored=structuredClone(defaultPresentationSettings),writes=0,authorized=[];
const api={};new Function('require','exports',code)(id=>{
if(id==='next/cache')return {revalidatePath(){}};
if(id==='@/lib/agency-access')return {requireAgencyPlatformEditAccess:async slug=>{authorized.push(slug);return {membership:{agency:{id:'canonical-agency'}}};}};
if(id==='@/lib/properties/property-contact-service')return {savePresentationPreservingContacts:async (agency,s)=>{assert.equal(agency,'canonical-agency');stored=structuredClone(s);writes++;return stored;}};
if(id==='@/lib/agency-presentation')return {parsePresentationSettings};
return {};
},api);
const valid={...structuredClone(defaultPresentationSettings),zoneMaps:{centro:{mode:'illustrated',imageUrl:'https://example.org/map.webp',bounds:{west:-65,east:-64,south:-34,north:-33},pins:[{source:'real',propertyId:'home-1',x:.3,y:.9}]}}};
assert.equal((await api.savePresentationSettingsAction('public-slug',valid)).error,null);
const before=JSON.stringify(stored);
for (const mutate of [s=>s.zoneMaps.centro.pins[0].x=-.1,s=>s.zoneMaps.centro.mode='invalid',s=>s.zoneMaps.centro.imageUrl='javascript:alert(1)']) {
const bad=structuredClone(valid);mutate(bad);const result=await api.savePresentationSettingsAction('public-slug',bad);assert.equal(result.settings,null);assert.equal(JSON.stringify(stored),before);assert.equal(writes,1);
}
assert.equal(authorized.length,4);

});
