'use server';

import { requireAgencyCollaborationAccess } from '@/lib/agency-access';
import { prisma } from '@/lib/prisma';
import { parsePresentationSettings, type PresentationSettings } from '@/lib/agency-presentation';
import { parseDemoConfig, type DemoConfig } from '@/lib/property-tour-config';

export async function savePresentationSettingsAction(
  agencySlug: string,
  value: unknown,
): Promise<{ settings: PresentationSettings | null; error: string | null }> {
  const { membership } = await requireAgencyCollaborationAccess(agencySlug);
  const settings = parsePresentationSettings(value);
  if (!settings) return { settings: null, error: 'Revisa las URLs MP4, colores, coordenadas y puntos de interés. No se guardaron cambios.' };

  const serialized = JSON.stringify(settings);
  if (serialized.length > 3_000_000) return { settings: null, error: 'La presentación es demasiado grande. Reduce la imagen del plano.' };

  try {
    await prisma.agencyPresentationConfig.upsert({
      where: { agencyId: membership.agency.id },
      create: { agencyId: membership.agency.id, presentationSettings: settings },
      update: { presentationSettings: settings },
    });
    return { settings, error: null };
  } catch {
    return { settings: null, error: 'No se pudieron guardar los ajustes de presentación. Los datos anteriores no se modificaron.' };
  }
}

export async function saveDemoConfigAction(
  agencySlug: string,
  value: unknown,
): Promise<{ config: DemoConfig | null; error: string | null }> {
  const { membership } = await requireAgencyCollaborationAccess(agencySlug);
  const config = parseDemoConfig(value);
  if (!config) return { config: null, error: 'Revisa los campos: se requieren dos propiedades, coordenadas válidas, videos MP4 e imágenes con URL pública HTTPS o de la demo.' };

  try {
    await prisma.agencyPresentationConfig.upsert({
      where: { agencyId: membership.agency.id },
      create: { agencyId: membership.agency.id, demoTourConfig: config },
      update: { demoTourConfig: config },
    });
    return { config, error: null };
  } catch {
    return { config: null, error: 'No se pudo guardar la presentación. Los datos anteriores no se modificaron.' };
  }
}
