import 'server-only';

import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

export const publicPropertyOperations = ['SALE', 'RENT'] as const;
export const publicPropertyTypes = [
  'APARTMENT',
  'HOUSE',
  'PH',
  'LAND',
  'COMMERCIAL',
  'OTHER',
] as const;
export const publicPropertyCurrencies = ['ARS', 'USD'] as const;

export type PublicPropertyFilters = {
  operation?: (typeof publicPropertyOperations)[number];
  type?: (typeof publicPropertyTypes)[number];
  currency?: (typeof publicPropertyCurrencies)[number];
  neighborhood?: string;
  zoneId?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  page?: number;
  agencySlug?: string;
};

export type PublicZone = {
  id: string;
  name: string;
  city: string;
  geometry: Prisma.JsonValue | null;
  latitude: number | null;
  longitude: number | null;
};

export type PublicPointOfInterest = {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  zoneName: string | null;
};

export type PublicProperty = {
  id: string;
  title: string;
  description: string;
  type: (typeof publicPropertyTypes)[number];
  operation: (typeof publicPropertyOperations)[number];
  price: number;
  currency: (typeof publicPropertyCurrencies)[number];
  neighborhood: string;
  area: number;
  bedrooms: number;
  bathrooms: number;
  features: string[];
  latitude: number | null;
  longitude: number | null;
  agencyName: string;
  presentedByName: string | null;
};

export type PublicPropertyDiscoveryResult = {
  properties: PublicProperty[];
  agencies: { slug: string; name: string }[];
  neighborhoods: string[];
  zones: PublicZone[];
  pointsOfInterest: PublicPointOfInterest[];
  page: number;
  pageSize: number;
  total: number;
  available: boolean;
  agencyContext: { slug: string; name: string } | null;
};

const pageSize = 48;
const maxPage = 10_000;

function approximateCoordinate(value: { toNumber(): number } | null) {
  if (!value) return null;
  // Public map pins are intentionally approximate, never rooftop coordinates.
  return Math.round(value.toNumber() * 1_000) / 1_000;
}

function normalizeFilters(filters: PublicPropertyFilters) {
  const page = Number.isInteger(filters.page)
    ? Math.min(Math.max(filters.page ?? 1, 1), maxPage)
    : 1;
  const minPrice = Number.isFinite(filters.minPrice)
    ? Math.max(0, filters.minPrice ?? 0)
    : undefined;
  const maxPrice = Number.isFinite(filters.maxPrice)
    ? Math.max(0, filters.maxPrice ?? 0)
    : undefined;

  return { page, minPrice, maxPrice };
}

export async function getPublicPropertyDiscovery(
  filters: PublicPropertyFilters = {},
): Promise<PublicPropertyDiscoveryResult> {
  const normalized = normalizeFilters(filters);
  let agencyContext: { id: string; slug: string; name: string } | null = null;
  if (filters.agencySlug && filters.agencySlug.length <= 60) {
    try {
      const agency = await prisma.agency.findUnique({
        where: { slug: filters.agencySlug },
        select: { id: true, slug: true, name: true },
      });
      if (agency) agencyContext = agency;
    } catch {
      agencyContext = null;
    }
  }
  let selectedZone: { id: string; name: string } | null = null;
  if (filters.zoneId && filters.zoneId.length <= 64) {
    try {
      selectedZone = await prisma.zone.findFirst({
        where: { id: filters.zoneId, properties: { some: { status: 'PUBLISHED' } } },
        select: { id: true, name: true },
      });
    } catch {
      selectedZone = null;
    }
  }
  const where = {
    status: 'PUBLISHED',
    ...(filters.agencySlug && !agencyContext ? { id: { in: [] } } : {}),
    ...(agencyContext
      ? {
          AND: [{
            OR: [
            { agencyId: agencyContext.id },
            {
              shareGrants: {
                some: {
                  recipientAgencyId: agencyContext.id,
                  active: true,
                  connection: { status: 'ACCEPTED' },
                },
              },
            },
            ],
          }],
        }
      : {}),
    ...(filters.operation ? { operation: filters.operation } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.currency ? { currency: filters.currency } : {}),
    ...(selectedZone
      ? { OR: [{ zoneId: selectedZone.id }, { neighborhood: selectedZone.name }] }
      : filters.neighborhood ? { neighborhood: filters.neighborhood } : {}),
    ...(filters.minBedrooms !== undefined
      ? { bedrooms: { gte: Math.max(0, filters.minBedrooms) } }
      : {}),
    ...(normalized.minPrice !== undefined || normalized.maxPrice !== undefined
      ? {
          price: {
            ...(normalized.minPrice !== undefined
              ? { gte: normalized.minPrice }
              : {}),
            ...(normalized.maxPrice !== undefined
              ? { lte: normalized.maxPrice }
              : {}),
          },
        }
      : {}),
  } satisfies Prisma.PropertyWhereInput;

  if (!process.env.DATABASE_URL?.trim()) {
    return {
      properties: [],
      agencies: [],
      neighborhoods: [],
      zones: [],
      pointsOfInterest: [],
      page: normalized.page,
      pageSize,
      total: 0,
      available: false,
      agencyContext: null,
    };
  }

  try {
    const [rows, total, neighborhoodRows, zoneRows, pointRows, agencies] = await Promise.all([
      prisma.property.findMany({
        where,
        select: {
          id: true,
          agencyId: true,
          title: true,
          description: true,
          type: true,
          operation: true,
          price: true,
          currency: true,
          neighborhood: true,
          area: true,
          bedrooms: true,
          bathrooms: true,
          features: true,
          latitude: true,
          longitude: true,
          agency: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (normalized.page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.property.count({ where }),
      prisma.property.findMany({
        where: { ...where },
        select: { neighborhood: true },
        distinct: ['neighborhood'],
        orderBy: { neighborhood: 'asc' },
      }),
      prisma.zone.findMany({
        where: { properties: { some: { status: 'PUBLISHED' } } },
        select: { id: true, name: true, city: true, geometry: true, latitude: true, longitude: true },
        orderBy: [{ city: 'asc' }, { name: 'asc' }],
      }),
      prisma.pointOfInterest.findMany({
        where: {
          agency: { properties: { some: { status: 'PUBLISHED' } } },
          ...(selectedZone ? { OR: [{ zoneId: selectedZone.id }, { zoneId: null }] } : {}),
        },
        select: { id: true, name: true, category: true, latitude: true, longitude: true, zone: { select: { name: true } } },
        orderBy: { name: 'asc' },
        take: 100,
      }),
      prisma.agency.findMany({
        where: { properties: { some: { status: 'PUBLISHED' } } },
        select: { slug: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      properties: rows.map((property) => ({
        id: property.id,
        title: property.title,
        description: property.description,
        type: property.type,
        operation: property.operation,
        price: property.price.toNumber(),
        currency: property.currency,
        neighborhood: property.neighborhood,
        area: property.area.toNumber(),
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        features: property.features,
        latitude: approximateCoordinate(property.latitude),
        longitude: approximateCoordinate(property.longitude),
        agencyName: property.agency.name,
        presentedByName: agencyContext && property.agencyId !== agencyContext.id
          ? agencyContext.name
          : null,
      })),
      agencies,
      neighborhoods: neighborhoodRows.map((row) => row.neighborhood),
      zones: zoneRows.map((zone) => ({
        id: zone.id,
        name: zone.name,
        city: zone.city,
        geometry: zone.geometry,
        latitude: approximateCoordinate(zone.latitude),
        longitude: approximateCoordinate(zone.longitude),
      })),
      pointsOfInterest: pointRows.map((point) => ({
        id: point.id,
        name: point.name,
        category: point.category,
        latitude: approximateCoordinate(point.latitude) ?? 0,
        longitude: approximateCoordinate(point.longitude) ?? 0,
        zoneName: point.zone?.name ?? null,
      })),
      page: normalized.page,
      pageSize,
      total,
      available: true,
      agencyContext: agencyContext ? { slug: agencyContext.slug, name: agencyContext.name } : null,
    };
  } catch {
    // Public discovery remains renderable while a database is not yet configured.
    return {
      properties: [],
      agencies: [],
      neighborhoods: [],
      zones: [],
      pointsOfInterest: [],
      page: normalized.page,
      pageSize,
      total: 0,
      available: false,
      agencyContext: null,
    };
  }
}
