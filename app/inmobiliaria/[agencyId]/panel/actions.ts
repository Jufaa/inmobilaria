'use server';

import { revalidatePath } from 'next/cache';
import { requireAgencyDashboardAccess } from '@/lib/agency-access';
import {
  createAgencyProperty,
  propertyCurrencies,
  propertyOperations,
  propertyStatuses,
  propertyTypes,
  updateAgencyProperty,
  updateAgencyPropertyStatus,
  type AgencyPropertyInput,
} from '@/lib/properties/agency-property-service';

export type PropertyActionState = { error?: string; success?: string };

const value = (formData: FormData, name: string) =>
  String(formData.get(name) ?? '').trim();

function finiteNumber(raw: string) {
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseProperty(formData: FormData):
  | { data: AgencyPropertyInput }
  | { error: string } {
  const title = value(formData, 'title');
  const description = value(formData, 'description');
  const type = value(formData, 'type');
  const operation = value(formData, 'operation');
  const status = value(formData, 'status') || 'DRAFT';
  const currency = value(formData, 'currency');
  const neighborhood = value(formData, 'neighborhood');
  const address = value(formData, 'address');
  const price = finiteNumber(value(formData, 'price'));
  const area = finiteNumber(value(formData, 'area'));
  const bedrooms = finiteNumber(value(formData, 'bedrooms'));
  const bathrooms = finiteNumber(value(formData, 'bathrooms'));
  const rawLatitude = value(formData, 'latitude');
  const rawLongitude = value(formData, 'longitude');
  const latitude = finiteNumber(rawLatitude);
  const longitude = finiteNumber(rawLongitude);
  const features = value(formData, 'features')
    .split(/[\n,]/)
    .map((feature) => feature.trim())
    .filter(Boolean);

  if (title.length < 3 || title.length > 160) return { error: 'El título debe tener entre 3 y 160 caracteres.' };
  if (description.length > 5000) return { error: 'La descripción no puede superar los 5000 caracteres.' };
  if (!propertyTypes.includes(type as (typeof propertyTypes)[number])) return { error: 'Elegí un tipo de propiedad válido.' };
  if (!propertyOperations.includes(operation as (typeof propertyOperations)[number])) return { error: 'Elegí una operación válida.' };
  if (!propertyStatuses.includes(status as (typeof propertyStatuses)[number])) return { error: 'Elegí un estado válido.' };
  if (!propertyCurrencies.includes(currency as (typeof propertyCurrencies)[number])) return { error: 'Elegí una moneda válida.' };
  if (!neighborhood || neighborhood.length > 120) return { error: 'Indicá un barrio de hasta 120 caracteres.' };
  if (!address || address.length > 240) return { error: 'Indicá una dirección de hasta 240 caracteres.' };
  if (price === null || price < 0 || price > 999999999999) return { error: 'Ingresá un precio válido.' };
  if (area === null || area <= 0 || area > 99999999) return { error: 'Ingresá una superficie válida.' };
  if (bedrooms === null || !Number.isInteger(bedrooms) || bedrooms < 0 || bedrooms > 50) return { error: 'La cantidad de dormitorios debe ser un entero entre 0 y 50.' };
  if (bathrooms === null || !Number.isInteger(bathrooms) || bathrooms < 0 || bathrooms > 50) return { error: 'La cantidad de baños debe ser un entero entre 0 y 50.' };
  if (features.length > 30 || features.some((feature) => feature.length > 80)) return { error: 'Usá hasta 30 características de 80 caracteres cada una.' };
  if ((rawLatitude && latitude === null) || (rawLongitude && longitude === null)) return { error: 'Las coordenadas deben ser números válidos.' };
  if ((latitude === null) !== (longitude === null)) return { error: 'Completá latitud y longitud juntas.' };
  if (latitude !== null && (latitude < -90 || latitude > 90 || longitude! < -180 || longitude! > 180)) return { error: 'Las coordenadas están fuera de rango.' };

  return {
    data: {
      title,
      description,
      type: type as AgencyPropertyInput['type'],
      operation: operation as AgencyPropertyInput['operation'],
      status: status as AgencyPropertyInput['status'],
      price,
      currency: currency as AgencyPropertyInput['currency'],
      neighborhood,
      address,
      area,
      bedrooms,
      bathrooms,
      features,
      latitude,
      longitude,
    },
  };
}

export async function createPropertyAction(
  agencySlug: string,
  _previousState: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  const { membership } = await requireAgencyDashboardAccess(agencySlug);
  const parsed = parseProperty(formData);
  if ('error' in parsed) return parsed;
  try {
    await createAgencyProperty(membership.agency.id, parsed.data);
    revalidatePath(`/inmobiliaria/${encodeURIComponent(agencySlug)}/panel/propiedades`);
    revalidatePath(`/inmobiliaria/${encodeURIComponent(agencySlug)}/panel`);
    return { success: 'Propiedad guardada en la base de datos.' };
  } catch {
    return { error: 'No se pudo guardar. Verificá la conexión y tu acceso a esta inmobiliaria.' };
  }
}

export async function updatePropertyAction(
  agencySlug: string,
  _previousState: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  const { membership } = await requireAgencyDashboardAccess(agencySlug);
  const propertyId = value(formData, 'propertyId');
  if (!propertyId || propertyId.length > 64) return { error: 'La propiedad seleccionada no es válida.' };
  const parsed = parseProperty(formData);
  if ('error' in parsed) return parsed;
  try {
    const updated = await updateAgencyProperty(membership.agency.id, propertyId, parsed.data);
    if (!updated) return { error: 'La propiedad no existe en esta inmobiliaria.' };
    revalidatePath(`/inmobiliaria/${encodeURIComponent(agencySlug)}/panel/propiedades`);
    revalidatePath(`/inmobiliaria/${encodeURIComponent(agencySlug)}/panel`);
    return { success: 'Cambios guardados en la base de datos.' };
  } catch {
    return { error: 'No se pudo actualizar. Verificá la conexión y tu acceso a esta inmobiliaria.' };
  }
}

export async function updatePropertyAvailabilityAction(
  agencySlug: string,
  _previousState: PropertyActionState,
  formData: FormData,
): Promise<PropertyActionState> {
  const { membership } = await requireAgencyDashboardAccess(agencySlug);
  const propertyId = value(formData, 'propertyId');
  const status = value(formData, 'status');
  if (!propertyId || propertyId.length > 64) return { error: 'La propiedad seleccionada no es válida.' };
  if (!propertyStatuses.includes(status as (typeof propertyStatuses)[number])) return { error: 'El estado seleccionado no es válido.' };
  try {
    const updated = await updateAgencyPropertyStatus(membership.agency.id, propertyId, status as AgencyPropertyInput['status']);
    if (!updated) return { error: 'La propiedad no existe en esta inmobiliaria.' };
    revalidatePath(`/inmobiliaria/${encodeURIComponent(agencySlug)}/panel/propiedades`);
    revalidatePath(`/inmobiliaria/${encodeURIComponent(agencySlug)}/panel`);
    return { success: 'Disponibilidad actualizada.' };
  } catch {
    return { error: 'No se pudo cambiar el estado. Verificá tu acceso y la conexión.' };
  }
}
