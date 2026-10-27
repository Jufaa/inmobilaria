import { PrismaPg } from '@prisma/adapter-pg';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client.ts';

const DEMO_USER_ID = 'territorio-demo-access-user';
const DEMO_AGENCY_ID = 'territorio-fictitious-demo-agency';

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} before running the demo access seed.`);
  return value;
}

function assertLocalDatabaseTarget(connectionString) {
  let databaseUrl;
  try {
    databaseUrl = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }

  const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol) || !loopbackHosts.has(databaseUrl.hostname.toLowerCase())) {
    throw new Error('Demo access seed blocked: DATABASE_URL must point to a local PostgreSQL database.');
  }
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.CI) {
    throw new Error('Demo access seed blocked in production, hosted, or CI environments.');
  }
}

function hashPassword(password) {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) return reject(error);
      resolve(`scrypt$32768$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`);
    });
  });
}

async function main() {
  if (process.env.DEMO_ACCESS_ENABLED !== 'true' || process.env.DEMO_DATA_SEED !== 'true') {
    throw new Error('Demo access seed blocked. Set DEMO_ACCESS_ENABLED=true and DEMO_DATA_SEED=true explicitly.');
  }
  const connectionString = requiredEnvironment('DATABASE_URL');
  const username = requiredEnvironment('DEMO_ADMIN_USERNAME');
  const password = requiredEnvironment('DEMO_ADMIN_PASSWORD');
  const email = requiredEnvironment('DEMO_ADMIN_EMAIL').toLowerCase();
  const agencySlug = requiredEnvironment('DEMO_AGENCY_SLUG');
  if (username !== 'admin' || password !== 'admin') throw new Error('The fictional demo login must use admin/admin.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('DEMO_ADMIN_EMAIL must be a valid email address.');
  assertLocalDatabaseTarget(connectionString);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const [userById, userByEmail, agencyById, agencyBySlug] = await Promise.all([
      prisma.user.findUnique({ where: { id: DEMO_USER_ID }, select: { id: true, email: true } }),
      prisma.user.findUnique({ where: { email }, select: { id: true, email: true } }),
      prisma.agency.findUnique({ where: { id: DEMO_AGENCY_ID }, select: { id: true, slug: true } }),
      prisma.agency.findUnique({ where: { slug: agencySlug }, select: { id: true, slug: true } }),
    ]);
    if ((userById && userById.email !== email) || (userByEmail && userByEmail.id !== DEMO_USER_ID)) {
      throw new Error('Demo user identity collision; no records were changed.');
    }
    if ((agencyById && agencyById.slug !== agencySlug) || (agencyBySlug && agencyBySlug.id !== DEMO_AGENCY_ID)) {
      throw new Error('Demo agency identity collision; no records were changed.');
    }

    const existingMemberships = await prisma.membership.findMany({ where: { userId: DEMO_USER_ID }, select: { agencyId: true } });
    if (existingMemberships.some((membership) => membership.agencyId !== DEMO_AGENCY_ID)) {
      throw new Error('Demo user already has a non-demo agency membership; no records were changed.');
    }

    const passwordHash = await hashPassword(password);
    await prisma.$transaction(async (tx) => {
      await tx.agency.upsert({
        where: { id: DEMO_AGENCY_ID },
        create: { id: DEMO_AGENCY_ID, name: 'Fictitious Territorio Demo', slug: agencySlug },
        update: { name: 'Fictitious Territorio Demo', slug: agencySlug },
      });
      await tx.user.upsert({
        where: { id: DEMO_USER_ID },
        create: { id: DEMO_USER_ID, name: 'Demo Administrator', email, passwordHash, platformRole: 'USER' },
        update: { name: 'Demo Administrator', email, passwordHash, platformRole: 'USER' },
      });
      await tx.membership.upsert({
        where: { userId_agencyId: { userId: DEMO_USER_ID, agencyId: DEMO_AGENCY_ID } },
        create: { userId: DEMO_USER_ID, agencyId: DEMO_AGENCY_ID, role: 'ADMIN' },
        update: { role: 'ADMIN' },
      });
    });
    process.stdout.write('Demo access account and agency are ready.\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Demo access seed failed.'}\n`);
  process.exitCode = 1;
});
