import { getPublicPropertyDiscovery } from '@/lib/properties/public-property-service';
import { PublicPropertyDiscovery } from '@/components/PublicPropertyDiscovery';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function positiveNumber(value: string | undefined, min: number, max: number) {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max
    ? number
    : undefined;
}

export default async function ExplorePropertiesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const operation = first(params.operacion);
  const type = first(params.tipo);
  const currency = first(params.moneda);
  const rawNeighborhood = first(params.barrio);
  const neighborhood = rawNeighborhood?.trim().slice(0, 120) || undefined;
  const rawZoneId = first(params.zona);
  const zoneId = rawZoneId && rawZoneId.length <= 64 ? rawZoneId : undefined;
  const minPrice = positiveNumber(first(params.desde), 0, 1_000_000_000_000);
  const maxPrice = positiveNumber(first(params.hasta), 0, 1_000_000_000_000);
  const minBedrooms = positiveNumber(first(params.dormitorios), 0, 50);
  const page = positiveNumber(first(params.pagina), 1, 10_000);
  const rawAgencySlug = first(params.inmobiliaria);
  const agencySlug = rawAgencySlug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawAgencySlug) && rawAgencySlug.length <= 60
    ? rawAgencySlug
    : undefined;

  const result = await getPublicPropertyDiscovery({
    operation: operation === 'SALE' || operation === 'RENT' ? operation : undefined,
    type:
      type === 'APARTMENT' ||
      type === 'HOUSE' ||
      type === 'PH' ||
      type === 'LAND' ||
      type === 'COMMERCIAL' ||
      type === 'OTHER'
        ? type
        : undefined,
    currency: currency === 'ARS' || currency === 'USD' ? currency : undefined,
    neighborhood,
    zoneId,
    minPrice,
    maxPrice,
    minBedrooms,
    page,
    agencySlug,
  });

  return (
    <PublicPropertyDiscovery
      result={result}
      filters={{
        operation: operation === 'SALE' || operation === 'RENT' ? operation : '',
        type:
          type === 'APARTMENT' ||
          type === 'HOUSE' ||
          type === 'PH' ||
          type === 'LAND' ||
          type === 'COMMERCIAL' ||
          type === 'OTHER'
            ? type
            : '',
        currency: currency === 'ARS' || currency === 'USD' ? currency : '',
        neighborhood: neighborhood ?? '',
        zoneId: zoneId ?? '',
        minPrice: first(params.desde) ?? '',
        maxPrice: first(params.hasta) ?? '',
        minBedrooms: first(params.dormitorios) ?? '',
        agencySlug: agencySlug ?? '',
      }}
    />
  );
}
