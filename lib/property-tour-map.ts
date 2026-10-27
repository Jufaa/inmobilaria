import { properties, type Property } from './properties.ts';
import { tourProperties } from './property-tour-demo.ts';
import { zones } from './zones.ts';

// Adapt the two existing fictional seeds; never add records to the live catalogue.
const mapIds: Record<string, number> = { centro: 1, 'banda-norte': 2 };
export const tourMapProperties: Property[] = tourProperties.map((tour) => {
  const seed = properties.find((property) => property.id === mapIds[tour.id])!;
  return { ...seed, title: tour.title, image: tour.interiorPoster, tourUrl: tour.panorama };
});
export const tourMapZones = zones.filter((zone) => tourProperties.some((tour) => tour.id === zone.id));

export function tourIdForMapProperty(mapId: number): string | undefined {
  return tourProperties.find((tour) => mapIds[tour.id] === mapId)?.id;
}
