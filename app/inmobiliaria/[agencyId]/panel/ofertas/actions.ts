'use server';

import { revalidatePath } from 'next/cache';
import { requireAgencyBasicEditAccess } from '@/lib/agency-access';
import { prisma } from '@/lib/prisma';
import { defaultPresentationSettings, parsePresentationSettings, type PresentationSettings } from '@/lib/agency-presentation';
import { defaultExplorerSettings } from '@/lib/presentation-explorer';
import { defaultDemoConfig, parseDemoConfig } from '@/lib/property-tour-config';
import { agencyOfferTargets } from '@/lib/agency-offer-targets';
import { listAgencyProperties } from '@/lib/properties/agency-property-service';
import { updateAgencyPresentationSettings } from '@/lib/properties/property-contact-service';
import type { PropertyOffer } from '@/lib/property-offers';

export async function saveAgencyOffersAction(agencySlug: string, value: unknown): Promise<{ settings: PresentationSettings | null; error: string | null }> {
  const { membership } = await requireAgencyBasicEditAccess(agencySlug);
  if (!Array.isArray(value) || value.length > 20 || value.some(offer => !offer || typeof offer !== 'object' || Array.isArray(offer))) return { settings: null, error: 'Revise las ofertas seleccionadas.' };
  // Never accept a stale full presentation or extra fields on an offer.
  const offers = value.map(offer => ({ id: offer.id, source: offer.source, propertyId: offer.propertyId, title: offer.title, description: offer.description, price: offer.price, currency: offer.currency, enabled: offer.enabled, ...(offer.color === undefined ? {} : { color: offer.color }) })) as PropertyOffer[];
  if (!parsePresentationSettings({ ...defaultPresentationSettings, explorer: { ...defaultExplorerSettings, offers } })) return { settings: null, error: 'Revise los títulos, precios y colores de las ofertas.' };
  try {
    const [records, config] = await Promise.all([
      listAgencyProperties(membership.agency.id),
      prisma.agencyPresentationConfig.findUnique({ where: { agencyId: membership.agency.id }, select: { demoTourConfig: true } }),
    ]);
    const demoConfig = config?.demoTourConfig == null ? defaultDemoConfig : parseDemoConfig(config.demoTourConfig);
    if (!demoConfig) throw Error('Existing example configuration is invalid');
    const settings = await updateAgencyPresentationSettings(membership.agency.id, raw => {
      const current = raw == null ? structuredClone(defaultPresentationSettings) : parsePresentationSettings(raw);
      if (!current) throw Error('Existing presentation settings are invalid');
      const targets = agencyOfferTargets(records, current, demoConfig);
      if (offers.some(offer => !targets.some(target => target.id === offer.propertyId && target.source === offer.source))) throw Error('Offer target is not available in this agency');
      return { ...current, explorer: { ...(current.explorer ?? structuredClone(defaultExplorerSettings)), offers } };
    });
    const path = `/inmobiliaria/${encodeURIComponent(agencySlug)}`;
    revalidatePath(path);
    revalidatePath(`${path}/panel`, 'layout');
    return { settings, error: null };
  } catch {
    return { settings: null, error: 'No se pudieron guardar las ofertas. Verifique que las propiedades pertenezcan a esta inmobiliaria y sigan disponibles.' };
  }
}
