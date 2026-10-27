import { redirect } from 'next/navigation';
import { getCurrentUserMemberships } from '@/lib/agency-access';

export default async function PanelPage() {
  const { memberships, isPlatformOwner } = await getCurrentUserMemberships();
  if (!memberships.length && !isPlatformOwner) redirect('/onboarding');
  if (isPlatformOwner) redirect('/workspace');
  const dashboardMembership = memberships.find(({ role }) => role === 'OWNER' || role === 'ADMIN');
  if (!dashboardMembership) redirect('/workspace');
  redirect(`/inmobiliaria/${encodeURIComponent(dashboardMembership.agency.slug)}/panel`);
}
