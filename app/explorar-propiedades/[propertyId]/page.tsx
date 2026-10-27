import { notFound } from 'next/navigation';
import { PublicPropertyDetail } from '@/components/PublicPropertyDetail';
import { getPublicPropertyDetails } from '@/lib/properties/public-inquiry-service';

export default async function PublicPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { propertyId } = await params;
  if (!propertyId || propertyId.length > 64) notFound();
  const query = await searchParams;
  const rawAgencySlug = Array.isArray(query.inmobiliaria) ? query.inmobiliaria[0] : query.inmobiliaria;
  const agencySlug = rawAgencySlug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawAgencySlug) && rawAgencySlug.length <= 60
    ? rawAgencySlug
    : undefined;
  const property = await getPublicPropertyDetails(propertyId, agencySlug);
  if (!property) notFound();

  return <PublicPropertyDetail property={property} />;
}
