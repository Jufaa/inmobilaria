import test from 'node:test';
import assert from 'node:assert/strict';
import { isDemoAccessEnabled, isDemoIdentity, isDemoProtectedPath, readDemoAccessConfig } from '../lib/auth/demo-access.ts';

test('demo access is opt-in and requires server-only credential and agency configuration', () => {
  assert.equal(isDemoAccessEnabled({}), false);
  assert.throws(() => readDemoAccessConfig({ DEMO_ACCESS_ENABLED: 'true' }), /DEMO_ADMIN_USERNAME/);
  assert.deepEqual(readDemoAccessConfig({
    DEMO_ACCESS_ENABLED: 'true',
    DEMO_ADMIN_USERNAME: 'admin',
    DEMO_ADMIN_PASSWORD: 'admin',
    DEMO_ADMIN_EMAIL: 'admin@demo.invalid',
    DEMO_AGENCY_SLUG: 'fictitious-demo',
  }), {
    username: 'admin', password: 'admin', email: 'admin@demo.invalid', agencySlug: 'fictitious-demo',
  });
});

test('demo sessions must match the provisioned demo identity', () => {
  const config = { email: 'admin@demo.invalid' };
  assert.equal(isDemoIdentity({ user: { email: 'admin@demo.invalid' } }, config), true);
  assert.equal(isDemoIdentity({ user: { email: 'customer@example.com' } }, config), false);
  assert.equal(isDemoIdentity(null, config), false);
});

test('only login, Auth.js endpoints, and static assets bypass the demo gate', () => {
  for (const pathname of ['/workspace', '/api/properties', '/api/files/image.svg', '/registro', '/']) {
    assert.equal(isDemoProtectedPath(pathname), true, `${pathname} must be protected`);
  }
  for (const pathname of ['/login', '/api/auth', '/api/auth/callback/credentials', '/_next/static/app.js', '/favicon.ico', '/logo.svg']) {
    assert.equal(isDemoProtectedPath(pathname), false, `${pathname} must be public`);
  }
  assert.equal(isDemoProtectedPath('/login/help'), true);
});

test('global demo requires explicit fictitious-data confirmation and a dedicated identity', () => {
  const env = { DEMO_ACCESS_ENABLED: 'true', DEMO_ADMIN_USERNAME: 'admin', DEMO_ADMIN_PASSWORD: 'admin', DEMO_ADMIN_EMAIL: 'platform-admin@demo.invalid', DEMO_PLATFORM_OWNER_ENABLED: 'true' };
  assert.throws(() => readDemoAccessConfig(env), /fictitious/i);
  const config = readDemoAccessConfig({ ...env, DEMO_FICTITIOUS_DATA_CONFIRMED: 'true' });
  assert.equal(config.platformOwner, true);
  assert.throws(() => readDemoAccessConfig({ ...env, DEMO_FICTITIOUS_DATA_CONFIRMED: 'true', DEMO_ADMIN_EMAIL: 'someone@example.com' }), /dedicated/i);
});
