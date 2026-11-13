import { WorkspaceShell } from '@/components/auth/WorkspaceShell';
import { RealAgencyMap } from '@/components/auth/RealAgencyMap';
import { requireAgencyDashboardAccess } from '@/lib/agency-access';
import { prisma } from '@/lib/prisma';
import { listAgencyProperties } from '@/lib/properties/agency-property-service';
import { defaultPresentationSettings, parsePresentationSettings, withAgencyFictionalIntro } from '@/lib/agency-presentation';
import { defaultDemoConfig, parseDemoConfig } from '@/lib/property-tour-config';
import { saveDemoConfigAction, savePresentationSettingsAction } from './personalizacion/presentation-actions';
import { createMapPropertyAction, updateMapPropertyAction } from './actions';

export default async function Page({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const { user, membership, canEdit, canManageCatalogue, canManageBasic } = await requireAgencyDashboardAccess(agencyId);
  const [properties, presentationConfig, points] = await Promise.all([
    listAgencyProperties(membership.agency.id),
    prisma.agencyPresentationConfig.findUnique({ where: { agencyId: membership.agency.id } }),
    prisma.pointOfInterest.findMany({ where: { agencyId: membership.agency.id }, orderBy: { name: 'asc' } }),
  ]);
  return <WorkspaceShell fullscreenMap canEdit={canEdit} canManageBasic={canManageBasic} agencyName={membership.agency.name} agencySlug={agencyId}
    brandPrimaryColor={membership.agency.brandPrimaryColor} email={user.email} activeSection="map"
    canManageCollaboration={['OWNER', 'ADMIN'].includes(membership.role)}
    canManageRentals={['OWNER', 'ADMIN'].includes(membership.role)}>
    <RealAgencyMap fullscreen agencyId={membership.agency.id} agencySlug={agencyId} agencyName={membership.agency.name}
      properties={properties} settings={withAgencyFictionalIntro(parsePresentationSettings(presentationConfig?.presentationSettings) ?? defaultPresentationSettings)}
      exampleConfig={parseDemoConfig(presentationConfig?.demoTourConfig) ?? defaultDemoConfig}
      persistSettings={savePresentationSettingsAction.bind(null, agencyId)}
      persistDemoConfig={saveDemoConfigAction.bind(null, agencyId)}
      referencePoints={points.map(point => ({ id: `catalogue-${point.id}`, name: point.name, latitude: point.latitude.toNumber(), longitude: point.longitude.toNumber(), color: '#4c8067' }))}
      photosEnabled={Boolean(process.env.BLOB_READ_WRITE_TOKEN)} onCreate={createMapPropertyAction.bind(null, agencyId)} onUpdate={updateMapPropertyAction.bind(null, agencyId)}
      canCustomize={canEdit} canManageCatalogue={canManageCatalogue} />
  </WorkspaceShell>;
}
