'use server';

import { revalidatePath } from 'next/cache';
import { requireAgencyCollaborationAccess } from '@/lib/agency-access';
import {
  endAgencyConnection,
  grantPropertyShare,
  requestAgencyConnection,
  respondToAgencyConnection,
  revokePropertyShare,
} from '@/lib/collaboration-service';

export type CollaborationActionState = { error?: string; success?: string };

const value = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim();

function validId(id: string) {
  return id.length > 0 && id.length <= 64;
}

async function authorize(agencySlug: string) {
  return requireAgencyCollaborationAccess(agencySlug);
}

function refresh(agencySlug: string) {
  revalidatePath(`/inmobiliaria/${encodeURIComponent(agencySlug)}/panel`);
  revalidatePath(`/inmobiliaria/${encodeURIComponent(agencySlug)}/panel/colaboracion`);
}

export async function requestConnectionAction(
  agencySlug: string,
  _previousState: CollaborationActionState,
  formData: FormData,
): Promise<CollaborationActionState> {
  const { membership, user } = await authorize(agencySlug);
  const targetSlug = value(formData, 'targetSlug').toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(targetSlug) || targetSlug.length > 60) {
    return { error: 'Ingresá un identificador válido de inmobiliaria.' };
  }
  try {
    const result = await requestAgencyConnection(membership.agency.id, targetSlug, user.id);
    if ('success' in result) refresh(agencySlug);
    return result;
  } catch {
    return { error: 'No se pudo enviar la solicitud. Verificá tu acceso e intentá nuevamente.' };
  }
}

export async function respondConnectionAction(
  agencySlug: string,
  _previousState: CollaborationActionState,
  formData: FormData,
): Promise<CollaborationActionState> {
  const { membership, user } = await authorize(agencySlug);
  const connectionId = value(formData, 'connectionId');
  const decision = value(formData, 'decision');
  const ownShareRaw = value(formData, 'ownCommissionPercent');
  if (!validId(connectionId) || (decision !== 'accept' && decision !== 'reject')) {
    return { error: 'La solicitud seleccionada no es válida.' };
  }
  const ownShare = ownShareRaw === '' ? NaN : Number(ownShareRaw);
  if (decision === 'accept' && (!Number.isInteger(ownShare) || ownShare < 0 || ownShare > 100)) {
    return { error: 'Definí tu porcentaje de comisión como un entero entre 0 y 100.' };
  }
  try {
    const result = await respondToAgencyConnection(
      membership.agency.id,
      connectionId,
      decision,
      ownShare,
      user.id,
    );
    if ('success' in result) refresh(agencySlug);
    return result;
  } catch {
    return { error: 'No se pudo responder la solicitud. Actualizá el panel e intentá nuevamente.' };
  }
}

export async function endConnectionAction(
  agencySlug: string,
  _previousState: CollaborationActionState,
  formData: FormData,
): Promise<CollaborationActionState> {
  const { membership, user } = await authorize(agencySlug);
  const connectionId = value(formData, 'connectionId');
  if (!validId(connectionId)) return { error: 'El vínculo seleccionado no es válido.' };
  try {
    const result = await endAgencyConnection(membership.agency.id, connectionId, user.id);
    if (result.success) refresh(agencySlug);
    return result;
  } catch {
    return { error: 'No se pudo finalizar el vínculo. Verificá tu acceso e intentá nuevamente.' };
  }
}

export async function grantPropertyShareAction(
  agencySlug: string,
  _previousState: CollaborationActionState,
  formData: FormData,
): Promise<CollaborationActionState> {
  const { membership, user } = await authorize(agencySlug);
  const connectionId = value(formData, 'connectionId');
  const propertyId = value(formData, 'propertyId');
  const recipientAgencyId = value(formData, 'recipientAgencyId');
  if (![connectionId, propertyId, recipientAgencyId].every(validId)) {
    return { error: 'Elegí una propiedad y un vínculo válidos.' };
  }
  try {
    const result = await grantPropertyShare(
      membership.agency.id,
      connectionId,
      propertyId,
      recipientAgencyId,
      user.id,
    );
    if (result.success) refresh(agencySlug);
    return result;
  } catch {
    return { error: 'No se pudo compartir la propiedad. Actualizá el panel e intentá nuevamente.' };
  }
}

export async function revokePropertyShareAction(
  agencySlug: string,
  _previousState: CollaborationActionState,
  formData: FormData,
): Promise<CollaborationActionState> {
  const { membership, user } = await authorize(agencySlug);
  const shareGrantId = value(formData, 'shareGrantId');
  if (!validId(shareGrantId)) return { error: 'El permiso seleccionado no es válido.' };
  try {
    const result = await revokePropertyShare(membership.agency.id, shareGrantId, user.id);
    if (result.success) refresh(agencySlug);
    return result;
  } catch {
    return { error: 'No se pudo revocar el permiso. Verificá tu acceso e intentá nuevamente.' };
  }
}
