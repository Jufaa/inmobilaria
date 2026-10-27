import 'server-only';

import { prisma } from '@/lib/prisma';

export type PublicPropertyDetails = {
  id: string;
  title: string;
  description: string;
  type: string;
  operation: string;
  price: number;
  currency: string;
  neighborhood: string;
  area: number;
  bedrooms: number;
  bathrooms: number;
  features: string[];
  agencyName: string;
  presentingAgencySlug: string | null;
  presentingAgencyName: string;
};

export async function getPublicPropertyDetails(
  propertyId: string,
  presentingAgencySlug?: string,
) {
  if (!process.env.DATABASE_URL?.trim()) return null;
  if (
    presentingAgencySlug &&
    (presentingAgencySlug.length > 60 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(presentingAgencySlug))
  ) return null;

  try {
    const presentingAgency = presentingAgencySlug
      ? await prisma.agency.findUnique({
          where: { slug: presentingAgencySlug },
          select: { id: true, slug: true, name: true },
        })
      : null;
    if (presentingAgencySlug && !presentingAgency) return null;
    const property = await prisma.property.findFirst({
      where: {
        id: propertyId,
        status: 'PUBLISHED',
        ...(presentingAgency
          ? {
              OR: [
                { agencyId: presentingAgency.id },
                {
                  shareGrants: {
                    some: {
                      recipientAgencyId: presentingAgency.id,
                      active: true,
                      connection: { status: 'ACCEPTED' },
                    },
                  },
                },
              ],
            }
          : {}),
      },
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
        features: true,
        agency: { select: { name: true } },
        agencyId: true,
      },
    });
    if (!property) return null;

    return {
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
      agencyName: property.agency.name,
      presentingAgencySlug: presentingAgency?.slug ?? null,
      presentingAgencyName: presentingAgency?.id !== property.agencyId
        ? presentingAgency?.name ?? property.agency.name
        : property.agency.name,
    } satisfies PublicPropertyDetails;
  } catch {
    return null;
  }
}

export type PublicInquiryInput = {
  propertyId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  message: string;
  presentingAgencySlug?: string;
};

export async function createPublicPropertyInquiry(input: PublicInquiryInput) {
  if (
    input.presentingAgencySlug &&
    (input.presentingAgencySlug.length > 60 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.presentingAgencySlug))
  ) return false;
  return prisma.$transaction(async (transaction) => {
    // The serializable transaction ensures a simultaneous unpublish cannot
    // leave an inquiry attributed to a property that was no longer public.
    const presentingAgency = input.presentingAgencySlug
      ? await transaction.agency.findUnique({
          where: { slug: input.presentingAgencySlug },
          select: { id: true },
        })
      : null;
    if (input.presentingAgencySlug && !presentingAgency) return false;

    const property = await transaction.property.findFirst({
      where: {
        id: input.propertyId,
        status: 'PUBLISHED',
        ...(presentingAgency
          ? {
              OR: [
                { agencyId: presentingAgency.id },
                {
                  shareGrants: {
                    some: {
                      recipientAgencyId: presentingAgency.id,
                      active: true,
                      connection: { status: 'ACCEPTED' },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        agencyId: true,
        zoneId: true,
        operation: true,
        type: true,
        currency: true,
      },
    });
    if (!property) return false;

    await transaction.propertyInquiry.create({
      data: {
        propertyId: property.id,
        ownerAgencyId: property.agencyId,
        // Never trust a posted agency ID; this ID came from the validated slug
        // and an active share grant checked inside the transaction.
        presentingAgencyId: presentingAgency?.id ?? property.agencyId,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        message: input.message,
      },
    });
    // Count only a successfully persisted inquiry. This aggregate event stores
    // no contact details or message text.
    await transaction.analyticsEvent.create({
      data: {
        agencyId: property.agencyId,
        presentingAgencyId: presentingAgency?.id,
        propertyId: property.id,
        zoneId: property.zoneId,
        type: 'INQUIRY_SUBMISSION',
        operation: property.operation,
        propertyType: property.type,
        currency: property.currency,
      },
    });
    return true;
  }, { isolationLevel: 'Serializable' });
}

export const inquiryStatuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED'] as const;
export type InquiryStatusValue = (typeof inquiryStatuses)[number];

export async function listAgencyInquiries(agencyId: string) {
  const inquiries = await prisma.propertyInquiry.findMany({
    where: {
      OR: [{ ownerAgencyId: agencyId }, { presentingAgencyId: agencyId }],
    },
    select: {
      id: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      message: true,
      status: true,
      createdAt: true,
      property: { select: { id: true, title: true, status: true } },
      ownerAgency: { select: { id: true, name: true } },
      presentingAgency: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return inquiries.map((inquiry) => ({
    ...inquiry,
    createdAt: inquiry.createdAt.toISOString(),
  }));
}

export async function updateAgencyInquiryStatus(
  agencyId: string,
  inquiryId: string,
  status: InquiryStatusValue,
) {
  const result = await prisma.propertyInquiry.updateMany({
    where: {
      id: inquiryId,
      OR: [{ ownerAgencyId: agencyId }, { presentingAgencyId: agencyId }],
    },
    data: { status },
  });
  return result.count === 1;
}
