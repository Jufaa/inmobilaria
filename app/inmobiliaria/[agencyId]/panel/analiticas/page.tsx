import { WorkspaceShell } from '@/components/auth/WorkspaceShell';
import { AgencyAnalyticsDashboard } from '@/components/auth/AgencyAnalyticsDashboard';
import { requireAgencyDashboardAccess } from '@/lib/agency-access';
import { getAgencyAnalytics } from '@/lib/analytics/public-analytics-service';

export default async function AnalyticsPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const { user, membership, canEdit } = await requireAgencyDashboardAccess(agencyId);
  const analytics = await getAgencyAnalytics(membership.agency.id, 30);

  return (
    <WorkspaceShell
      canEdit={canEdit}
      agencyName={membership.agency.name}
      brandPrimaryColor={membership.agency.brandPrimaryColor}
      agencySlug={agencyId}
      email={user.email}
      activeSection="analytics"
      canManageCollaboration={['OWNER', 'ADMIN'].includes(membership.role)}
    >
      <AgencyAnalyticsDashboard data={analytics} />
    </WorkspaceShell>
  );
}
