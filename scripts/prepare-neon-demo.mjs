import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { randomBytes, scryptSync } from 'node:crypto';
import { Client } from 'pg';
import dotenv from 'dotenv';
import { demoCopyTables, excludedDemoTables, validateDemoCopyTargets } from '../lib/deployment/neon-demo-copy.ts';
import { platformDemoIdentity } from '../lib/auth/demo-access.ts';

const quote = name => `"public"."${name.replaceAll('"', '""')}"`;
const allTables = [...demoCopyTables, ...excludedDemoTables];
const migrations = 'SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name';
export async function copyFictitiousDemo(source, target, apply, passwordHash) {
  let sourceOpen = false, targetOpen = false;
  try {
    await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); sourceOpen = true;
    await target.query('BEGIN'); targetOpen = true;
    await target.query("SET LOCAL lock_timeout = '10s'");
    await target.query("SET LOCAL statement_timeout = '60s'");
    if (apply) await target.query(`LOCK TABLE ${allTables.map(quote).join(', ')} IN ACCESS EXCLUSIVE MODE`);
    const sourceMigrations = await source.query(migrations), targetMigrations = await target.query(migrations);
    if (JSON.stringify(sourceMigrations.rows) !== JSON.stringify(targetMigrations.rows)) throw new Error('Source and target migrations differ; no data copied.');
    const tableSql = "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename";
    const expected = [...allTables].sort();
    for (const client of [source, target]) {
      const actual = (await client.query(tableSql)).rows.map(row => row.tablename);
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Unexpected table inventory; no data copied.');
    }
    for (const table of allTables) {
      const result = await target.query(`SELECT count(*)::int AS count FROM ${quote(table)}`);
      if (result.rows[0].count !== 0) throw new Error('Target is not empty; no data overwritten.');
    }
    const collision = await source.query('SELECT id FROM "User" WHERE id = $1 OR email = $2', [platformDemoIdentity.id, platformDemoIdentity.email]);
    if (collision.rowCount) throw new Error('Dedicated demo identity already exists in source; no data copied.');
    const counts = {};
    for (const table of demoCopyTables) {
      // Keep JSON as PostgreSQL text: never round monetary values through JS numbers.
      const result = await source.query(`SELECT count(*)::int AS count, coalesce(json_agg(t), '[]'::json)::text AS payload FROM ${quote(table)} t`);
      const { count, payload } = result.rows[0];
      counts[table] = count;
      if (Buffer.byteLength(payload) > 20 * 1024 * 1024) throw new Error('Demo table exceeds the bounded copy size.');
      if (apply && count > 0) {
        await target.query(`INSERT INTO ${quote(table)} SELECT * FROM json_populate_recordset(NULL::${quote(table)}, $1::json)`, [payload]);
        const copied = await target.query(`SELECT count(*)::int AS count FROM ${quote(table)}`);
        if (copied.rows[0].count !== count) throw new Error('Copied row count mismatch; rolling back.');
      }
    }
    if (apply) {
      await target.query('INSERT INTO "User" (id, name, email, "emailVerified", "passwordHash", "platformRole", "createdAt", "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, \'OWNER\', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', [platformDemoIdentity.id, 'Fictitious Platform Demo Administrator', platformDemoIdentity.email, passwordHash]);
      await target.query('COMMIT'); targetOpen = false;
    } else { await target.query('ROLLBACK'); targetOpen = false; }
    await source.query('ROLLBACK'); sourceOpen = false;
    return { applied: apply, copiedCounts: counts, excludedTables: excludedDemoTables, globalDemoAccount: apply ? platformDemoIdentity.email : null };
  } finally {
    if (targetOpen) await target.query('ROLLBACK').catch(() => {});
    if (sourceOpen) await source.query('ROLLBACK').catch(() => {});
  }
}
async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--apply'].includes(arg))) throw new Error('Usage: node --experimental-strip-types scripts/prepare-neon-demo.mjs [--apply]');
  const sourceEnv = dotenv.parse(readFileSync('.env.local.before-neon'));
  const targetEnv = dotenv.parse(readFileSync('.env.local'));
  const link = JSON.parse(readFileSync('.neon', 'utf8'));
  if (link.projectId !== process.env.DEMO_TARGET_PROJECT_ID || link.branch !== 'production' || targetEnv.NEON_BRANCH !== 'production') throw new Error('Explicit linked Neon production project confirmation is required.');
  const from = sourceEnv.DATABASE_URL, to = targetEnv.DATABASE_URL_UNPOOLED;
  validateDemoCopyTargets(from, to, process.env.DEMO_FICTITIOUS_DATA_CONFIRMED === 'true');
  const source = new Client({ connectionString: from }), target = new Client({ connectionString: to });
  try {
    await source.connect(); await target.connect();
    const salt = randomBytes(16);
    const key = scryptSync('admin', salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    const hash = `scrypt$32768$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`;
    console.log(JSON.stringify(await copyFictitiousDemo(source, target, args.includes('--apply'), hash)));
  } finally { await Promise.allSettled([source.end(), target.end()]); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => {
  console.error(error.code ? `Demo preparation failed (${error.code}); no automatic retry.` : error.message);
  process.exitCode = 1;
});
