import { requireAgencyCollaborationAccess } from '@/lib/agency-access';
import { listAgencyCollaboration } from '@/lib/collaboration-service';
import { WorkspaceShell } from '@/components/auth/WorkspaceShell';
import { AgencyCollaborationManager } from '@/components/auth/AgencyCollaborationManager';

export default async function Page({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const { user, membership } = await requireAgencyCollaborationAccess(agencyId);
  const data = await listAgencyCollaboration(membership.agency.id);

  return (
    <WorkspaceShell
      agencyName={membership.agency.name}
      agencySlug={agencyId}
      email={user.email}
      activeSection="collaboration"
      canManageCollaboration
    >
      <AgencyCollaborationManager
        agencyId={membership.agency.id}
        agencySlug={agencyId}
        connections={data.connections.map((connection) => ({
          id: connection.id,
          requestedByAgencyId: connection.requestedByAgencyId,
          status: connection.status,
          lowCommissionPercent: connection.lowCommissionPercent,
          highCommissionPercent: connection.highCommissionPercent,
          agencyLowId: connection.agencyLowId,
          agencyHighId: connection.agencyHighId,
          agencyLow: connection.agencyLow,
          agencyHigh: connection.agencyHigh,
          shareCount: connection._count.shareGrants,
        }))}
        ownedShares={data.ownedGrants.map((grant) => ({
          id: grant.id,
          property: grant.property,
          partner: grant.recipientAgency,
        }))}
        receivedShares={data.receivedGrants.map((grant) => ({
          id: grant.id,
          property: grant.property,
          partner: grant.ownerAgency,
          owner: grant.ownerAgency,
        }))}
        publishedProperties={data.publishedProperties}
        events={data.events.map((event) => ({
          id: event.id,
          type: event.type,
          createdAt: event.createdAt.toISOString(),
          actorAgency: event.actorAgency,
          propertyId: event.propertyId,
        }))}
      />
    </WorkspaceShell>
  );
}
