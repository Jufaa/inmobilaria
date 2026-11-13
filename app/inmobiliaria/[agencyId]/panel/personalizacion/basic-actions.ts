'use server';

import { revalidatePath } from 'next/cache';
import { requireAgencyBasicEditAccess } from '@/lib/agency-access';
import { prisma } from '@/lib/prisma';
import { defaultPresentationSettings, parsePresentationSettings, type PresentationSettings } from '@/lib/agency-presentation';
import { defaultExplorerSettings } from '@/lib/presentation-explorer';
import { updateAgencyPresentationSettings } from '@/lib/properties/property-contact-service';

const validColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

function refresh(slug: string) {
  const path = `/inmobiliaria/${encodeURIComponent(slug)}`;
  revalidatePath(path);
  revalidatePath(`${path}/panel`, 'layout');
}

export async function saveAgencyBasicAppearanceAction(agencySlug: string, value: unknown): Promise<{ settings: PresentationSettings | null; error: string | null }> {
  const { membership } = await requireAgencyBasicEditAccess(agencySlug);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { settings: null, error: 'Revise los colores seleccionados.' };
  const input = value as Record<string, unknown>;
  if (!validColor(input.popupColor) || !validColor(input.popupTextColor) || !input.kindColors || typeof input.kindColors !== 'object' || Array.isArray(input.kindColors)) return { settings: null, error: 'Revise los colores seleccionados.' };
  const colors = Object.entries(input.kindColors);
  if (colors.some(([kind, color]) => !['Casa', 'Departamento', 'Dúplex', 'PH', 'Lote', 'Local', 'Otro'].includes(kind) || !validColor(color))) return { settings: null, error: 'Revise los colores de los tipos de propiedad.' };
  // Copy only supported fields before entering the retryable canonical patch.
  const popupColor = input.popupColor.toLowerCase(), popupTextColor = input.popupTextColor.toLowerCase();
  const kindColors = Object.fromEntries(colors.map(([kind, color]) => [kind, (color as string).toLowerCase()]));
  try {
    const settings = await updateAgencyPresentationSettings(membership.agency.id, raw => {
      const current = raw == null ? structuredClone(defaultPresentationSettings) : parsePresentationSettings(raw);
      if (!current) throw Error('Existing presentation settings are invalid');
      const explorer = current.explorer ?? structuredClone(defaultExplorerSettings);
      return { ...current, explorer: { ...explorer, popupColor, popupTextColor, kindColors: { ...explorer.kindColors, ...kindColors } } };
    });
    refresh(agencySlug);
    return { settings, error: null };
  } catch {
    return { settings: null, error: 'No se pudieron guardar los colores. Los ajustes anteriores no se modificaron.' };
  }
}

// Brand and presentation are intentionally separate saves: they live in separate tables.
export async function saveAgencyBasicBrandColorAction(agencySlug: string, formData: FormData): Promise<{ color: string | null; error: string | null }> {
  const { membership } = await requireAgencyBasicEditAccess(agencySlug);
  const value = formData.get('brandPrimaryColor');
  if (typeof value !== 'string' || (value !== '' && !validColor(value))) return { color: null, error: 'Seleccione un color hexadecimal válido.' };
  const color = value ? value.toLowerCase() : null;
  try {
    const result = await prisma.agency.updateMany({ where: { id: membership.agency.id }, data: { brandPrimaryColor: color } });
    if (result.count !== 1) throw Error('Agency not found');
    refresh(agencySlug);
    return { color, error: null };
  } catch {
    return { color: null, error: 'No se pudo guardar el color de la inmobiliaria.' };
  }
}
