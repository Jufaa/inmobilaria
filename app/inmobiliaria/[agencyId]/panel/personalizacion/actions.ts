'use server';

import { revalidatePath } from 'next/cache';
import { requireAgencyCollaborationAccess } from '@/lib/agency-access';
import { prisma } from '@/lib/prisma';

export type BrandingActionState = { status: 'idle' | 'success' | 'error'; message: string };

function parseHttpsUrl(value: FormDataEntryValue | null) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return { value: null, valid: true };
  if (raw.length > 2048) return { value: null, valid: false };
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return { value: null, valid: false };
    return { value: url.toString(), valid: true };
  } catch {
    return { value: null, valid: false };
  }
}

export async function updateAgencyBranding(
  agencySlug: string,
  _previousState: BrandingActionState,
  formData: FormData,
): Promise<BrandingActionState> {
  const { membership } = await requireAgencyCollaborationAccess(agencySlug);
  const primaryColor = String(formData.get('brandPrimaryColor') ?? '').trim();
  if (primaryColor && !/^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
    return { status: 'error', message: 'Ingresá un color hexadecimal de seis dígitos, por ejemplo #236B58.' };
  }

  const logoUrl = parseHttpsUrl(formData.get('logoUrl'));
  const coverUrl = parseHttpsUrl(formData.get('coverUrl'));
  const welcomeVideoUrl = parseHttpsUrl(formData.get('welcomeVideoUrl'));
  if (!logoUrl.valid || !coverUrl.valid || !welcomeVideoUrl.valid) {
    return { status: 'error', message: 'Las imágenes y el video deben usar una URL HTTPS válida, sin credenciales.' };
  }

  const description = String(formData.get('welcomeVideoDescription') ?? '').trim();
  if (description.length > 500) {
    return { status: 'error', message: 'La descripción del video admite hasta 500 caracteres.' };
  }

  await prisma.agency.updateMany({
    where: { id: membership.agency.id },
    data: {
      brandPrimaryColor: primaryColor ? primaryColor.toLowerCase() : null,
      logoUrl: logoUrl.value,
      coverUrl: coverUrl.value,
      welcomeVideoUrl: welcomeVideoUrl.value,
      welcomeVideoDescription: description || null,
    },
  });
  revalidatePath(`/inmobiliaria/${encodeURIComponent(agencySlug)}`);
  revalidatePath(`/inmobiliaria/${encodeURIComponent(agencySlug)}/panel/personalizacion`);
  return { status: 'success', message: 'La identidad de tu inmobiliaria quedó actualizada.' };
}
