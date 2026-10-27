import type { MapBounds } from './zones.ts';

export type PresentationPoint = { id: string; name: string; latitude: number; longitude: number; color: string };
export type PresentationMapStyle = {
  mode: 'interactive' | 'artwork'; artworkUrl: string; bounds: MapBounds;
  accentColor: string; landColor: string; buildingColor: string; waterColor: string;
};
export type PresentationSettings = {
  version: 1;
  intro: { enabled: boolean; videoUrl: string };
  map: PresentationMapStyle;
  zones: Record<string, { transitionEnabled: boolean; videoUrl: string }>;
  properties: Record<string, { droneEnabled: boolean; videoUrl: string }>;
  points: PresentationPoint[];
};
export const presentationUpdatedEvent = 'territorio:presentation-updated';
const zoneIds = ['centro', 'banda-norte'];
const propertyIds = zoneIds.flatMap(zone => Array.from({ length: 6 }, (_, i) => `presentation-${zone}-${i + 1}`));
export const defaultPresentationSettings: PresentationSettings = {
  version: 1,
  intro: { enabled: false, videoUrl: '/demo-assets/tours/agency-intro-sample.mp4' },
  map: {
    mode: 'interactive', artworkUrl: '',
    bounds: { west: -64.43, east: -64.23, south: -33.195, north: -33.05 },
    accentColor: '#be6345', landColor: '#f2ede4', buildingColor: '#d4cbc0', waterColor: '#a9cddd',
  },
  zones: Object.fromEntries(zoneIds.map(id => [id, { transitionEnabled: false, videoUrl: `/demo-assets/tours/zone-${id}-transition.mp4` }])),
  properties: Object.fromEntries(propertyIds.map((id, i) => [id, { droneEnabled: true, videoUrl: `/demo-assets/tours/entrance-0${i < 6 ? 1 : 2}.mp4` }])),
  points: [],
};

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const color = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const coordinate = (value: unknown, limit: number): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;
function media(value: unknown, image = false): value is string {
  if (typeof value !== 'string' || value !== value.trim()) return false;
  if (value === '') return true;
  if (image && value.startsWith('data:')) return value.length <= 2_800_000 && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(value);
  if (value.length > 2048) return false;
  const extension = image ? /\.(?:png|jpe?g|webp)$/i : /\.mp4$/i;
  if (value.startsWith('/')) return /^\/(?:demo-assets|maps)\/(?:[a-z0-9_-]+\/)*[a-z0-9_.-]+$/i.test(value) && !value.includes('..') && extension.test(value);
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && extension.test(url.pathname);
  } catch { return false; }
}

export function parsePresentationSettings(value: unknown): PresentationSettings | null {
  if (!object(value) || value.version !== 1 || !object(value.intro) || typeof value.intro.enabled !== 'boolean' || !media(value.intro.videoUrl)
    || !object(value.map) || !object(value.map.bounds) || !object(value.zones) || !object(value.properties) || !Array.isArray(value.points) || value.points.length > 50) return null;
  const map = value.map, bounds = map.bounds as Record<string, unknown>;
  if ((map.mode !== 'interactive' && map.mode !== 'artwork') || !media(map.artworkUrl, true)
    || ![map.accentColor, map.landColor, map.buildingColor, map.waterColor].every(color)
    || !coordinate(bounds.west, 180) || !coordinate(bounds.east, 180) || !coordinate(bounds.north, 90) || !coordinate(bounds.south, 90)
    || bounds.west >= bounds.east || bounds.south >= bounds.north) return null;
  const zones: PresentationSettings['zones'] = {}, properties: PresentationSettings['properties'] = {};
  if (Object.keys(value.zones).some(id => !zoneIds.includes(id)) || Object.keys(value.properties).some(id => !propertyIds.includes(id))) return null;
  for (const id of zoneIds) {
    const zone = value.zones[id];
    if (!object(zone) || typeof zone.transitionEnabled !== 'boolean' || !media(zone.videoUrl)) return null;
    zones[id] = { transitionEnabled: zone.transitionEnabled, videoUrl: zone.videoUrl };
  }
  for (const id of propertyIds) {
    const property = value.properties[id];
    if (!object(property) || typeof property.droneEnabled !== 'boolean' || !media(property.videoUrl)) return null;
    properties[id] = { droneEnabled: property.droneEnabled, videoUrl: property.videoUrl };
  }
  const points: PresentationPoint[] = [];
  for (const point of value.points) {
    if (!object(point) || typeof point.id !== 'string' || !/^[a-z0-9_-]{1,80}$/i.test(point.id) || points.some(item => item.id === point.id)
      || typeof point.name !== 'string' || !point.name.trim() || point.name.length > 100
      || !coordinate(point.latitude, 90) || !coordinate(point.longitude, 180) || !color(point.color)) return null;
    points.push({ id: point.id, name: point.name.trim(), latitude: point.latitude, longitude: point.longitude, color: point.color });
  }
  return {
    version: 1, intro: { enabled: value.intro.enabled, videoUrl: value.intro.videoUrl },
    map: { mode: map.mode, artworkUrl: map.artworkUrl as string,
      accentColor: map.accentColor as string, landColor: map.landColor as string, buildingColor: map.buildingColor as string, waterColor: map.waterColor as string,
      bounds: { west: bounds.west, east: bounds.east, north: bounds.north, south: bounds.south } },
    zones, properties, points,
  };
}
export function presentationStorageKey(agencyId: string): string {
  if (!agencyId.trim() || agencyId.length > 200) throw Error('Invalid agency identity');
  return `territorio-agency-presentation-v1:${encodeURIComponent(agencyId)}`;
}
export function readPresentationSettings(storage: Pick<Storage, 'getItem'>, agencyId: string): { settings: PresentationSettings; error: string | null } {
  try {
    const raw = storage.getItem(presentationStorageKey(agencyId));
    if (!raw) return { settings: defaultPresentationSettings, error: null };
    if (raw.length > 3_000_000) throw Error('Settings too large');
    const settings = parsePresentationSettings(JSON.parse(raw));
    return { settings: settings ?? defaultPresentationSettings, error: settings ? null : 'Los ajustes guardados no son válidos. Se muestra la presentación original.' };
  } catch { return { settings: defaultPresentationSettings, error: 'No se pudieron leer los ajustes locales. Se muestra la presentación original.' }; }
}
export function savePresentationSettings(storage: Pick<Storage, 'setItem'>, agencyId: string, value: unknown): { settings: PresentationSettings | null; error: string | null } {
  const settings = parsePresentationSettings(value);
  if (!settings) return { settings: null, error: 'Revisa las URLs MP4, colores, coordenadas y puntos de interés. No se guardaron cambios.' };
  try {
    const serialized = JSON.stringify(settings);
    if (serialized.length > 3_000_000) return { settings: null, error: 'La presentación es demasiado grande. Reduce la imagen del plano.' };
    storage.setItem(presentationStorageKey(agencyId), serialized);
    return { settings, error: null };
  } catch { return { settings: null, error: 'No se pudo guardar en este navegador. Los ajustes anteriores no se modificaron.' }; }
}
