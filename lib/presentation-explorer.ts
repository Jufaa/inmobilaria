import type { PropertyOffer } from './property-offers.ts';
import type { MapBounds, Zone } from './zones.ts';

export type ExplorerZone = {
  id: string; name: string; color: string; bounds: MapBounds;
  enabled: boolean; videoUrl: string; duration: 3 | 4;
};
export type ListingPreference = {
  title?: string; amount?: number; currency?: 'ARS' | 'USD'; area?: number; bathrooms?: number; features?: string[];
  hidden: boolean; offer: boolean; kind: string; bedrooms: number; garage: boolean | null;
};
export type ExplorerSettings = {
  offers?: PropertyOffer[];
  name: string; showLegend: boolean; showPrices: boolean; showDetails: boolean;
  popupColor: string; popupTextColor: string;
  filters: { zone: boolean; price: boolean; kind: boolean; bedrooms: boolean; garage: boolean };
  kindColors: Record<string, string>;
  zones: ExplorerZone[] | null;
  listings: Record<string, ListingPreference>;
};
export const defaultExplorerSettings: ExplorerSettings = {
  name: '', showLegend: true, showPrices: false, showDetails: false,
  popupColor: '#f6f8ef', popupTextColor: '#203d37',
  filters: { zone: true, price: true, kind: true, bedrooms: true, garage: true },
  kindColors: { Casa: '#4c8067', Departamento: '#527bb5', Dúplex: '#a57545', Lote: '#aa8052' },
  zones: null, listings: {},
};
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const color = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const label = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 100;
const id = (v: string) => /^[a-z0-9_-]{1,80}$/i.test(v) && !['__proto__', 'constructor', 'prototype'].includes(v);
export function validPresentationBounds(value: unknown): value is MapBounds {
  if (!object(value)) return false;
  return ['west', 'east', 'south', 'north'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key]))
    && Math.abs(value.west as number) <= 180 && Math.abs(value.east as number) <= 180
    && Math.abs(value.south as number) <= 90 && Math.abs(value.north as number) <= 90
    && (value.west as number) < (value.east as number) && (value.south as number) < (value.north as number);
}

export function parseExplorerSettings(value: unknown, validMedia: (value: unknown) => boolean): ExplorerSettings | null {
  if (!object(value) || typeof value.name !== 'string' || value.name.length > 100
    || !['showLegend', 'showPrices', 'showDetails'].every(key => typeof value[key] === 'boolean')
    || !color(value.popupColor) || !color(value.popupTextColor) || !object(value.filters)
    || !Object.keys(defaultExplorerSettings.filters).every(key => typeof (value.filters as Record<string, unknown>)[key] === 'boolean')
    || !object(value.kindColors) || Object.keys(value.kindColors).length > 20
    || !Object.entries(value.kindColors).every(([key, v]) => label(key) && color(v))
    || !object(value.listings) || Object.keys(value.listings).length > 600) return null;
  if (value.offers !== undefined) {
    if (!Array.isArray(value.offers) || value.offers.length > 20) return null;
    const seen = new Set<string>();
    for (const offer of value.offers) {
      if (!object(offer) || typeof offer.id !== 'string' || !id(offer.id) || seen.has(offer.id)
        || !['real','example'].includes(String(offer.source)) || typeof offer.propertyId !== 'string' || !id(offer.propertyId)
        || !label(offer.title) || typeof offer.description !== 'string' || offer.description.length > 500
        || typeof offer.price !== 'number' || !Number.isFinite(offer.price) || offer.price < 0 || offer.price > 1e12
        || !['ARS','USD'].includes(String(offer.currency)) || typeof offer.enabled !== 'boolean'
        || (offer.color !== undefined && !color(offer.color))) return null;
      seen.add(offer.id);
    }
  }
  if (value.zones !== null) {
    if (!Array.isArray(value.zones) || value.zones.length > 50) return null;
    const seen = new Set<string>();
    for (const zone of value.zones) {
      if (!object(zone) || typeof zone.id !== 'string' || !id(zone.id) || seen.has(zone.id)
        || !label(zone.name) || !color(zone.color) || !validPresentationBounds(zone.bounds)
        || typeof zone.enabled !== 'boolean' || !validMedia(zone.videoUrl) || ![3, 4].includes(zone.duration as number)) return null;
      seen.add(zone.id);
    }
  }
  for (const [key, listing] of Object.entries(value.listings)) {
    if (!id(key) || !object(listing) || typeof listing.hidden !== 'boolean' || typeof listing.offer !== 'boolean'
      || !label(listing.kind) || !Number.isInteger(listing.bedrooms) || (listing.bedrooms as number) < 0 || (listing.bedrooms as number) > 50
      || (listing.garage !== null && typeof listing.garage !== 'boolean')
      || (listing.title !== undefined && !label(listing.title))
      || (listing.amount !== undefined && (typeof listing.amount !== 'number' || !Number.isFinite(listing.amount) || listing.amount < 0 || listing.amount > 1e12))
      || (listing.currency !== undefined && !['ARS','USD'].includes(String(listing.currency)))
      || (listing.area !== undefined && (typeof listing.area !== 'number' || !Number.isFinite(listing.area) || listing.area <= 0 || listing.area > 99999999))
      || (listing.bathrooms !== undefined && (!Number.isInteger(listing.bathrooms) || (listing.bathrooms as number) < 0 || (listing.bathrooms as number) > 50))
      || (listing.features !== undefined && (!Array.isArray(listing.features) || listing.features.length > 30 || listing.features.some(feature => typeof feature !== 'string' || !feature.trim() || feature.length > 80)))) return null;
  }
  return structuredClone(value) as ExplorerSettings;
}

export function presentationZones(settings: ExplorerSettings, fallback: Zone[]): Zone[] {
  if (settings.zones === null) return fallback;
  return settings.zones.filter(zone => zone.enabled).map(zone => ({ id: zone.id, label: zone.name, kind: 'neighborhood', bounds: zone.bounds }));
}
export function rectangleFromPoints(a: [number, number], b: [number, number]): MapBounds | null {
  const bounds = { west: Math.min(a[0], b[0]), east: Math.max(a[0], b[0]), south: Math.min(a[1], b[1]), north: Math.max(a[1], b[1]) };
  return validPresentationBounds(bounds) ? bounds : null;
}
export type PresentationFilters = { zone?: string; min?: string; max?: string; currency?: string; kind?: string; bedrooms?: string; garage?: string };
export type FilterableListing = { zoneId: string; amount: number; currency: string; kind: string; bedrooms: number; garage: boolean | null; hidden?: boolean };
export function enabledPresentationFilters(value: PresentationFilters, settings: ExplorerSettings): PresentationFilters {
  return {
    ...(settings.filters.zone ? { zone: value.zone } : {}),
    ...(settings.filters.price ? { min: value.min, max: value.max, currency: value.currency ?? 'USD' } : {}),
    ...(settings.filters.kind ? { kind: value.kind } : {}),
    ...(settings.filters.bedrooms ? { bedrooms: value.bedrooms } : {}),
    ...(settings.filters.garage ? { garage: value.garage } : {}),
  };
}
export function matchesPresentationFilters(item: FilterableListing, filters: PresentationFilters): boolean {
  if (item.hidden || (filters.zone && filters.zone !== item.zoneId) || (filters.kind && filters.kind !== item.kind)
    || (filters.bedrooms && item.bedrooms !== Number(filters.bedrooms))) return false;
  if (filters.garage && (item.garage === null || item.garage !== (filters.garage === 'yes'))) return false;
  if (filters.min || filters.max) {
    if (filters.currency && filters.currency !== item.currency) return false;
    if (filters.min && item.amount < Number(filters.min)) return false;
    if (filters.max && item.amount > Number(filters.max)) return false;
  }
  return true;
}
