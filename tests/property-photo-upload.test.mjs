import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import ts from 'typescript';

function setup({ denied = false } = {}) {
  const path = new URL('../app/api/inmobiliaria/[agencyId]/photos/route.ts', import.meta.url);
  assert.ok(existsSync(path), 'upload route must exist');
  const calls = [], exports = {};
  new Function('require', 'exports', ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(id => {
    if (id === '@vercel/blob/client') return { handleUpload: async options => { calls.push(options); if (options.body.type === 'blob.generate-client-token') return options.onBeforeGenerateToken(options.body.payload.pathname, null, false); return { type: 'blob.upload-completed' }; } };
    if (id === '@/lib/agency-access') return { requireAgencyPlatformEditAccess: async () => { if (denied) throw Error('denied'); return { membership: { agency: { id: 'tenant' } } }; } };
    if (id === '@/lib/properties/property-photo-policy') return { propertyPhotoContentTypes: ['image/jpeg', 'image/png', 'image/webp'], propertyPhotoMaxBytes: 5242880, isPropertyPhotoPath: (path, id) => path === `agencies/${id}/12345678-1234-4123-8123-123456789abc.jpg` };
    throw Error(id);
  }, exports);
  return { ...exports, calls };
}
const pathname = 'agencies/tenant/12345678-1234-4123-8123-123456789abc.jpg';
const request = pathname => new Request('https://app.example/upload', { method: 'POST', body: JSON.stringify({ type: 'blob.generate-client-token', payload: { pathname } }) });
const context = { params: Promise.resolve({ agencyId: 'slug' }) };

test('upload token generation authenticates the tenant and restricts size/types/path/overwrite', async () => {
  const old = process.env.BLOB_READ_WRITE_TOKEN; process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
  try {
    const route = setup();
    const response = await route.POST(request(pathname), context);
    assert.equal(response.status, 200);
    const config = await response.json();
    assert.equal(config.maximumSizeInBytes, 5242880);
    assert.equal(config.addRandomSuffix, false);
    assert.equal(config.allowOverwrite, false);
    assert.deepEqual(config.allowedContentTypes, ['image/jpeg', 'image/png', 'image/webp']);
    assert.equal((await route.POST(request(pathname.replace('tenant', 'other')), context)).status, 400);
    assert.equal((await setup({ denied: true }).POST(request(pathname), context)).status, 400);
    assert.equal((await route.POST(new Request('https://app.example/upload', { method: 'POST', body: JSON.stringify({ type: 'blob.upload-completed', payload: {} }) }), context)).status, 200);
  } finally { if (old === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = old; }
});

test('upload payload is bounded while streaming even without content-length, and configuration is required', async () => {
  const old = process.env.BLOB_READ_WRITE_TOKEN; process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
  try {
    const route = setup();
    const oversized = new Request('https://app.example/upload', { method: 'POST', body: ' '.repeat(17000) });
    assert.equal((await route.POST(oversized, context)).status, 400);
    assert.equal(route.calls.length, 0);
    delete process.env.BLOB_READ_WRITE_TOKEN;
    assert.equal((await route.POST(request(pathname), context)).status, 503);
  } finally { if (old === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = old; }
});
