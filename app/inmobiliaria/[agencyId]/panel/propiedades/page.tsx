import {WorkspaceEditPermissionProvider} from '@/components/auth/WorkspaceEditPermission';
import { prisma } from '@/lib/prisma';
import { parsePresentationSettings } from '@/lib/agency-presentation';
import { requireAgencyDashboardAccess } from '@/lib/agency-access';
import { WorkspaceShell } from '@/components/auth/WorkspaceShell';
import { PropertyManager } from '@/components/auth/PropertyManager';
import { listAgencyProperties } from '@/lib/properties/agency-property-service';

export default async function Page({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const { user, membership, canEdit, canManageCatalogue, canManageBasic } = await requireAgencyDashboardAccess(agencyId);
  const [properties,config] = await Promise.all([listAgencyProperties(membership.agency.id),prisma.agencyPresentationConfig.findUnique({where:{agencyId:membership.agency.id},select:{presentationSettings:true}})]);
  const propertyContacts=parsePresentationSettings(config?.presentationSettings)?.propertyContacts??{};
  const canManagePropertyContact=canEdit||['OWNER','ADMIN'].includes(membership.role);

  return (
    <WorkspaceShell
      canEdit={canEdit}
      canManageBasic={canManageBasic}
      agencyName={membership.agency.name}
      brandPrimaryColor={membership.agency.brandPrimaryColor}
      agencySlug={agencyId}
      email={user.email}
      activeSection="properties"
      canManageCollaboration={['OWNER', 'ADMIN'].includes(membership.role)}
      canManageRentals={['OWNER', 'ADMIN'].includes(membership.role)}
    >
      <WorkspaceEditPermissionProvider canEdit={canManageCatalogue}><PropertyManager agencySlug={agencyId} properties={properties} propertyContacts={propertyContacts} canManagePropertyContact={canManagePropertyContact} /></WorkspaceEditPermissionProvider>
    </WorkspaceShell>
  );
}
