import 'server-only';

import { Prisma, type AnalyticsEventType, type PriceCurrency, type PropertyOperation, type PropertyType } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

export const publicAnalyticsTypes = [
  'LISTING_VIEW',
  'PROPERTY_VIEW',
  'SEARCH',
  'ZONE_SELECTION',
] as const;

export type PublicAnalyticsInput = {
  type: (typeof publicAnalyticsTypes)[number];
  presentingAgencySlug?: string;
  propertyId?: string;
  propertyIds?: string[];
  zoneId?: string;
  operation?: PropertyOperation;
  propertyType?: PropertyType;
  currency?: PriceCurrency;
  bedroomsFrom?: number;
  neighborhood?: string;
};

type EventDimensions = Pick<
  PublicAnalyticsInput,
  'zoneId' | 'operation' | 'propertyType' | 'currency' | 'bedroomsFrom'
>;

async function insertForAgencies(
  agencyIds: string[],
  type: AnalyticsEventType,
  dimensions: EventDimensions = {},
  presentingAgencyId?: string,
) {
  const uniqueAgencyIds = [...new Set(agencyIds)].slice(0, 250);
  if (uniqueAgencyIds.length === 0) return;

  await prisma.analyticsEvent.createMany({
    data: uniqueAgencyIds.map((agencyId) => ({
      agencyId,
      presentingAgencyId,
      type,
      zoneId: dimensions.zoneId,
      operation: dimensions.operation,
      propertyType: dimensions.propertyType,
      currency: dimensions.currency,
      bedroomsFrom: dimensions.bedroomsFrom,
    })),
  });
}

function validId(value: string | undefined) {
  return typeof value === 'string' && value.length > 0 && value.length <= 64;
}

async function resolvePresentingAgency(slug: string | undefined) {
  if (!slug) return null;
  if (slug.length > 60 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  return prisma.agency.findUnique({ where: { slug }, select: { id: true } });
}

function visibleToAgency(presentingAgencyId: string): Prisma.PropertyWhereInput {
  return {
    OR: [
      { agencyId: presentingAgencyId },
      {
        shareGrants: {
          some: {
            recipientAgencyId: presentingAgencyId,
            active: true,
            connection: { status: 'ACCEPTED' },
          },
        },
      },
    ],
  };
}

export async function recordPublicNavigationEvent(input: PublicAnalyticsInput) {
  const presentingAgency = await resolvePresentingAgency(input.presentingAgencySlug);
  if (input.presentingAgencySlug && !presentingAgency) return;
  const presentingAgencyId = presentingAgency?.id;

  if (input.type === 'PROPERTY_VIEW') {
    if (!validId(input.propertyId)) return;
    const property = await prisma.property.findFirst({
      where: {
        id: input.propertyId,
        status: 'PUBLISHED',
        ...(presentingAgencyId ? visibleToAgency(presentingAgencyId) : {}),
      },
      select: { id: true, agencyId: true, zoneId: true, operation: true, type: true, currency: true },
    });
    if (!property) return;
    await prisma.analyticsEvent.create({
      data: {
        agencyId: property.agencyId,
        presentingAgencyId,
        propertyId: property.id,
        zoneId: property.zoneId,
        type: 'PROPERTY_VIEW',
        operation: property.operation,
        propertyType: property.type,
        currency: property.currency,
      },
    });
    return;
  }

  if (input.type === 'ZONE_SELECTION') {
    if (!validId(input.zoneId)) return;
    const zone = await prisma.zone.findFirst({
      where: {
        id: input.zoneId,
        properties: {
          some: {
            status: 'PUBLISHED',
            ...(presentingAgencyId ? visibleToAgency(presentingAgencyId) : {}),
          },
        },
      },
      select: {
        id: true,
        properties: {
          where: {
            status: 'PUBLISHED',
            ...(presentingAgencyId ? visibleToAgency(presentingAgencyId) : {}),
          },
          select: { agencyId: true },
        },
      },
    });
    if (!zone) return;
    await insertForAgencies(
      zone.properties.map((property) => property.agencyId),
      'ZONE_SELECTION',
      { zoneId: zone.id },
      presentingAgencyId,
    );
    return;
  }

  if (input.type === 'LISTING_VIEW') {
    if (!Array.isArray(input.propertyIds) || input.propertyIds.length === 0 || input.propertyIds.length > 48) return;
    const ids = input.propertyIds.filter(validId);
    if (ids.length === 0) return;
    const properties = await prisma.property.findMany({
      where: {
        id: { in: [...new Set(ids)] },
        status: 'PUBLISHED',
        ...(presentingAgencyId ? visibleToAgency(presentingAgencyId) : {}),
      },
      select: { agencyId: true },
      distinct: ['agencyId'],
    });
    await insertForAgencies(properties.map((property) => property.agencyId), 'LISTING_VIEW', {}, presentingAgencyId);
    return;
  }

  if (input.type === 'SEARCH') {
    let selectedZone: { id: string; name: string } | null = null;
    if (input.zoneId) {
      if (!validId(input.zoneId)) return;
      selectedZone = await prisma.zone.findFirst({
        where: {
          id: input.zoneId,
          properties: {
            some: {
              status: 'PUBLISHED',
              ...(presentingAgencyId ? visibleToAgency(presentingAgencyId) : {}),
            },
          },
        },
        select: { id: true, name: true },
      });
      if (!selectedZone) return;
    }

    let neighborhood: string | undefined;
    if (input.neighborhood) {
      if (input.neighborhood.length > 120) return;
      const match = await prisma.property.findFirst({
        where: { neighborhood: input.neighborhood, status: 'PUBLISHED' },
        select: { neighborhood: true },
      });
      if (!match) return;
      neighborhood = match.neighborhood;
    }

    const where: Prisma.PropertyWhereInput = {
      status: 'PUBLISHED',
      ...(presentingAgencyId ? { AND: [visibleToAgency(presentingAgencyId)] } : {}),
      ...(input.operation ? { operation: input.operation } : {}),
      ...(input.propertyType ? { type: input.propertyType } : {}),
      ...(input.currency ? { currency: input.currency } : {}),
      ...(input.bedroomsFrom !== undefined ? { bedrooms: { gte: input.bedroomsFrom } } : {}),
      ...(selectedZone ? { OR: [{ zoneId: selectedZone.id }, { neighborhood: selectedZone.name }] } : {}),
      ...(neighborhood ? { neighborhood } : {}),
    };
    let properties = await prisma.property.findMany({
      where,
      select: { agencyId: true },
      distinct: ['agencyId'],
      take: 250,
    });
    // Preserve zone demand when no currently published listing matches its other filters.
    if (properties.length === 0 && selectedZone) {
      properties = await prisma.property.findMany({
        where: {
          status: 'PUBLISHED',
          ...(presentingAgencyId ? { AND: [visibleToAgency(presentingAgencyId)] } : {}),
          OR: [{ zoneId: selectedZone.id }, { neighborhood: selectedZone.name }],
        },
        select: { agencyId: true },
        distinct: ['agencyId'],
        take: 250,
      });
    }
    await insertForAgencies(properties.map((property) => property.agencyId), 'SEARCH', {
      zoneId: selectedZone?.id,
      operation: input.operation,
      propertyType: input.propertyType,
      currency: input.currency,
      bedroomsFrom: input.bedroomsFrom,
    }, presentingAgencyId);
  }
}

const dashboardEventTypes = [
  'LISTING_VIEW',
  'PROPERTY_VIEW',
  'SEARCH',
  'ZONE_SELECTION',
  'INQUIRY_SUBMISSION',
] as const;

export async function getAgencyAnalytics(agencyId: string, days = 30) {
  const periodDays = days === 7 ? 7 : days === 90 ? 90 : 30;
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const where = { OR: [{ agencyId }, { presentingAgencyId: agencyId }], createdAt: { gte: since } };
  const [totals, propertyViews, zoneActivity, dailyRows] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ['type'],
      where,
      _count: { _all: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ['propertyId'],
      where: { ...where, propertyId: { not: null }, type: { in: ['PROPERTY_VIEW', 'INQUIRY_SUBMISSION'] } },
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
    prisma.analyticsEvent.groupBy({
      by: ['zoneId'],
      where: { ...where, zoneId: { not: null }, type: { in: ['ZONE_SELECTION', 'SEARCH'] } },
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
    prisma.$queryRaw<{ day: Date; type: string; count: number }[]>(Prisma.sql`
      SELECT date_trunc('day', "createdAt") AS day, "type"::text AS type, count(*)::int AS count
      FROM "AnalyticsEvent"
      WHERE ("agencyId" = ${agencyId} OR "presentingAgencyId" = ${agencyId}) AND "createdAt" >= ${since}
      GROUP BY date_trunc('day', "createdAt"), "type"
      ORDER BY day ASC
    `),
  ]);

  const propertyIds = propertyViews.flatMap((row) => row.propertyId ? [row.propertyId] : []);
  const zoneIds = zoneActivity.flatMap((row) => row.zoneId ? [row.zoneId] : []);
  const [properties, zones] = await Promise.all([
    prisma.property.findMany({ where: { id: { in: propertyIds } }, select: { id: true, title: true } }),
    prisma.zone.findMany({ where: { id: { in: zoneIds } }, select: { id: true, name: true, city: true } }),
  ]);
  const propertyNames = new Map(properties.map((property) => [property.id, property.title]));
  const zoneNames = new Map(zones.map((zone) => [zone.id, `${zone.name} · ${zone.city}`]));
  const countFor = (type: (typeof dashboardEventTypes)[number]) =>
    totals.find((item) => item.type === type)?._count._all ?? 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daily = Array.from({ length: periodDays }, (_, index) => {
    const day = new Date(today.getTime() - (periodDays - index - 1) * 24 * 60 * 60 * 1000);
    const key = day.toISOString().slice(0, 10);
    const dayRows = dailyRows.filter((row) => row.day.toISOString().slice(0, 10) === key);
    return {
      day: key,
      listingViews: dayRows.find((row) => row.type === 'LISTING_VIEW')?.count ?? 0,
      propertyViews: dayRows.find((row) => row.type === 'PROPERTY_VIEW')?.count ?? 0,
      searches: dayRows.find((row) => row.type === 'SEARCH')?.count ?? 0,
      inquiries: dayRows.find((row) => row.type === 'INQUIRY_SUBMISSION')?.count ?? 0,
    };
  });

  return {
    periodDays,
    counts: {
      listingViews: countFor('LISTING_VIEW'),
      propertyViews: countFor('PROPERTY_VIEW'),
      searches: countFor('SEARCH'),
      zoneSelections: countFor('ZONE_SELECTION'),
      inquiries: countFor('INQUIRY_SUBMISSION'),
    },
    daily,
    properties: propertyViews.map((row) => ({
      id: row.propertyId!,
      title: propertyNames.get(row.propertyId!) ?? 'Propiedad eliminada',
      events: row._count._all,
    })),
    zones: zoneActivity.map((row) => ({
      id: row.zoneId!,
      name: zoneNames.get(row.zoneId!) ?? 'Barrio eliminado',
      events: row._count._all,
    })),
  };
}
