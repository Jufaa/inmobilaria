import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function datasourceFor(env) {
  const code = ts.transpileModule(readFileSync(new URL('../prisma.config.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  new Function('require', 'exports', 'process', code)(id => {
    if (id === 'dotenv') return { __esModule: true, default: { config() {} } };
    if (id === 'prisma/config') return { defineConfig: value => value };
    throw new Error(`Unexpected dependency: ${id}`);
  }, exports, { env });
  return exports.default.datasource.url;
}

test('Prisma migrations prefer the direct Neon connection without changing the runtime URL', () => {
  const env = { DATABASE_URL: 'postgresql://pooled/app', DATABASE_URL_UNPOOLED: 'postgresql://direct/app' };
  assert.equal(datasourceFor(env), env.DATABASE_URL_UNPOOLED);
  assert.equal(env.DATABASE_URL, 'postgresql://pooled/app');
});
test('local development retains its existing DATABASE_URL fallback', () => {
  assert.equal(datasourceFor({ DATABASE_URL: 'postgresql://localhost/app' }), 'postgresql://localhost/app');
  assert.equal(datasourceFor({}), '');
});
