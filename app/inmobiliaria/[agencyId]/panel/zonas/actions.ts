'use server';

import { revalidatePath } from 'next/cache';
import { requireAgencyDashboardAccess } from '@/lib/agency-access';
import {
  assignAgencyPropertyZone,
  createAgencyPointOfInterest,
  createAgencyZone,
  updateAgencyZone,
  deleteAgencyPointOfInterest,
  deleteAgencyZone,
  updateAgencyPointOfInterest,
  pointOfInterestCategories,
} from '@/lib/zones/zone-service';

export type ZoneActionState = { error?: string; success?: string };
const value = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
const number = (raw: string, min: number, max: number) => {
  if (!raw || !/^-?\d+(?:\.\d+)?$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
};
function coordinates(data: FormData) {
  const lat = value(data, 'latitude');
  const lng = value(data, 'longitude');
  if (!lat && !lng) return { latitude: null, longitude: null, valid: true };
  const latitude = number(lat, -90, 90);
  const longitude = number(lng, -180, 180);
  return { latitude, longitude, valid: latitude !== null && longitude !== null };
}

function parseGeometry(raw: string) {
  if (!raw) return { geometry: null, valid: true };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { geometry: null, valid: false };
    const shape = parsed as { type?: unknown; coordinates?: unknown };
    if (shape.type !== 'Polygon' && shape.type !== 'MultiPolygon') return { geometry: null, valid: false };
    let points = 0;
    const visit = (item: unknown): boolean => {
      if (!Array.isArray(item)) return false;
      if (item.length >= 2 && typeof item[0] === 'number' && typeof item[1] === 'number') {
        points += 1;
        return points <= 10_000 && item[0] >= -180 && item[0] <= 180 && item[1] >= -90 && item[1] <= 90;
      }
      return item.length > 0 && item.every(visit);
    };
    if (!visit(shape.coordinates)) return { geometry: null, valid: false };
    return { geometry: parsed as Record<string, unknown>, valid: true };
  } catch {
    return { geometry: null, valid: false };
  }
}

function refresh(slug: string) {
  revalidatePath(`/inmobiliaria/${encodeURIComponent(slug)}/panel/zonas`);
  revalidatePath(`/inmobiliaria/${encodeURIComponent(slug)}/panel`);
  revalidatePath('/explorar-propiedades');
}

export async function createZoneAction(slug: string, _state: ZoneActionState, data: FormData): Promise<ZoneActionState> {
  const { membership } = await requireAgencyDashboardAccess(slug);
  const name = value(data, 'name');
  const city = value(data, 'city') || 'Río Cuarto';
  const coords = coordinates(data);
  const parsedGeometry = parseGeometry(value(data, 'geometry'));
  if (name.length < 2 || name.length > 120 || city.length > 120) return { error: 'El nombre del barrio y la ciudad deben tener entre 2 y 120 caracteres.' };
  if (!coords.valid) return { error: 'Ingresá latitud y longitud válidas, o dejá ambas vacías.' };
  if (!parsedGeometry.valid) return { error: 'El límite debe ser una geometría GeoJSON Polygon o MultiPolygon válida.' };
  try {
    await createAgencyZone(membership.agency.id, {
      name,
      city,
      geometry: parsedGeometry.geometry as never,
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
    refresh(slug);
    return { success: 'Barrio guardado.' };
  } catch {
    return { error: 'No se pudo guardar. Puede existir ya un barrio con ese nombre en esa ciudad.' };
  }
}

export async function updateZoneAction(slug: string, _state: ZoneActionState, data: FormData): Promise<ZoneActionState> {
  const { membership } = await requireAgencyDashboardAccess(slug);
  const zoneId = value(data, 'zoneId');
  const name = value(data, 'name');
  const city = value(data, 'city') || 'Río Cuarto';
  const coords = coordinates(data);
  const parsedGeometry = parseGeometry(value(data, 'geometry'));
  if (!zoneId || zoneId.length > 64 || name.length < 2 || name.length > 120 || city.length > 120) return { error: 'El nombre del barrio y la ciudad deben tener entre 2 y 120 caracteres.' };
  if (!coords.valid) return { error: 'Ingresá latitud y longitud válidas, o dejá ambas vacías.' };
  if (!parsedGeometry.valid) return { error: 'El límite debe ser una geometría GeoJSON Polygon o MultiPolygon válida.' };
  try {
    const saved = await updateAgencyZone(membership.agency.id, zoneId, {
      name, city, geometry: parsedGeometry.geometry as never,
      latitude: coords.latitude, longitude: coords.longitude,
    });
    if (!saved) return { error: 'El barrio no pertenece a esta inmobiliaria.' };
    refresh(slug);
    return { success: 'Barrio actualizado.' };
  } catch {
    return { error: 'No se pudo actualizar. Puede existir ya un barrio con ese nombre en esa ciudad.' };
  }
}

export async function createPointOfInterestAction(slug: string, _state: ZoneActionState, data: FormData): Promise<ZoneActionState> {
  const { membership } = await requireAgencyDashboardAccess(slug);
  const name = value(data, 'name');
  const zoneId = value(data, 'zoneId') || null;
  const category = value(data, 'category');
  const latitude = number(value(data, 'latitude'), -90, 90);
  const longitude = number(value(data, 'longitude'), -180, 180);
  const description = value(data, 'description');
  if (name.length < 2 || name.length > 120 || latitude === null || longitude === null || !pointOfInterestCategories.includes(category as typeof pointOfInterestCategories[number])) {
    return { error: 'Revisá el nombre, categoría y coordenadas del punto de interés.' };
  }
  if (description.length > 500) return { error: 'La descripción admite hasta 500 caracteres.' };
  try {
    const point = await createAgencyPointOfInterest(membership.agency.id, {
      zoneId, name, category: category as typeof pointOfInterestCategories[number],
      description: description || null, latitude, longitude,
    });
    if (!point) return { error: 'El barrio elegido no pertenece a esta inmobiliaria.' };
    refresh(slug);
    return { success: 'Punto de interés guardado.' };
  } catch {
    return { error: 'No se pudo guardar el punto de interés.' };
  }
}

export async function updatePointOfInterestAction(slug: string, _state: ZoneActionState, data: FormData): Promise<ZoneActionState> {
  const { membership } = await requireAgencyDashboardAccess(slug);
  const pointId = value(data, 'pointId');
  const name = value(data, 'name');
  const zoneId = value(data, 'zoneId') || null;
  const category = value(data, 'category');
  const latitude = number(value(data, 'latitude'), -90, 90);
  const longitude = number(value(data, 'longitude'), -180, 180);
  const description = value(data, 'description');
  if (!pointId || pointId.length > 64 || name.length < 2 || name.length > 120 || latitude === null || longitude === null || !pointOfInterestCategories.includes(category as typeof pointOfInterestCategories[number])) return { error: 'Revisá el punto de interés, su categoría y sus coordenadas.' };
  if (description.length > 500) return { error: 'La descripción admite hasta 500 caracteres.' };
  try {
    const saved = await updateAgencyPointOfInterest(membership.agency.id, pointId, {
      zoneId, name, category: category as typeof pointOfInterestCategories[number],
      description: description || null, latitude, longitude,
    });
    if (!saved) return { error: 'El punto o el barrio no pertenecen a esta inmobiliaria.' };
    refresh(slug);
    return { success: 'Punto de interés actualizado.' };
  } catch {
    return { error: 'No se pudo actualizar el punto de interés.' };
  }
}

export async function assignPropertyZoneAction(slug: string, _state: ZoneActionState, data: FormData): Promise<ZoneActionState> {
  const { membership } = await requireAgencyDashboardAccess(slug);
  const propertyId = value(data, 'propertyId');
  const zoneId = value(data, 'zoneId') || null;
  if (!propertyId || propertyId.length > 64 || (zoneId && zoneId.length > 64)) return { error: 'Elegí una propiedad y un barrio válidos.' };
  try {
    const saved = await assignAgencyPropertyZone(membership.agency.id, propertyId, zoneId);
    if (!saved) return { error: 'La propiedad o el barrio no pertenecen a esta inmobiliaria.' };
    refresh(slug);
    return { success: 'Barrio de la propiedad actualizado.' };
  } catch {
    return { error: 'No se pudo actualizar el barrio de la propiedad.' };
  }
}

export async function deleteZoneAction(slug: string, data: FormData) {
  const { membership } = await requireAgencyDashboardAccess(slug);
  const zoneId = value(data, 'zoneId');
  if (zoneId && zoneId.length <= 64) await deleteAgencyZone(membership.agency.id, zoneId);
  refresh(slug);
}

export async function deletePointOfInterestAction(slug: string, data: FormData) {
  const { membership } = await requireAgencyDashboardAccess(slug);
  const pointId = value(data, 'pointId');
  if (pointId && pointId.length <= 64) await deleteAgencyPointOfInterest(membership.agency.id, pointId);
  refresh(slug);
}
