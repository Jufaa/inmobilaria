import { properties, formatPrice, type Property } from './properties.ts';
import { tourProperties, type TourProperty } from './property-tour-demo.ts';
import type { Zone } from './zones.ts';

export const demoConfigKey = 'territorio-tour-config-v1';
export type DemoListing = {
  id: string; title: string; description: string; neighborhood: string;
  latitude: number; longitude: number; price: number; currency: 'USD' | 'ARS';
  locationVideo: string; entranceVideo: string; interiorVideo: string; poster: string;
};
export type DemoConfig = { version: 1; properties: DemoListing[] };
const mapIds: Record<string, number> = { centro: 1, 'banda-norte': 2 };
export const defaultDemoConfig: DemoConfig = {
  version: 1,
  properties: tourProperties.map((tour, index) => {
    const seed = properties.find((item) => item.id === mapIds[tour.id])!;
    return { id: tour.id, title: tour.title, description: seed.description,
      neighborhood: seed.neighborhood, latitude: seed.latitude, longitude: seed.longitude,
      price: seed.price, currency: seed.currency ?? 'USD',
      locationVideo: `/demo-assets/tours/location-0${index + 1}.mp4`,
      entranceVideo: tour.entranceVideo, interiorVideo: tour.interiorVideo, poster: tour.interiorPoster };
  }),
};

function text(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.length <= max;
}
function mediaUrl(value: unknown, kind: 'video' | 'image'): value is string {
  if (typeof value !== 'string' || value.length > 2048 || value !== value.trim()) return false;
  const extension = kind === 'video' ? /\.mp4$/i : /\.(?:png|jpe?g|webp)$/i;
  if (value.startsWith('/')) return /^\/demo-assets\/(?:[a-z0-9_-]+\/)*[a-z0-9_.-]+$/i.test(value)
    && !value.includes('..') && extension.test(value);
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && extension.test(url.pathname);
  } catch { return false; }
}

export function parseDemoConfig(value: unknown): DemoConfig | null {
  if (typeof value !== 'object' || !value) return null;
  const data = value as Record<string, unknown>;
  if (data.version !== 1 || !Array.isArray(data.properties) || data.properties.length !== 2) return null;
  const result: DemoListing[] = [];
  for (const raw of data.properties) {
    if (typeof raw !== 'object' || !raw) return null;
    const item = raw as Record<string, unknown>;
    if (typeof item.id !== 'string' || !Object.hasOwn(mapIds, item.id) || result.some((entry) => entry.id === item.id)
      || !text(item.title, 3, 160) || !text(item.description, 1, 1000) || !text(item.neighborhood, 2, 100)
      || typeof item.latitude !== 'number' || !Number.isFinite(item.latitude) || Math.abs(item.latitude) > 90
      || typeof item.longitude !== 'number' || !Number.isFinite(item.longitude) || Math.abs(item.longitude) > 180
      || typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price < 0 || item.price > 1e12
      || (item.currency !== 'ARS' && item.currency !== 'USD')
      || !mediaUrl(item.locationVideo, 'video') || !mediaUrl(item.entranceVideo, 'video')
      || !mediaUrl(item.interiorVideo, 'video') || !mediaUrl(item.poster, 'image')) return null;
    result.push({ id: item.id, title: item.title.trim(), description: item.description.trim(),
      neighborhood: item.neighborhood.trim(), latitude: item.latitude, longitude: item.longitude,
      price: item.price, currency: item.currency, locationVideo: item.locationVideo,
      entranceVideo: item.entranceVideo, interiorVideo: item.interiorVideo, poster: item.poster });
  }
  return { version: 1, properties: result };
}

export function reorderDemoProperty(config: DemoConfig, id: string, direction: -1 | 1): DemoConfig {
  const index = config.properties.findIndex((property) => property.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= config.properties.length) return config;
  const ordered = [...config.properties];
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  return { ...config, properties: ordered };
}
export function mapPropertiesForConfig(config: DemoConfig): Property[] {
  return config.properties.map((listing) => ({ ...properties.find((seed) => seed.id === mapIds[listing.id])!,
    title: listing.title, description: listing.description, neighborhood: listing.neighborhood,
    latitude: listing.latitude, longitude: listing.longitude, price: listing.price,
    currency: listing.currency, image: listing.poster }));
}
export function toursForConfig(config: DemoConfig): TourProperty[] {
  return config.properties.map((listing) => ({ ...tourProperties.find((tour) => tour.id === listing.id)!,
    title: listing.title, neighborhood: listing.neighborhood, price: formatPrice(listing.price, listing.currency),
    entranceVideo: listing.entranceVideo, interiorVideo: listing.interiorVideo, interiorPoster: listing.poster }));
}
export function readDemoConfig(storage: Pick<Storage, 'getItem'>): { config: DemoConfig; error: string | null } {
  try {
    const raw = storage.getItem(demoConfigKey);
    if (!raw) return { config: defaultDemoConfig, error: null };
    const parsed = parseDemoConfig(JSON.parse(raw));
    return { config: parsed ?? defaultDemoConfig, error: parsed ? null : 'La configuración guardada no es válida. Se muestra la demo original.' };
  } catch { return { config: defaultDemoConfig, error: 'No se pudo leer la configuración local. La demo original sigue disponible.' }; }
}
export function saveDemoConfig(storage: Pick<Storage, 'setItem'>, value: unknown): { config: DemoConfig | null; error: string | null } {
  const config = parseDemoConfig(value);
  if (!config) return { config: null, error: 'Revisa los campos: se requieren dos propiedades, coordenadas válidas, videos MP4 e imágenes con URL pública HTTPS o de la demo.' };
  try { storage.setItem(demoConfigKey, JSON.stringify(config)); return { config, error: null }; }
  catch { return { config: null, error: 'El navegador no permite guardar la configuración. No se aplicaron los cambios.' }; }
}

export type ExplorerSelection = { selectedId: string | null; activeTourId: string | null; focusRevision: number; carouselOpen: boolean };
export const initialExplorerSelection: ExplorerSelection = { selectedId: null, activeTourId: null, focusRevision: 0, carouselOpen: false };
export type ExplorerAction = { type: 'select'; id: string } | { type: 'next'; direction: -1 | 1 } | { type: 'open' } | { type: 'close' } | { type: 'dismiss' };
export function updateExplorerSelection(config: DemoConfig, state: ExplorerSelection, action: ExplorerAction): ExplorerSelection {
  if (action.type === 'dismiss') return { ...state, activeTourId: null, carouselOpen: false };
  if (action.type === 'close') return { ...state, activeTourId: null };
  if (action.type === 'open') return config.properties.some((item) => item.id === state.selectedId) ? { ...state, activeTourId: state.selectedId } : state;
  const index = config.properties.findIndex((item) => item.id === state.selectedId);
  const id = action.type === 'select' ? action.id : config.properties[index < 0 ? 0 : (index + action.direction + config.properties.length) % config.properties.length].id;
  return config.properties.some((item) => item.id === id) ? { selectedId: id, activeTourId: null, focusRevision: state.focusRevision + 1, carouselOpen: true } : state;
}

export function zonesForConfig(config: DemoConfig): Zone[] {
  return config.properties.map((item) => ({ id: item.id, label: item.neighborhood, kind: 'neighborhood', bounds: {
    west: Math.max(-180, item.longitude - .004), east: Math.min(180, item.longitude + .004),
    south: Math.max(-90, item.latitude - .004), north: Math.min(90, item.latitude + .004),
  } }));
}
