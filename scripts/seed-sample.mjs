import dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const agencyIds = {
  centro: 'sample-territorio-agency-centro',
  norte: 'sample-territorio-agency-norte',
};
const zoneIds = {
  centro: 'sample-territorio-zone-centro',
  norte: 'sample-territorio-zone-norte',
  parque: 'sample-territorio-zone-parque-sarmiento',
};
const propertyIds = {
  casa: 'sample-territorio-property-casa-centro',
  departamento: 'sample-territorio-property-departamento-centro',
  terreno: 'sample-territorio-property-terreno-norte',
  local: 'sample-territorio-property-local-norte',
};
const connectionId = 'sample-territorio-connection-centro-norte';
const grantId = 'sample-territorio-share-casa-centro-norte';

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} before running the sample seed.`);
  return value;
}

function validateLocalDatabaseTarget(connectionString) {
  let databaseUrl;
  try {
    databaseUrl = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }

  const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    throw new Error('Sample data can only be seeded into a local PostgreSQL database.');
  }
  if (!localHosts.has(databaseUrl.hostname.toLowerCase())) {
    throw new Error('Sample data seed blocked: DATABASE_URL must point to localhost or a loopback address.');
  }
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.CI) {
    throw new Error('Sample data seed blocked in production, hosted, or CI environments.');
  }
}

function percentage(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error(`${name} must be a whole number from 0 to 100.`);
  }
  return value;
}

function assertSampleIdentity(existing, expectedSlug, label) {
  if (existing && existing.slug !== expectedSlug) {
    throw new Error(`Sample seed ID collision for ${label}; no records were changed.`);
  }
}

function assertOwnedBySample(existing, expectedAgencyId, label) {
  if (existing && existing.agencyId !== expectedAgencyId) {
    throw new Error(`Sample seed ID collision for ${label}; no records were changed.`);
  }
}

async function main() {
  if (process.env.SAMPLE_DATA_SEED !== 'true') {
    throw new Error('Sample seed blocked. Set SAMPLE_DATA_SEED=true to explicitly enable it.');
  }

  const connectionString = requiredEnvironment('DATABASE_URL');
  const ownerEmail = requiredEnvironment('SAMPLE_OWNER_EMAIL').toLowerCase();
  const localAdminOwner = ownerEmail === 'admin@localhost';
  if (localAdminOwner && process.env.NODE_ENV !== 'development') {
    throw new Error('admin@localhost can only be used as SAMPLE_OWNER_EMAIL in development.');
  }
  if (!localAdminOwner && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    throw new Error('SAMPLE_OWNER_EMAIL must be a valid email address for an existing Google user.');
  }
  validateLocalDatabaseTarget(connectionString);

  const lowCommissionPercent = percentage('SAMPLE_LOW_COMMISSION_PERCENT', 50);
  const highCommissionPercent = percentage('SAMPLE_HIGH_COMMISSION_PERCENT', 50);
  if (lowCommissionPercent + highCommissionPercent !== 100) {
    throw new Error('The two sample commission percentages must add up to 100.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    let owner;
    if (localAdminOwner) {
      owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
    } else {
      owner = await prisma.user.findUnique({
        where: { email: ownerEmail },
        include: { accounts: { where: { provider: 'google' }, select: { id: true } } },
      });
      if (!owner || !owner.emailVerified || owner.accounts.length === 0) {
        throw new Error('SAMPLE_OWNER_EMAIL must belong to an existing, verified Google OAuth user; no user was created.');
      }
    }

    const agencies = [
      {
        id: agencyIds.centro,
        slug: 'ejemplo-territorio-centro',
        name: 'Ejemplo Inmobiliaria Centro',
        brandPrimaryColor: '#0F766E',
      },
      {
        id: agencyIds.norte,
        slug: 'ejemplo-territorio-norte',
        name: 'Ejemplo Inmobiliaria Norte',
        brandPrimaryColor: '#1D4ED8',
      },
    ];

    for (const agency of agencies) {
      const existing = await prisma.agency.findUnique({ where: { id: agency.id }, select: { slug: true } });
      assertSampleIdentity(existing, agency.slug, agency.name);
    }

    await prisma.$transaction(async (tx) => {
      if (localAdminOwner) {
        owner = await tx.user.upsert({
          where: { email: ownerEmail },
          create: { email: ownerEmail, name: 'Administrador local' },
          update: { name: 'Administrador local' },
          select: { id: true },
        });
      }
      await tx.user.update({ where: { id: owner.id }, data: { platformRole: 'OWNER' } });

      for (const agency of agencies) {
        await tx.agency.upsert({
          where: { id: agency.id },
          create: agency,
          update: { name: agency.name, slug: agency.slug, brandPrimaryColor: agency.brandPrimaryColor },
        });
        await tx.membership.upsert({
          where: { userId_agencyId: { userId: owner.id, agencyId: agency.id } },
          create: { userId: owner.id, agencyId: agency.id, role: 'OWNER' },
          update: { role: 'OWNER' },
        });
      }

      const zones = [
        { id: zoneIds.centro, agencyId: agencyIds.centro, name: 'Centro', latitude: -33.125, longitude: -64.348 },
        { id: zoneIds.norte, agencyId: agencyIds.norte, name: 'Banda Norte', latitude: -33.096, longitude: -64.352 },
        { id: zoneIds.parque, agencyId: agencyIds.norte, name: 'Parque Sarmiento (zona de ejemplo)', latitude: -33.112, longitude: -64.359 },
      ];
      for (const zone of zones) {
        const existing = await tx.zone.findUnique({ where: { id: zone.id }, select: { agencyId: true } });
        assertOwnedBySample(existing, zone.agencyId, `zone ${zone.name}`);
      }
      for (const zone of zones) {
        await tx.zone.upsert({
          where: { id: zone.id },
          create: { ...zone, city: 'Río Cuarto' },
          update: { ...zone, city: 'Río Cuarto' },
        });
      }

      const properties = [
        {
          id: propertyIds.casa, agencyId: agencyIds.centro, zoneId: zoneIds.centro,
          title: 'EJEMPLO — Casa familiar en Centro',
          description: 'Aviso ficticio de muestra para probar la plataforma. No corresponde a una propiedad real ni constituye una oferta.',
          type: 'HOUSE', operation: 'SALE', status: 'PUBLISHED', price: '98000', currency: 'USD',
          neighborhood: 'Centro', address: 'Dirección ficticia de muestra', area: '142', bedrooms: 3, bathrooms: 2,
          features: ['Patio de ejemplo', 'Cochera de ejemplo'], latitude: '-33.1256', longitude: '-64.3477',
        },
        {
          id: propertyIds.departamento, agencyId: agencyIds.centro, zoneId: zoneIds.centro,
          title: 'EJEMPLO — Departamento de un dormitorio',
          description: 'Aviso ficticio de muestra para probar la plataforma. No corresponde a una propiedad real ni constituye una oferta.',
          type: 'APARTMENT', operation: 'RENT', status: 'PUBLISHED', price: '320000', currency: 'ARS',
          neighborhood: 'Centro', address: 'Dirección ficticia de muestra', area: '48', bedrooms: 1, bathrooms: 1,
          features: ['Balcón de ejemplo', 'Ascensor de ejemplo'], latitude: '-33.1247', longitude: '-64.3490',
        },
        {
          id: propertyIds.terreno, agencyId: agencyIds.norte, zoneId: zoneIds.norte,
          title: 'EJEMPLO — Terreno residencial en Banda Norte',
          description: 'Aviso ficticio de muestra para probar la plataforma. No corresponde a un terreno real ni constituye una oferta.',
          type: 'LAND', operation: 'SALE', status: 'PUBLISHED', price: '26000', currency: 'USD',
          neighborhood: 'Banda Norte', address: 'Ubicación ficticia de muestra', area: '360', bedrooms: 0, bathrooms: 0,
          features: ['Medidas ilustrativas', 'Servicios a confirmar'], latitude: '-33.0966', longitude: '-64.3528',
        },
        {
          id: propertyIds.local, agencyId: agencyIds.norte, zoneId: zoneIds.parque,
          title: 'EJEMPLO — Local comercial de muestra',
          description: 'Aviso ficticio de muestra para probar la plataforma. No corresponde a una propiedad real ni constituye una oferta.',
          type: 'COMMERCIAL', operation: 'RENT', status: 'PUBLISHED', price: '450000', currency: 'ARS',
          neighborhood: 'Parque Sarmiento (zona de ejemplo)', address: 'Ubicación ficticia de muestra', area: '72', bedrooms: 0, bathrooms: 1,
          features: ['Frente de ejemplo', 'Superficie ilustrativa'], latitude: '-33.1127', longitude: '-64.3599',
        },
      ];
      const additionalProperties = [
        ['Departamento luminoso de dos ambientes', 'APARTMENT', 'SALE', '125000', 'USD', 'Centro', 'Dirección ficticia 101', '63', 1, 1, ['Balcón ilustrativo', 'Cocina integrada']],
        ['Casa con patio de muestra', 'HOUSE', 'RENT', '520000', 'ARS', 'Centro', 'Dirección ficticia 102', '118', 3, 2, ['Patio ilustrativo', 'Lavadero de muestra']],
        ['PH de tres ambientes', 'PH', 'SALE', '87000', 'USD', 'Centro', 'Dirección ficticia 103', '91', 2, 1, ['Terraza ilustrativa', 'Sin expensas de ejemplo']],
        ['Oficina comercial de muestra', 'COMMERCIAL', 'RENT', '380000', 'ARS', 'Centro', 'Dirección ficticia 104', '54', 0, 1, ['Recepción de muestra', 'Baño privado']],
        ['Lote urbano ilustrativo', 'LAND', 'SALE', '31000', 'USD', 'Centro', 'Dirección ficticia 105', '300', 0, 0, ['Frente ilustrativo', 'Servicios a verificar']],
        ['Casa de una planta', 'HOUSE', 'SALE', '143000', 'USD', 'Centro', 'Dirección ficticia 106', '156', 3, 2, ['Galería de ejemplo', 'Jardín ilustrativo']],
        ['Monoambiente equipado', 'APARTMENT', 'RENT', '285000', 'ARS', 'Centro', 'Dirección ficticia 107', '35', 0, 1, ['Placard ilustrativo', 'Espacio de guardado']],
        ['PH con patio interno', 'PH', 'RENT', '410000', 'ARS', 'Centro', 'Dirección ficticia 108', '76', 2, 1, ['Patio interno ficticio', 'Cocina separada']],
        ['Departamento con terraza', 'APARTMENT', 'SALE', '119000', 'USD', 'Banda Norte', 'Dirección ficticia 201', '70', 2, 1, ['Terraza de muestra', 'Parrilla ilustrativa']],
        ['Casa familiar con cochera', 'HOUSE', 'RENT', '610000', 'ARS', 'Banda Norte', 'Dirección ficticia 202', '174', 3, 2, ['Cochera de ejemplo', 'Patio de muestra']],
        ['Lote para vivienda', 'LAND', 'SALE', '28000', 'USD', 'Banda Norte', 'Dirección ficticia 203', '330', 0, 0, ['Medidas ilustrativas', 'Servicios a confirmar']],
        ['Local con vidriera', 'COMMERCIAL', 'SALE', '96000', 'USD', 'Banda Norte', 'Dirección ficticia 204', '81', 0, 1, ['Vidriera ficticia', 'Depósito de muestra']],
        ['Departamento de tres dormitorios', 'APARTMENT', 'RENT', '570000', 'ARS', 'Banda Norte', 'Dirección ficticia 205', '102', 3, 2, ['Balcón de ejemplo', 'Dos baños de muestra']],
        ['Casa moderna de muestra', 'HOUSE', 'SALE', '168000', 'USD', 'Banda Norte', 'Dirección ficticia 206', '189', 4, 3, ['Galería ilustrativa', 'Jardín de muestra']],
        ['Oficina profesional', 'COMMERCIAL', 'RENT', '330000', 'ARS', 'Banda Norte', 'Dirección ficticia 207', '46', 0, 1, ['Sala de espera ficticia', 'Instalación ilustrativa']],
        ['PH interno de dos dormitorios', 'PH', 'SALE', '79000', 'USD', 'Banda Norte', 'Dirección ficticia 208', '84', 2, 1, ['Patio ilustrativo', 'Acceso independiente de muestra']],
      ].map(([title, type, operation, price, currency, neighborhood, address, area, bedrooms, bathrooms, features], index) => {
        const isCentro = index < 8;
        return {
          id: `sample-territorio-property-demo-${String(index + 1).padStart(2, '0')}`,
          agencyId: isCentro ? agencyIds.centro : agencyIds.norte,
          zoneId: isCentro ? zoneIds.centro : zoneIds.norte,
          title: `EJEMPLO — ${title}`,
          description: 'Aviso completamente ficticio para probar el panel. No corresponde a una propiedad real ni constituye una oferta inmobiliaria.',
          type, operation, status: 'DRAFT', price, currency, neighborhood,
          address: `${address}, ubicación ficticia`, area, bedrooms, bathrooms, features,
          latitude: null, longitude: null,
        };
      });
      properties.push(...additionalProperties);

      for (const property of properties) {
        const existing = await tx.property.findUnique({ where: { id: property.id }, select: { agencyId: true, title: true } });
        if (existing && (existing.agencyId !== property.agencyId || !existing.title.startsWith('EJEMPLO —'))) {
          throw new Error(`Sample seed ID collision for property ${property.id}; no records were changed.`);
        }
      }
      for (const property of properties) {
        await tx.property.upsert({
          where: { id: property.id },
          create: property,
          update: property,
        });
      }

      const points = [
        {
          id: 'sample-territorio-poi-centro', agencyId: agencyIds.centro, zoneId: zoneIds.centro,
          name: 'Plaza ficticia de ejemplo', category: 'PARK',
          description: 'Punto de interés ficticio para probar el mapa; no representa un lugar real.',
          latitude: -33.124, longitude: -64.347,
        },
        {
          id: 'sample-territorio-poi-norte', agencyId: agencyIds.norte, zoneId: zoneIds.norte,
          name: 'Avenida ficticia de ejemplo', category: 'AVENUE',
          description: 'Punto de interés ficticio para probar el mapa; no representa un lugar real.',
          latitude: -33.095, longitude: -64.351,
        },
      ];
      for (const point of points) {
        const existing = await tx.pointOfInterest.findUnique({ where: { id: point.id }, select: { agencyId: true, name: true } });
        if (existing && (existing.agencyId !== point.agencyId || !existing.name.includes('ficticia de ejemplo'))) {
          throw new Error(`Sample seed ID collision for point of interest ${point.id}; no records were changed.`);
        }
      }
      for (const point of points) {
        await tx.pointOfInterest.upsert({
          where: { id: point.id },
          create: point,
          update: point,
        });
      }

      const existingConnection = await tx.agencyConnection.findUnique({ where: { id: connectionId }, select: { agencyLowId: true, agencyHighId: true } });
      if (existingConnection && (existingConnection.agencyLowId !== agencyIds.centro || existingConnection.agencyHighId !== agencyIds.norte)) {
        throw new Error('Sample seed ID collision for the collaboration; no records were changed.');
      }
      await tx.agencyConnection.upsert({
        where: { id: connectionId },
        create: {
          id: connectionId,
          agencyLowId: agencyIds.centro,
          agencyHighId: agencyIds.norte,
          requestedByAgencyId: agencyIds.centro,
          status: 'ACCEPTED',
          lowCommissionPercent,
          highCommissionPercent,
          respondedAt: new Date(),
        },
        update: {
          status: 'ACCEPTED',
          lowCommissionPercent,
          highCommissionPercent,
          respondedAt: new Date(),
          endedAt: null,
        },
      });

      const existingGrant = await tx.propertyShareGrant.findUnique({ where: { id: grantId }, select: { propertyId: true, ownerAgencyId: true, recipientAgencyId: true } });
      if (existingGrant && (existingGrant.propertyId !== propertyIds.casa || existingGrant.ownerAgencyId !== agencyIds.centro || existingGrant.recipientAgencyId !== agencyIds.norte)) {
        throw new Error('Sample seed ID collision for the property share; no records were changed.');
      }
      await tx.propertyShareGrant.upsert({
        where: { id: grantId },
        create: {
          id: grantId,
          connectionId,
          propertyId: propertyIds.casa,
          ownerAgencyId: agencyIds.centro,
          recipientAgencyId: agencyIds.norte,
          grantedByUserId: owner.id,
          active: true,
        },
        update: { connectionId, propertyId: propertyIds.casa, ownerAgencyId: agencyIds.centro,
          recipientAgencyId: agencyIds.norte, grantedByUserId: owner.id, active: true, revokedAt: null },
      });
    });

    console.log('Sample seed completed: 2 fictional agencies, 4 published map-ready properties, 16 draft properties, 3 zones, 2 fictional points of interest, and 1 accepted collaboration with 1 active property share. The selected sample owner is a global platform OWNER.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Sample seed failed.');
  process.exitCode = 1;
});
