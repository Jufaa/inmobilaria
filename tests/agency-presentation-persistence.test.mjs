import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
  assert.match(actions, /requireAgencyCollaborationAccess/);
  assert.match(actions, /parsePresentationSettings/);
  assert.match(actions, /parseDemoConfig/);
  assert.match(actions, /presentationSettings/);
  assert.match(actions, /demoTourConfig/);
  assert.match(panel, /presentationSettings/);
  assert.match(panel, /demoTourConfig/);
  assert.match(settingsPage, /presentationSettings/);
  assert.match(map, /persistSettings/);
  assert.match(map, /persistDemoConfig/);
  assert.match(settingsEditor, /if \(onPersist\)/);
  assert.match(settingsEditor, /await onPersist\(settings\)/);
  assert.match(tourConfig, /parseDemoConfig/);
  assert.match(nextConfig, /serverActions:\s*\{\s*bodySizeLimit:\s*'3mb'/);
});
