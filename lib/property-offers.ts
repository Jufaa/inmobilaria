export type PropertyOffer = { id: string; source: 'real' | 'example'; propertyId: string; title: string; description: string; price: number; currency: 'ARS' | 'USD'; enabled: boolean; color?: string };
export type OfferTarget = { id: string; source: 'real' | 'example'; title: string; price: number; currency: 'ARS' | 'USD'; zoneId?: string; kind?: string };
export function resolvePropertyOffers(offers: PropertyOffer[] = [], targets: OfferTarget[]) {
  return offers.flatMap(offer => {
    const property = targets.find(target => target.id === offer.propertyId && target.source === offer.source);
    return offer.enabled && property ? [{ ...offer, property }] : [];
  });
}
export type PropertySummaryFields = { title: string; amount: number; currency: 'ARS' | 'USD'; area: number; bedrooms: number; bathrooms: number; features: string[] };
