import test from 'node:test';
import assert from 'node:assert/strict';
import { demoCopyTables, excludedDemoTables, validateDemoCopyTargets } from '../lib/deployment/neon-demo-copy.ts';
import { copyFictitiousDemo } from '../scripts/prepare-neon-demo.mjs';

test('demo transfer rejects unconfirmed data, remote sources and pooled or non-Neon targets', () => {
  const local = 'postgresql://localhost/source', neon = 'postgresql://ep-demo.us-east-2.aws.neon.tech/target';
  assert.doesNotThrow(() => validateDemoCopyTargets(local, neon, true));
  for (const [from, to, confirmed] of [[local, neon, false], [neon, neon, true], [local, 'postgresql://ep-demo-pooler.us-east-2.aws.neon.tech/target', true], [local, local, true]]) assert.throws(() => validateDemoCopyTargets(from, to, confirmed));
});
function fixture({ occupied = false, failInsert = false } = {}) {
  const sourceQueries = [], targetQueries = [], copied = new Set();
  const inventory = [...demoCopyTables, ...excludedDemoTables].sort().map(tablename => ({ tablename }));
  const source = { async query(sql) {
    sourceQueries.push(sql);
    if (sql.includes('migration_name')) return { rows: [{ migration_name: 'same', checksum: 'same' }] };
    if (sql.includes('pg_tables')) return { rows: inventory };
    if (sql.startsWith('SELECT id')) return { rowCount: 0 };
    if (sql.includes('json_agg')) return { rows: [{ count: sql.includes('"Property"') ? 1 : 0, payload: sql.includes('"Property"') ? '[{"price":123456789.123456}]' : '[]' }] };
    return { rows: [] };
  } };
  const target = { async query(sql, params) {
    targetQueries.push([sql, params]);
    if (sql.includes('migration_name')) return { rows: [{ migration_name: 'same', checksum: 'same' }] };
    if (sql.includes('pg_tables')) return { rows: inventory };
    if (sql.includes('count(*)')) return { rows: [{ count: occupied || copied.has(sql.match(/FROM (.*)$/)[1]) ? 1 : 0 }] };
    if (sql.includes('json_populate_recordset')) { if (failInsert) throw new Error('injected failure'); copied.add(sql.match(/INSERT INTO (.*?) SELECT/)[1]); }
    return { rows: [] };
  } };
  return { source, target, sourceQueries, targetQueries };
}
test('nonempty destination is rejected transactionally before inserts', async () => {
  const f = fixture({ occupied: true });
  await assert.rejects(copyFictitiousDemo(f.source, f.target, true, 'hash'), /not empty/);
  assert.ok(f.targetQueries.some(([sql]) => sql.startsWith('LOCK TABLE')));
  assert.ok(f.targetQueries.some(([sql]) => sql === 'ROLLBACK'));
  assert.ok(!f.targetQueries.some(([sql]) => sql.startsWith('INSERT') || sql === 'COMMIT'));
});
test('copy preserves decimal JSON, excludes tokens and migrations and provisions a separate owner in the same transaction', async () => {
  const f = fixture();
  const result = await copyFictitiousDemo(f.source, f.target, true, 'hashed-password');
  assert.equal(result.applied, true);
  assert.equal(result.copiedCounts.Property, 1);
  const insert = f.targetQueries.find(([sql]) => sql.includes('json_populate_recordset'));
  assert.deepEqual(insert[1], ['[{"price":123456789.123456}]']);
  assert.ok(f.targetQueries.some(([sql, params]) => sql.startsWith('INSERT INTO "User"') && params.includes('hashed-password')));
  for (const table of [...excludedDemoTables, '_prisma_migrations']) assert.ok(!f.targetQueries.some(([sql]) => sql.startsWith(`INSERT INTO "public"."${table}"`)));
  assert.ok(f.sourceQueries.includes('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));
  assert.ok(!f.sourceQueries.some(sql => sql.startsWith('INSERT') || sql.startsWith('UPDATE') || sql.startsWith('DELETE')));
  assert.ok(f.targetQueries.some(([sql]) => sql === 'COMMIT'));
});
test('an insert failure rolls back instead of leaving a partial import or account', async () => {
  const f = fixture({ failInsert: true });
  await assert.rejects(copyFictitiousDemo(f.source, f.target, true, 'hash'), /injected failure/);
  assert.ok(f.targetQueries.some(([sql]) => sql === 'ROLLBACK'));
  assert.ok(!f.targetQueries.some(([sql]) => sql === 'COMMIT' || sql.startsWith('INSERT INTO "User"')));
});
