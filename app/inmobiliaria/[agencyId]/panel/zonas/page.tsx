import { WorkspaceShell } from '@/components/auth/WorkspaceShell';
import { ZoneManager } from '@/components/auth/ZoneManager';
import { requireAgencyDashboardAccess } from '@/lib/agency-access';
import { listAgencyZones } from '@/lib/zones/zone-service';

export default async function ZonesPage({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const { user, membership, canEdit } = await requireAgencyDashboardAccess(agencyId);
  const data = await listAgencyZones(membership.agency.id);
  return <WorkspaceShell
      canEdit={canEdit}
    agencyName={membership.agency.name}
      brandPrimaryColor={membership.agency.brandPrimaryColor}
    agencySlug={agencyId}
    email={user.email}
    activeSection="zones"
    canManageCollaboration={['OWNER', 'ADMIN'].includes(membership.role)}
  >
    <ZoneManager
      slug={agencyId}
      zones={data.zones.map((zone) => ({ ...zone, latitude: zone.latitude?.toNumber() ?? null, longitude: zone.longitude?.toNumber() ?? null }))}
      properties={data.properties}
      points={data.pointsOfInterest.map((point) => ({
        ...point,
        latitude: point.latitude.toNumber(),
        longitude: point.longitude.toNumber(),
        zone: point.zone,
      }))}
    />
  </WorkspaceShell>;
}
