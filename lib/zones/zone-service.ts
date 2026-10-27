import 'server-only';

import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { pointOfInterestCategories } from './zone-constants';

export type ZoneInput = {
  name: string;
  city: string;
  geometry: Prisma.InputJsonValue | null;
  latitude: number | null;
  longitude: number | null;
};

export { pointOfInterestCategories } from './zone-constants';

export async function listAgencyZones(agencyId: string) {
  const [zones, properties, pointsOfInterest] = await Promise.all([
    prisma.zone.findMany({ where: { agencyId }, orderBy: [{ city: 'asc' }, { name: 'asc' }] }),
    prisma.property.findMany({
      where: { agencyId },
      select: { id: true, title: true, neighborhood: true, zoneId: true },
      orderBy: { title: 'asc' },
    }),
    prisma.pointOfInterest.findMany({
      where: { agencyId },
      include: { zone: { select: { id: true, name: true } } },
      orderBy: [{ zone: { name: 'asc' } }, { name: 'asc' }],
    }),
  ]);
  return { zones, properties, pointsOfInterest };
}

export async function createAgencyZone(agencyId: string, input: ZoneInput) {
  return prisma.zone.create({
    data: { ...input, geometry: input.geometry ?? Prisma.DbNull, agencyId },
  });
}

export async function updateAgencyZone(agencyId: string, zoneId: string, input: ZoneInput) {
  const result = await prisma.zone.updateMany({
    where: { id: zoneId, agencyId },
    data: { ...input, geometry: input.geometry ?? Prisma.DbNull },
  });
  return result.count === 1;
}

export async function deleteAgencyZone(agencyId: string, zoneId: string) {
  const result = await prisma.zone.deleteMany({ where: { id: zoneId, agencyId } });
  return result.count === 1;
}

export async function createAgencyPointOfInterest(
  agencyId: string,
  input: {
    zoneId: string | null;
    name: string;
    category: (typeof pointOfInterestCategories)[number];
    description: string | null;
    latitude: number;
    longitude: number;
  },
) {
  if (input.zoneId) {
    const zone = await prisma.zone.findFirst({ where: { id: input.zoneId, agencyId }, select: { id: true } });
    if (!zone) return null;
  }
  return prisma.pointOfInterest.create({ data: { ...input, agencyId } });
}

export async function updateAgencyPointOfInterest(
  agencyId: string,
  pointId: string,
  input: {
    zoneId: string | null;
    name: string;
    category: (typeof pointOfInterestCategories)[number];
    description: string | null;
    latitude: number;
    longitude: number;
  },
) {
  if (input.zoneId) {
    const zone = await prisma.zone.findFirst({ where: { id: input.zoneId, agencyId }, select: { id: true } });
    if (!zone) return false;
  }
  const result = await prisma.pointOfInterest.updateMany({ where: { id: pointId, agencyId }, data: input });
  return result.count === 1;
}

export async function deleteAgencyPointOfInterest(agencyId: string, pointId: string) {
  const result = await prisma.pointOfInterest.deleteMany({ where: { id: pointId, agencyId } });
  return result.count === 1;
}

export async function assignAgencyPropertyZone(agencyId: string, propertyId: string, zoneId: string | null) {
  const zone = zoneId
    ? await prisma.zone.findFirst({ where: { id: zoneId, agencyId }, select: { id: true, name: true } })
    : null;
  if (zoneId && !zone) return false;
  const result = await prisma.property.updateMany({
    where: { id: propertyId, agencyId },
    data: { zoneId, ...(zone ? { neighborhood: zone.name } : {}) },
  });
  return result.count === 1;
}
