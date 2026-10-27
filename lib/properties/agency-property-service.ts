import 'server-only';

import { prisma } from '@/lib/prisma';

export const propertyTypes = [
  'APARTMENT',
  'HOUSE',
  'PH',
  'LAND',
  'COMMERCIAL',
  'OTHER',
] as const;
export const propertyOperations = ['SALE', 'RENT'] as const;
export const propertyStatuses = [
  'DRAFT',
  'PUBLISHED',
  'RESERVED',
  'SOLD',
  'UNAVAILABLE',
] as const;
export const propertyCurrencies = ['ARS', 'USD'] as const;

export type AgencyPropertyInput = {
  title: string;
  description: string;
  type: (typeof propertyTypes)[number];
  operation: (typeof propertyOperations)[number];
  status: (typeof propertyStatuses)[number];
  price: number;
  currency: (typeof propertyCurrencies)[number];
  neighborhood: string;
  address: string;
  area: number;
  bedrooms: number;
  bathrooms: number;
  features: string[];
  latitude: number | null;
  longitude: number | null;
};

export type AgencyPropertyRecord = AgencyPropertyInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  media: {
    id: string;
    kind: 'PHOTO' | 'VIDEO' | 'TOUR_360';
    url: string;
    caption: string | null;
    sortOrder: number;
  }[];
};

function toRecord(property: {
  id: string;
  title: string;
  description: string;
  type: AgencyPropertyInput['type'];
  operation: AgencyPropertyInput['operation'];
  status: AgencyPropertyInput['status'];
  price: { toNumber(): number };
  currency: AgencyPropertyInput['currency'];
  neighborhood: string;
  address: string;
  area: { toNumber(): number };
  bedrooms: number;
  bathrooms: number;
  features: string[];
  latitude: { toNumber(): number } | null;
  longitude: { toNumber(): number } | null;
  createdAt: Date;
  updatedAt: Date;
  media: { id: string; kind: 'PHOTO' | 'VIDEO' | 'TOUR_360'; url: string; caption: string | null; sortOrder: number }[];
}): AgencyPropertyRecord {
  return {
    id: property.id,
    title: property.title,
    description: property.description,
    type: property.type,
    operation: property.operation,
    status: property.status,
    price: property.price.toNumber(),
    currency: property.currency,
    neighborhood: property.neighborhood,
    address: property.address,
    area: property.area.toNumber(),
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    features: property.features,
    latitude: property.latitude?.toNumber() ?? null,
    longitude: property.longitude?.toNumber() ?? null,
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
    media: property.media,
  };
}

export async function listAgencyProperties(agencyId: string) {
  const properties = await prisma.property.findMany({
    where: { agencyId },
    include: { media: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { updatedAt: 'desc' },
  });
  return properties.map(toRecord);
}

export async function createAgencyProperty(
  agencyId: string,
  input: AgencyPropertyInput,
) {
  const property = await prisma.property.create({
    data: { ...input, agencyId },
    include: { media: { orderBy: { sortOrder: 'asc' } } },
  });
  return toRecord(property);
}

export async function updateAgencyProperty(
  agencyId: string,
  propertyId: string,
  input: AgencyPropertyInput,
) {
  const result = await prisma.property.updateMany({
    where: { id: propertyId, agencyId },
    data: input,
  });
  if (result.count !== 1) return null;
  const property = await prisma.property.findFirst({
    where: { id: propertyId, agencyId },
    include: { media: { orderBy: { sortOrder: 'asc' } } },
  });
  return property ? toRecord(property) : null;
}

export async function updateAgencyPropertyStatus(
  agencyId: string,
  propertyId: string,
  status: AgencyPropertyInput['status'],
) {
  const result = await prisma.property.updateMany({
    where: { id: propertyId, agencyId },
    data: { status },
  });
  return result.count === 1;
}
