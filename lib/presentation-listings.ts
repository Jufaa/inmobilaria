import { formatPrice } from './properties.ts';
import { defaultExplorerSettings, type ExplorerSettings, type PresentationFilters, matchesPresentationFilters } from './presentation-explorer.ts';
import { createPresentationArea, type PresentationZone } from './workspace-aerial-presentation.ts';
import type { DemoConfig } from './property-tour-config.ts';
import type { AerialProperty } from './property-aerial-demo.ts';

export function visiblePresentationArea(zone: PresentationZone, config: DemoConfig, settings: ExplorerSettings = defaultExplorerSettings, filters: PresentationFilters = {}) {
  const area = createPresentationArea(zone, config);
  if (!area) return null;
  return { ...area, properties: area.properties.flatMap(property => {
    const preference = settings.listings[property.id];
    const kind = preference?.kind ?? property.kind;
    const bedrooms = preference?.bedrooms ?? property.tour.bedrooms;
    const amount = preference?.amount ?? property.amount ?? 0;
    const currency = preference?.currency ?? property.currency ?? 'USD';
    const title = preference?.title ?? property.title;
    const garage = preference?.garage ?? property.garage ?? null;
    if (!matchesPresentationFilters({ zoneId: zone.id, amount, currency, kind, bedrooms, garage, hidden: preference?.hidden }, filters)) return [];
    return [{ ...property, title, amount, currency, price:formatPrice(amount,currency), kind, garage, offer: preference?.offer ?? false, tour: { ...property.tour, title, price:formatPrice(amount,currency), amount, currency, area:preference?.area ?? property.tour.area, bathrooms:preference?.bathrooms ?? property.tour.bathrooms, features:preference?.features ?? [], bedrooms } }];
  }) };
}
export function listingPreference(property: AerialProperty) {
  return { hidden: false, offer: false, kind: property.kind, bedrooms: property.tour.bedrooms, garage: property.garage ?? null };
}
