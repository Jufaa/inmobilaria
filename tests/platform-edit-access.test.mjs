import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compile = path => ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function load(path, require) {
  const exports = {};
  new Function('require', 'exports', compile(path))(require, exports);
  return exports;
}
function access({ platformRole = 'USER', memberRole = 'OWNER', signedIn = true, exists = true } = {}) {
  const agency = { id: 'canonical-id', slug: 'agency-slug' };
  const calls = [];
  const api = load('lib/agency-access.ts', id => {
    if (id === 'server-only') return {};
    if (id === 'next/navigation') return { redirect: path => { throw Error(`redirect:${path}`); } };
    if (id === '@/auth') return { auth: async () => signedIn ? { user: { id: 'signed-user', platformRole: 'OWNER' } } : null };
    if (id === '@/lib/prisma') return { prisma: {
      user: { findUnique: async args => { assert.equal(args.where.id, 'signed-user'); return { platformRole }; } },
      membership: { findFirst: async args => memberRole && args.where.agency.slug === agency.slug && args.where.role.in.includes(memberRole) ? { role: memberRole, agency } : null },
      agency: { findUnique: async args => { calls.push(args); return exists && args.where.slug === agency.slug ? agency : null; } },
    } };
    throw Error(id);
  });
  return { api, calls, agency };
}

test('platform editing permission uses authoritative account role, never session or agency ownership', async () => {
  for (const memberRole of ['OWNER', 'ADMIN', 'EDITOR']) {
    const { api, calls } = access({ memberRole });
    assert.equal(typeof api.getPlatformEditPermission, 'function');
    assert.equal(await api.getPlatformEditPermission(), false);
    await assert.rejects(() => api.requireAgencyPlatformEditAccess('agency-slug'), /redirect:/);
    assert.equal(calls.length, 0, 'denied users cannot resolve or mutate tenant state');
  }
  assert.equal(await access({ signedIn: false }).api.getPlatformEditPermission(), false);
  assert.equal(await access({ platformRole: 'OWNER', memberRole: null }).api.getPlatformEditPermission(), true);
});

test('system owner resolves canonical agency without membership and read boundaries stay unchanged', async () => {
  const owner = access({ platformRole: 'OWNER', memberRole: null });
  const granted = await owner.api.requireAgencyPlatformEditAccess('agency-slug');
  assert.equal(granted.membership.agency.id, 'canonical-id');
  assert.equal(granted.canEdit, true);
  assert.deepEqual(owner.calls[0], { where: { slug: 'agency-slug' } });
  await assert.rejects(() => owner.api.requireAgencyPlatformEditAccess('missing'), /redirect:/);
  for (const memberRole of ['OWNER', 'ADMIN', 'EDITOR']) {
    const { api } = access({ memberRole });
    const result = await api.requireAgencyDashboardAccess('agency-slug');
    assert.equal(result.membership.role, memberRole);
    assert.equal(result.canEdit, false);
    for (const guard of ['requireAgencyCollaborationAccess', 'requireAgencyFinanceAccess']) {
      if (memberRole === 'EDITOR') await assert.rejects(() => api[guard]('agency-slug'), /redirect:/);
      else assert.equal((await api[guard]('agency-slug')).canEdit, false);
    }
  }
  assert.equal((await owner.api.requireAgencyDashboardAccess('agency-slug')).canEdit, true);
});

const actionFiles = [
  'app/inmobiliaria/[agencyId]/panel/alquileres/actions.ts',
  'app/inmobiliaria/[agencyId]/panel/colaboracion/actions.ts',
  'app/inmobiliaria/[agencyId]/panel/consultas/actions.ts',
  'app/inmobiliaria/[agencyId]/panel/zonas/actions.ts',
  'app/inmobiliaria/[agencyId]/panel/personalizacion/actions.ts',
  'app/inmobiliaria/[agencyId]/panel/personalizacion/presentation-actions.ts',
];

test('advanced agency mutations reject non-platform members before service, Blob or cache side effects', async () => {
  for (const memberRole of ['OWNER', 'ADMIN', 'EDITOR']) {
    const guards = access({ memberRole }).api;
    for (const path of actionFiles) {
      const sideEffects = [];
      const api = load(path, id => {
        if (id === '@/lib/agency-access') return guards;
        if (id === 'next/cache') return { revalidatePath: (...args) => sideEffects.push(args) };
        return new Proxy({}, { get: (_, name) => (...args) => { sideEffects.push([id, name, ...args]); throw Error('unexpected side effect'); } });
      });
      for (const [name, mutation] of Object.entries(api)) {
        const data = new FormData();
        const args = name === 'createMapPropertyAction' ? ['agency-slug', data]
          : name === 'updateMapPropertyAction' ? ['agency-slug', 'property-id', data]
          : name.startsWith('delete') ? ['agency-slug', data]
          : ['agency-slug', {}, data];
        await assert.rejects(() => mutation(...args), /redirect:/, `${memberRole}: ${name}`);
        assert.equal(sideEffects.length, 0, `${name} must authorize before any service call`);
      }
    }
  }
});

test('upload tokens permit owning-agency catalogue managers but reject read-only membership roles', async () => {
  const old = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
  try {
    for (const memberRole of ['OWNER', 'ADMIN', 'EDITOR']) {
      let tokens = 0;
      const api = load('app/api/inmobiliaria/[agencyId]/photos/route.ts', id => {
        if (id === '@/lib/agency-access') return access({ memberRole }).api;
        if (id === '@/lib/properties/property-photo-policy') return { isPropertyPhotoPath: () => true, propertyPhotoContentTypes: ['image/jpeg'], propertyPhotoMaxBytes: 5242880 };
        if (id === '@vercel/blob/client') return { handleUpload: async options => { await options.onBeforeGenerateToken('agencies/canonical-id/photo.jpg'); tokens++; return {}; } };
        throw Error(id);
      });
      const response = await api.POST(new Request('https://app.example/photos', { method: 'POST', body: '{}' }), { params: Promise.resolve({ agencyId: 'agency-slug' }) });
      assert.equal(response.status, memberRole==='EDITOR'?400:200);
      assert.equal(tokens, memberRole==='EDITOR'?0:1);
    }
  } finally { if (old === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = old; }
});

test('presentation and sample saves refresh map, personalization and offers only after a successful authorized write', async () => {
  for (const name of ['savePresentationSettingsAction', 'saveDemoConfigAction']) {
    for (const outcome of ['success', 'invalid', 'denied', 'database-failure']) {
      const refreshed = [], writes = [];
      const payload = { version: 1 };
      const api = load('app/inmobiliaria/[agencyId]/panel/personalizacion/presentation-actions.ts', id => {
        if (id === 'next/cache') return { revalidatePath: path => refreshed.push(path) };
        if (id === '@/lib/agency-access') return { requireAgencyPlatformEditAccess: async () => { if (outcome === 'denied') throw Error('denied'); return { membership: { agency: { id: 'canonical-id' } } }; } };
        if(id==='@/lib/properties/property-contact-service')return{savePresentationPreservingContacts:async(agencyId,settings)=>{writes.push({where:{agencyId},update:{presentationSettings:settings}});if(outcome==='database-failure')throw Error('failed');return settings;}};
        if (id === '@/lib/agency-presentation') return { parsePresentationSettings: value => outcome === 'invalid' ? null : value };
        if (id === '@/lib/property-tour-config') return { parseDemoConfig: value => outcome === 'invalid' ? null : value };
        if (id === '@/lib/prisma') return { prisma: { agencyPresentationConfig: { upsert: async args => { writes.push(args); if (outcome === 'database-failure') throw Error('failed'); } } } };
        throw Error(id);
      });
      if (outcome === 'denied') await assert.rejects(() => api[name]('agency-slug', payload), /denied/);
      else {
        const result = await api[name]('agency-slug', payload);
        if (outcome === 'success') {
          assert.equal(result.error, null);
          assert.equal(result[name === 'saveDemoConfigAction' ? 'config' : 'settings'], payload);
        } else assert.ok(result.error);
      }
      if (outcome === 'success') {
        assert.deepEqual(refreshed, ['/inmobiliaria/agency-slug/panel', '/inmobiliaria/agency-slug/panel/personalizacion', '/inmobiliaria/agency-slug/panel/ofertas']);
        assert.equal(writes.length, 1);
        assert.deepEqual(writes[0].where, { agencyId: 'canonical-id' });
      } else assert.equal(refreshed.length, 0);
      if (outcome === 'denied' || outcome === 'invalid') assert.equal(writes.length, 0);
    }
  }
});

test('property contact editing is a narrow owning-agency permission and never widens old mutation rights',async()=>{
 for(const memberRole of ['OWNER','ADMIN']){
  const app=access({memberRole});assert.equal((await app.api.requireAgencyPropertyContactAccess('agency-slug')).membership.agency.id,'canonical-id');
  await assert.rejects(()=>app.api.requireAgencyPlatformEditAccess('agency-slug'),/redirect:/);
 }
 await assert.rejects(()=>access({memberRole:'OWNER'}).api.requireAgencyPropertyContactAccess('another-agency'),/redirect:/);
 for(const memberRole of ['EDITOR','AGENT',null])await assert.rejects(()=>access({memberRole}).api.requireAgencyPropertyContactAccess('agency-slug'),/redirect:/);
 await assert.rejects(()=>access({signedIn:false}).api.requireAgencyPropertyContactAccess('agency-slug'),/redirect:/);
 assert.equal((await access({platformRole:'OWNER',memberRole:null}).api.requireAgencyPropertyContactAccess('agency-slug')).canEdit,true);
});
