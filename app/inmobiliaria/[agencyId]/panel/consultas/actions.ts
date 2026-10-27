'use server';

import { revalidatePath } from 'next/cache';
import { requireAgencyDashboardAccess } from '@/lib/agency-access';
import {
  inquiryStatuses,
  updateAgencyInquiryStatus,
} from '@/lib/properties/public-inquiry-service';

export type InquiryStatusActionState = { error?: string; success?: string };

export async function updateInquiryStatusAction(
  agencySlug: string,
  _previousState: InquiryStatusActionState,
  formData: FormData,
): Promise<InquiryStatusActionState> {
  const { membership } = await requireAgencyDashboardAccess(agencySlug);
  const inquiryId = String(formData.get('inquiryId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!inquiryId || inquiryId.length > 64) {
    return { error: 'La consulta seleccionada no es válida.' };
  }
  if (!inquiryStatuses.includes(status as (typeof inquiryStatuses)[number])) {
    return { error: 'Elegí un estado válido.' };
  }

  try {
    const updated = await updateAgencyInquiryStatus(
      membership.agency.id,
      inquiryId,
      status as (typeof inquiryStatuses)[number],
    );
    if (!updated) return { error: 'La consulta no pertenece a esta inmobiliaria.' };
    revalidatePath(`/inmobiliaria/${encodeURIComponent(agencySlug)}/panel/consultas`);
    return { success: 'Estado actualizado.' };
  } catch {
    return { error: 'No se pudo actualizar la consulta. Intentá nuevamente.' };
  }
}
