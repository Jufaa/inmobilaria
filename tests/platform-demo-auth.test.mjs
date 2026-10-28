import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as demoApi from '../lib/auth/demo-access.ts';
function authorizeFor(user, config, memberships = []) {
  let authConfig;
  const code = ts.transpileModule(readFileSync(new URL('../auth.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  new Function('require', 'exports', 'process', code)(id => {
    if (id === 'next-auth') return { __esModule: true, default: config => { authConfig = config; return {}; } };
    if (id === 'next-auth/providers/credentials') return { __esModule: true, default: value => value };
    if (id === 'next-auth/providers/google') return { __esModule: true, default: {} };
    if (id === '@auth/prisma-adapter') return { PrismaAdapter: () => ({}) };
    if (id === '@/lib/prisma') return { prisma: { user: { findUnique: async () => user }, membership: { findMany: async () => memberships } } };
    if (id === '@/lib/auth/password-auth') return { normalizeEmail: value => value, verifyPassword: async (password, hash) => password === 'admin' && hash === 'valid' };
    if (id === '@/lib/auth/demo-access') return { ...demoApi, readDemoAccessConfig: () => config };
    throw new Error(id);
  }, {}, { env: { NODE_ENV: 'production' } });
  const authorize = credentials => authConfig.providers[0].authorize(credentials);
  authorize.jwt = authConfig.callbacks.jwt;
  return authorize;
}
test('hosted global demo accepts only its dedicated verified-password owner', async () => {
  const user = { id: 'territorio-platform-demo-owner', email: 'platform-admin@demo.invalid', platformRole: 'OWNER', passwordHash: 'valid' };
  const config = { username: 'admin', password: 'admin', email: user.email, platformOwner: true };
  assert.equal((await authorizeFor(user, config)({ username: 'admin', password: 'admin' }))?.id, user.id);
  for (const bad of [{ ...user, id: 'another-owner' }, { ...user, email: 'someone@example.com' }, { ...user, platformRole: 'USER' }, { ...user, passwordHash: 'invalid' }]) {
    assert.equal(await authorizeFor(bad, config)({ username: 'admin', password: 'admin' }), null);
  }
  assert.equal(await authorizeFor(user, config)({ username: 'admin', password: 'wrong' }), null);
});
test('ordinary agency demo still rejects global owners and requires its sole agency membership', async () => {
  const config = { username: 'admin', password: 'admin', email: 'admin@demo.invalid', agencySlug: 'demo' };
  const user = { id: 'agency-user', email: config.email, platformRole: 'USER', passwordHash: 'valid' };
  const membership = { role: 'ADMIN', agency: { slug: 'demo' } };
  assert.ok(await authorizeFor(user, config, [membership])({ username: 'admin', password: 'admin' }));
  assert.equal(await authorizeFor({ ...user, platformRole: 'OWNER' }, config, [membership])({ username: 'admin', password: 'admin' }), null);
  assert.equal(await authorizeFor(user, config, [])({ username: 'admin', password: 'admin' }), null);
});

test('disabling global demo blocks ordinary credential fallback and invalidates its existing JWT', async () => {
  const user = { id: 'territorio-platform-demo-owner', email: 'platform-admin@demo.invalid', emailVerified: new Date(), platformRole: 'OWNER', passwordHash: 'valid' };
  const disabled = authorizeFor(user, null);
  assert.equal(await disabled({ email: user.email, password: 'admin' }), null);
  assert.equal(await disabled.jwt({ token: { sub: user.id } }), null);
  const normal = { ...user, id: 'normal-user', email: 'normal@example.com' };
  assert.ok(await authorizeFor(normal, null)({ email: normal.email, password: 'admin' }));
  assert.deepEqual(await disabled.jwt({ token: { sub: normal.id } }), { sub: normal.id });
});
