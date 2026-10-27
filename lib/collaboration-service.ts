import 'server-only';

import { prisma } from '@/lib/prisma';

function pairFor(firstAgencyId: string, secondAgencyId: string) {
  return firstAgencyId < secondAgencyId
    ? { agencyLowId: firstAgencyId, agencyHighId: secondAgencyId }
    : { agencyLowId: secondAgencyId, agencyHighId: firstAgencyId };
}

export async function listAgencyCollaboration(agencyId: string) {
  const [connections, ownedGrants, receivedGrants, publishedProperties, events] =
    await Promise.all([
      prisma.agencyConnection.findMany({
        where: { OR: [{ agencyLowId: agencyId }, { agencyHighId: agencyId }] },
        include: {
          agencyLow: { select: { id: true, name: true, slug: true } },
          agencyHigh: { select: { id: true, name: true, slug: true } },
          _count: { select: { shareGrants: { where: { active: true } } } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.propertyShareGrant.findMany({
        where: { ownerAgencyId: agencyId, active: true },
        include: {
          property: { select: { id: true, title: true, status: true, neighborhood: true } },
          recipientAgency: { select: { id: true, name: true } },
        },
        orderBy: { grantedAt: 'desc' },
      }),
      prisma.propertyShareGrant.findMany({
        where: { recipientAgencyId: agencyId, active: true },
        include: {
          property: { select: { id: true, title: true, status: true, neighborhood: true } },
          ownerAgency: { select: { id: true, name: true } },
        },
        orderBy: { grantedAt: 'desc' },
      }),
      prisma.property.findMany({
        where: { agencyId, status: 'PUBLISHED' },
        select: { id: true, title: true, neighborhood: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.collaborationEvent.findMany({
        where: { OR: [{ actorAgencyId: agencyId }, { targetAgencyId: agencyId }] },
        include: {
          actorAgency: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

  return { connections, ownedGrants, receivedGrants, publishedProperties, events };
}

export async function requestAgencyConnection(
  agencyId: string,
  targetSlug: string,
  actorUserId: string,
) {
  const target = await prisma.agency.findUnique({ where: { slug: targetSlug } });
  if (!target) return { error: 'No encontramos esa inmobiliaria.' } as const;
  if (target.id === agencyId) return { error: 'No podés vincular tu inmobiliaria consigo misma.' } as const;

  const pair = pairFor(agencyId, target.id);
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.agencyConnection.findUnique({
        where: { agencyLowId_agencyHighId: pair },
      });
      if (existing?.status === 'PENDING') {
        return { error: 'Ya existe una solicitud pendiente entre estas inmobiliarias.' } as const;
      }
      if (existing?.status === 'ACCEPTED') {
        return { error: 'Estas inmobiliarias ya están vinculadas.' } as const;
      }

      const connection = existing
        ? await tx.agencyConnection.update({
            where: { id: existing.id },
            data: {
              requestedByAgencyId: agencyId,
              status: 'PENDING',
              lowCommissionPercent: null,
              highCommissionPercent: null,
              requestedAt: new Date(),
              respondedAt: null,
              endedAt: null,
            },
          })
        : await tx.agencyConnection.create({
            data: { ...pair, requestedByAgencyId: agencyId },
          });
      await tx.collaborationEvent.create({
        data: {
          type: 'REQUESTED',
          connectionId: connection.id,
          actorUserId,
          actorAgencyId: agencyId,
          targetAgencyId: target.id,
        },
      });
      return { success: `Solicitud enviada a ${target.name}.` } as const;
    });
  } catch {
    return { error: 'No se pudo enviar la solicitud. Actualizá el panel e intentá nuevamente.' } as const;
  }
}

export async function respondToAgencyConnection(
  agencyId: string,
  connectionId: string,
  decision: 'accept' | 'reject',
  ownCommissionPercent: number,
  actorUserId: string,
) {
  if (decision === 'accept' && (!Number.isInteger(ownCommissionPercent) || ownCommissionPercent < 0 || ownCommissionPercent > 100)) {
    return { error: 'El porcentaje debe ser un número entero entre 0 y 100.' } as const;
  }

  return prisma.$transaction(async (tx) => {
    const connection = await tx.agencyConnection.findFirst({
      where: {
        id: connectionId,
        status: 'PENDING',
        requestedByAgencyId: { not: agencyId },
        OR: [{ agencyLowId: agencyId }, { agencyHighId: agencyId }],
      },
    });
    if (!connection) return { error: 'La solicitud no está pendiente o no corresponde a tu inmobiliaria.' } as const;

    const actorIsLowAgency = connection.agencyLowId === agencyId;
    const update = await tx.agencyConnection.updateMany({
      where: { id: connection.id, status: 'PENDING' },
      data: decision === 'accept'
        ? {
            status: 'ACCEPTED',
            lowCommissionPercent: actorIsLowAgency ? ownCommissionPercent : 100 - ownCommissionPercent,
            highCommissionPercent: actorIsLowAgency ? 100 - ownCommissionPercent : ownCommissionPercent,
            respondedAt: new Date(),
          }
        : { status: 'REJECTED', respondedAt: new Date() },
    });
    if (update.count !== 1) return { error: 'La solicitud ya fue respondida.' } as const;
    await tx.collaborationEvent.create({
      data: {
        type: decision === 'accept' ? 'ACCEPTED' : 'REJECTED',
        connectionId: connection.id,
        actorUserId,
        actorAgencyId: agencyId,
        targetAgencyId: connection.requestedByAgencyId,
      },
    });
    return { success: decision === 'accept' ? 'Vínculo aceptado y condiciones registradas.' : 'Solicitud rechazada.' } as const;
  });
}

export async function endAgencyConnection(agencyId: string, connectionId: string, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const connection = await tx.agencyConnection.findFirst({
      where: {
        id: connectionId,
        status: 'ACCEPTED',
        OR: [{ agencyLowId: agencyId }, { agencyHighId: agencyId }],
      },
    });
    if (!connection) return { error: 'No encontramos un vínculo activo de esta inmobiliaria.' } as const;
    const now = new Date();
    const otherAgencyId = connection.agencyLowId === agencyId ? connection.agencyHighId : connection.agencyLowId;
    const grants = await tx.propertyShareGrant.findMany({
      where: { connectionId, active: true, OR: [{ ownerAgencyId: agencyId }, { recipientAgencyId: agencyId }] },
      select: { id: true, propertyId: true },
    });
    await tx.propertyShareGrant.updateMany({
      where: { id: { in: grants.map((grant) => grant.id) } },
      data: { active: false, revokedAt: now },
    });
    if (grants.length) {
      await tx.collaborationEvent.createMany({
        data: grants.map((grant) => ({
          type: 'PROPERTY_SHARE_REVOKED' as const,
          connectionId,
          shareGrantId: grant.id,
          actorUserId,
          actorAgencyId: agencyId,
          targetAgencyId: otherAgencyId,
          propertyId: grant.propertyId,
        })),
      });
    }
    await tx.agencyConnection.update({ where: { id: connectionId }, data: { status: 'ENDED', endedAt: now } });
    await tx.collaborationEvent.create({
      data: { type: 'ENDED', connectionId, actorUserId, actorAgencyId: agencyId, targetAgencyId: otherAgencyId },
    });
    return { success: 'Vínculo finalizado y propiedades compartidas desactivadas.' } as const;
  }, { isolationLevel: 'Serializable' });
}

export async function grantPropertyShare(
  agencyId: string,
  connectionId: string,
  propertyId: string,
  recipientAgencyId: string,
  actorUserId: string,
) {
  return prisma.$transaction(async (tx) => {
    const [connection, property] = await Promise.all([
      tx.agencyConnection.findFirst({
        where: {
          id: connectionId,
          status: 'ACCEPTED',
          OR: [
            { agencyLowId: agencyId, agencyHighId: recipientAgencyId },
            { agencyLowId: recipientAgencyId, agencyHighId: agencyId },
          ],
        },
      }),
      tx.property.findFirst({ where: { id: propertyId, agencyId }, select: { id: true, status: true } }),
    ]);
    if (!connection) return { error: 'Solo podés compartir con una inmobiliaria vinculada.' } as const;
    if (!property) return { error: 'La propiedad no pertenece a esta inmobiliaria.' } as const;
    if (property.status !== 'PUBLISHED') return { error: 'Solo se pueden compartir propiedades publicadas.' } as const;

    const previous = await tx.propertyShareGrant.findUnique({
      where: { propertyId_recipientAgencyId: { propertyId, recipientAgencyId } },
    });
    if (previous?.active) return { error: 'La propiedad ya está compartida con esa inmobiliaria.' } as const;
    const grant = previous
      ? await tx.propertyShareGrant.update({
          where: { id: previous.id },
          data: { connectionId, ownerAgencyId: agencyId, grantedByUserId: actorUserId, active: true, grantedAt: new Date(), revokedAt: null },
        })
      : await tx.propertyShareGrant.create({
          data: { connectionId, propertyId, ownerAgencyId: agencyId, recipientAgencyId, grantedByUserId: actorUserId },
        });
    await tx.collaborationEvent.create({
      data: {
        type: 'PROPERTY_SHARED',
        connectionId,
        shareGrantId: grant.id,
        actorUserId,
        actorAgencyId: agencyId,
        targetAgencyId: recipientAgencyId,
        propertyId,
      },
    });
    return { success: 'Propiedad compartida. El registro original permanece en tu inmobiliaria.' } as const;
  }, { isolationLevel: 'Serializable' });
}

export async function revokePropertyShare(agencyId: string, shareGrantId: string, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const grant = await tx.propertyShareGrant.findFirst({
      where: { id: shareGrantId, ownerAgencyId: agencyId, active: true },
      select: { id: true, connectionId: true, propertyId: true, recipientAgencyId: true },
    });
    if (!grant) return { error: 'El permiso no existe o ya fue revocado.' } as const;
    const now = new Date();
    const update = await tx.propertyShareGrant.updateMany({
      where: { id: grant.id, ownerAgencyId: agencyId, active: true },
      data: { active: false, revokedAt: now },
    });
    if (update.count !== 1) return { error: 'El permiso ya fue revocado.' } as const;
    await tx.collaborationEvent.create({
      data: {
        type: 'PROPERTY_SHARE_REVOKED',
        connectionId: grant.connectionId,
        shareGrantId: grant.id,
        actorUserId,
        actorAgencyId: agencyId,
        targetAgencyId: grant.recipientAgencyId,
        propertyId: grant.propertyId,
      },
    });
    return { success: 'Permiso revocado.' } as const;
  });
}
