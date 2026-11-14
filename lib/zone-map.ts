import { validPresentationBounds } from './presentation-explorer.ts';
import type { MapBounds } from './zones.ts';

export type ZonePin = { source: 'real' | 'example'; propertyId: string; x: number; y: number };
export type ZoneMap = { mode: 'google' | 'geographic' | 'illustrated'; imageUrl: string; bounds: MapBounds; pins: ZonePin[] };
export type ZoneMapTarget = Pick<ZonePin, 'source' | 'propertyId'> & { title: string; latitude: number | null; longitude: number | null };
export const pinKey = (pin: Pick<ZonePin, 'source' | 'propertyId'>) => `${pin.source}:${pin.propertyId}`;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9_-]{1,160}$/i.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value);
const unit = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

export function parseZoneMaps(value: unknown, validImage: (value: unknown) => boolean): Record<string, ZoneMap> | null {
  if (!object(value) || Object.keys(value).length > 50) return null;
  const result: Record<string, ZoneMap> = {};
  for (const [key, map] of Object.entries(value)) {
    if (!id(key) || !object(map) || (map.mode !== 'google' && map.mode !== 'geographic' && map.mode !== 'illustrated')
      || typeof map.imageUrl !== 'string' || !validImage(map.imageUrl) || (map.mode !== 'google' && !map.imageUrl)
      || !validPresentationBounds(map.bounds) || !Array.isArray(map.pins) || map.pins.length > 600) return null;
    const seen = new Set<string>();
    const pins: ZonePin[] = [];
    for (const pin of map.pins) {
      if (!object(pin) || (pin.source !== 'real' && pin.source !== 'example') || !id(pin.propertyId) || !unit(pin.x) || !unit(pin.y)) return null;
      const parsed: ZonePin = { source: pin.source, propertyId: pin.propertyId, x: pin.x, y: pin.y };
      if (seen.has(pinKey(parsed))) return null;
      seen.add(pinKey(parsed)); pins.push(parsed);
    }
    result[key] = { mode: map.mode as ZoneMap['mode'], imageUrl: map.imageUrl, bounds: { ...map.bounds }, pins };
  }
  return result;
}

export function zonePinPosition(map: ZoneMap, target: Pick<ZoneMapTarget, 'source' | 'propertyId' | 'latitude' | 'longitude'>): { x: number; y: number } | null {
  if (map.mode === 'illustrated') {
    const pin = map.pins.find(pin => pinKey(pin) === pinKey(target));
    return pin ? { x: pin.x, y: pin.y } : null;
  }
  if (target.latitude === null || target.longitude === null || !validPresentationBounds(map.bounds)) return null;
  const { west, east, north, south } = map.bounds;
  const x = (target.longitude - west) / (east - west), y = (north - target.latitude) / (north - south);
  return unit(x) && unit(y) ? { x, y } : null;
}
