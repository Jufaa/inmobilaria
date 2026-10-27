import { notFound } from 'next/navigation';
import { getPublicAgencyStorefront } from '@/lib/agencies/public-storefront';
import { AgencyStorefront } from '@/components/AgencyStorefront';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const agency = await getPublicAgencyStorefront(agencyId);
  if (!agency) notFound();
  return <AgencyStorefront agency={agency} />;
}
