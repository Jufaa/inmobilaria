import 'server-only';
import { prisma } from '@/lib/prisma';
import { defaultAgencies } from '@/lib/agencies';

export async function getPublicAgencyStorefront(slug: string) {
  if (defaultAgencies.some((agency) => agency.id === slug)) return null;

  try {
    const agency = await prisma.agency.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        brandPrimaryColor: true,
        logoUrl: true,
        coverUrl: true,
        welcomeVideoUrl: true,
        welcomeVideoDescription: true,
        properties: {
          where: { status: 'PUBLISHED' },
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
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
            media: {
              where: { kind: 'PHOTO' },
              orderBy: { sortOrder: 'asc' },
              take: 1,
              select: { url: true, caption: true },
            },
          },
        },
      },
    });
    if (!agency) return null;

    return {
      ...agency,
      properties: agency.properties.map((property) => ({
        ...property,
        price: property.price.toNumber(),
        area: property.area.toNumber(),
      })),
    };
  } catch {
    return null;
  }
}
