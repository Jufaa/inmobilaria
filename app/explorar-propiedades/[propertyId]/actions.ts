'use server';

import { createPublicPropertyInquiry } from '@/lib/properties/public-inquiry-service';

export type InquiryActionState = { error?: string; success?: string };

export async function submitPropertyInquiryAction(
  propertyId: string,
  presentingAgencySlug: string | null,
  _previousState: InquiryActionState,
  formData: FormData,
): Promise<InquiryActionState> {
  const honeypot = String(formData.get('website') ?? '').trim();
  if (honeypot) return { success: 'Gracias. Recibimos tu consulta.' };

  const contactName = String(formData.get('contactName') ?? '').trim();
  const contactEmail = String(formData.get('contactEmail') ?? '').trim().toLowerCase();
  const phoneValue = String(formData.get('contactPhone') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();

  if (!propertyId || propertyId.length > 64) {
    return { error: 'La propiedad seleccionada no es válida.' };
  }
  if (contactName.length < 2 || contactName.length > 100) {
    return { error: 'Ingresá tu nombre (entre 2 y 100 caracteres).' };
  }
  if (
    contactEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)
  ) {
    return { error: 'Ingresá un correo electrónico válido.' };
  }
  if (phoneValue.length > 40) {
    return { error: 'El teléfono no puede superar los 40 caracteres.' };
  }
  if (message.length < 10 || message.length > 2000) {
    return { error: 'El mensaje debe tener entre 10 y 2000 caracteres.' };
  }

  try {
    const created = await createPublicPropertyInquiry({
      propertyId,
      contactName,
      contactEmail,
      contactPhone: phoneValue || null,
      message,
      presentingAgencySlug: presentingAgencySlug ?? undefined,
    });
    if (!created) return { error: 'Esta propiedad ya no está publicada.' };
    return { success: 'Gracias. Recibimos tu consulta y la inmobiliaria podrá contactarte.' };
  } catch {
    return { error: 'No pudimos guardar tu consulta. Probá nuevamente en unos minutos.' };
  }
}
