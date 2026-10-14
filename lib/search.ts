import type { Property } from './properties';
import type { MapBounds } from './zones';
export type SearchFilters = {
  operation: string;
  currency?: 'ARS' | 'USD';
  search: string;
  type: string;
  minBeds: number;
  minPrice: number | null;
  maxPrice: number | null;
  neighborhood: string;
  areaIds?: string[];
  amenities: string[];
  onlyFavorites: boolean;
  favorites: number[];
  viewport: MapBounds | null;
};
export const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
export function isWithinBounds(
  property: Pick<Property, 'longitude' | 'latitude'>,
  bounds: MapBounds,
): boolean {
  const insideLongitude =
    bounds.west <= bounds.east
      ? property.longitude >= bounds.west && property.longitude <= bounds.east
      : property.longitude >= bounds.west || property.longitude <= bounds.east;
  return (
    insideLongitude &&
    property.latitude >= bounds.south &&
    property.latitude <= bounds.north
  );
}
export function filterProperties(
  catalog: Property[],
  filters: SearchFilters,
): Property[] {
  const words = normalizeSearch(filters.search).split(/\s+/).filter(Boolean);
  return catalog.filter((property) => {
    const text = normalizeSearch(
      `${property.address} ${property.neighborhood} ${property.region} ${property.title} ${property.type} ${property.amenities.join(' ')}`,
    );
    return (
      property.operation === filters.operation &&
      (!filters.currency ||
        (property.currency ?? 'USD') === filters.currency) &&
      (filters.type === 'Todas' || property.type === filters.type) &&
      property.beds >= filters.minBeds &&
      (filters.minPrice === null ||
        property.price >= filters.minPrice) &&
      (filters.maxPrice === null ||
        property.price <= filters.maxPrice) &&
      (!filters.neighborhood ||
        property.neighborhood === filters.neighborhood) &&
      (!filters.areaIds?.length ||
        filters.areaIds.some(
          (id) =>
            id === normalizeSearch(property.region) ||
            id === normalizeSearch(property.neighborhood).replace(/\s+/g, '-'),
        )) &&
      filters.amenities.every((amenity) =>
        property.amenities.includes(amenity as Property['amenities'][number]),
      ) &&
      (!filters.onlyFavorites || filters.favorites.includes(property.id)) &&
      (!filters.viewport || isWithinBounds(property, filters.viewport)) &&
      words.every((word) => text.includes(word))
    );
  });
}

// Accept Argentine grouped whole amounts without interpreting 800.000 as 800.
export function parseBudget(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const normalized = /^\d{1,3}(\.\d{3})+$/.test(text)
    ? text.replace(/\./g, '')
    : text.replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : NaN;
}
