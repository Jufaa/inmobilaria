import { WorkspaceShell } from '@/components/auth/WorkspaceShell';
import type { WorkspaceMapPoint, WorkspaceMapProperty, WorkspaceMapZone } from '@/components/auth/WorkspacePropertyMap';
import { AgencyPresentationMap } from '@/components/auth/AgencyPresentationMap';
import { requireAgencyDashboardAccess } from '@/lib/agency-access';
import { prisma } from '@/lib/prisma';
import { defaultPresentationSettings, parsePresentationSettings } from '@/lib/agency-presentation';
import { defaultDemoConfig, parseDemoConfig } from '@/lib/property-tour-config';
import { saveDemoConfigAction, savePresentationSettingsAction } from './personalizacion/presentation-actions';

export default async function Page({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const { user, membership } = await requireAgencyDashboardAccess(agencyId);
  const agencyIdFromSession = membership.agency.id;
  const [propertyRows, zoneRows, pointRows, presentationConfig] = await Promise.all([
    prisma.property.findMany({
      where: { agencyId: agencyIdFromSession },
      select: { id: true, title: true, status: true, price: true, currency: true, neighborhood: true, zoneId: true, latitude: true, longitude: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.zone.findMany({
      where: { agencyId: agencyIdFromSession },
      select: { id: true, name: true, city: true, geometry: true, latitude: true, longitude: true },
      orderBy: [{ city: 'asc' }, { name: 'asc' }],
    }),
    prisma.pointOfInterest.findMany({
      where: { agencyId: agencyIdFromSession },
      select: { id: true, name: true, category: true, latitude: true, longitude: true },
      orderBy: { name: 'asc' },
    }),
    prisma.agencyPresentationConfig.findUnique({ where: { agencyId: agencyIdFromSession } }),
  ]);
  const properties: WorkspaceMapProperty[] = propertyRows.map((property) => ({
    ...property,
    price: property.price.toNumber(),
    currency: property.currency as 'ARS' | 'USD',
    latitude: property.latitude?.toNumber() ?? null,
    longitude: property.longitude?.toNumber() ?? null,
  }));
  const zones: WorkspaceMapZone[] = zoneRows.map((zone) => ({
    ...zone,
    latitude: zone.latitude?.toNumber() ?? null,
    longitude: zone.longitude?.toNumber() ?? null,
  }));
  const points: WorkspaceMapPoint[] = pointRows.map((point) => ({
    ...point,
    latitude: point.latitude.toNumber(),
    longitude: point.longitude.toNumber(),
  }));

  return (
    <WorkspaceShell
      agencyName={membership.agency.name}
      agencySlug={agencyId}
      email={user.email}
      activeSection="map"
      canManageCollaboration={['OWNER', 'ADMIN'].includes(membership.role)}
      canManageRentals={['OWNER', 'ADMIN'].includes(membership.role)}
    >
      <AgencyPresentationMap
        agencyId={membership.agency.id}
        agencySlug={agencyId}
        agencyName={membership.agency.name}
        title={`Mapa de ${membership.agency.name}`}
        properties={properties}
        zones={zones}
        points={points}
        initialSettings={parsePresentationSettings(presentationConfig?.presentationSettings) ?? defaultPresentationSettings}
        initialDemoConfig={parseDemoConfig(presentationConfig?.demoTourConfig) ?? defaultDemoConfig}
        persistSettings={savePresentationSettingsAction.bind(null, agencyId)}
        persistDemoConfig={saveDemoConfigAction.bind(null, agencyId)}
      />
    </WorkspaceShell>
  );
}
