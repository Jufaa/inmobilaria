import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('demo mode disables alternate providers and authenticates only a provisioned member', async () => {
  const auth = await source('../auth.ts');
  assert.match(auth, /readDemoAccessConfig/);
  assert.match(auth, /verifyPassword/);
  assert.match(auth, /membership\.findMany/);
  assert.match(auth, /DEMO_AGENCY_SLUG|agencySlug/);
  assert.match(auth, /providers:\s*demoAccess\s*\?/);
});

test('global demo proxy requires the provisioned authenticated identity', async () => {
  const proxy = await source('../proxy.ts');
  assert.match(proxy, /isDemoProtectedPath/);
  assert.match(proxy, /isDemoIdentity/);
  assert.match(proxy, /export const proxy = auth\(/);
});

test('demo login UI and registration action do not expose alternate account paths', async () => {
  const login = await source('../app/login/page.tsx');
  const form = await source('../app/login/LoginForm.tsx');
  const registration = await source('../app/registro/actions.ts');
  assert.match(login, /demoAccess/);
  assert.match(form, /username/);
  assert.match(registration, /isDemoAccessEnabled/);
});

test('the dedicated demo seed is opt-in, loopback-only, and guarded against identity collisions', async () => {
  const seed = await source('../scripts/seed-demo-access.mjs');
  assert.match(seed, /DEMO_DATA_SEED/);
  assert.match(seed, /localhost.*127\.0\.0\.1/);
  assert.match(seed, /production, hosted, or CI/);
  assert.match(seed, /identity collision/);
  assert.match(seed, /existingMemberships\.some/);
});
