import { requireAgencyDashboardAccess } from '@/lib/agency-access';
import { WorkspaceShell } from '@/components/auth/WorkspaceShell';
import { PropertyManager } from '@/components/auth/PropertyManager';
import { listAgencyProperties } from '@/lib/properties/agency-property-service';

export default async function Page({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const { user, membership, canEdit } = await requireAgencyDashboardAccess(agencyId);
  const properties = await listAgencyProperties(membership.agency.id);

  return (
    <WorkspaceShell
      canEdit={canEdit}
      agencyName={membership.agency.name}
      brandPrimaryColor={membership.agency.brandPrimaryColor}
      agencySlug={agencyId}
      email={user.email}
      activeSection="properties"
      canManageCollaboration={['OWNER', 'ADMIN'].includes(membership.role)}
      canManageRentals={['OWNER', 'ADMIN'].includes(membership.role)}
    >
      <PropertyManager agencySlug={agencyId} properties={properties} />
    </WorkspaceShell>
  );
}
