import { requireAgencyCollaborationAccess } from '@/lib/agency-access';
import { WorkspaceShell } from '@/components/auth/WorkspaceShell';
import { PersonalizationPanels } from '@/components/auth/PersonalizationPanels';
import { AgencyPresentationSettings } from '@/components/auth/AgencyPresentationSettings';
import { BrandingForm } from './BrandingForm';
import styles from './branding.module.css';
import { prisma } from '@/lib/prisma';
import { defaultPresentationSettings, parsePresentationSettings, withAgencyFictionalIntro } from '@/lib/agency-presentation';
import { listAgencyProperties } from '@/lib/properties/agency-property-service';
import { defaultDemoConfig, parseDemoConfig } from '@/lib/property-tour-config';
import { RealAgencyMap } from '@/components/auth/RealAgencyMap';
import { createMapPropertyAction, updateMapPropertyAction } from '../actions';
import { savePresentationSettingsAction } from './presentation-actions';

export default async function Page({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const { user, membership, canEdit } = await requireAgencyCollaborationAccess(agencyId);
  const [presentationConfig, properties] = await Promise.all([
    prisma.agencyPresentationConfig.findUnique({ where: { agencyId: membership.agency.id } }),
    listAgencyProperties(membership.agency.id),
  ]);
  const settings = withAgencyFictionalIntro(parsePresentationSettings(presentationConfig?.presentationSettings) ?? defaultPresentationSettings);

  return (
    <WorkspaceShell
      canEdit={canEdit}
      agencyName={membership.agency.name}
      agencySlug={agencyId}
      brandPrimaryColor={membership.agency.brandPrimaryColor}
      email={user.email}
      activeSection="branding"
      canManageCollaboration
    >
      <main className={styles.page}>
        <header><p>Configuración de la inmobiliaria</p><h1>Personalización</h1><span>Elija qué quiere personalizar: identidad, mapa, inmuebles o apariencia.</span></header>
        <PersonalizationPanels identity={
        <BrandingForm
          agencySlug={agencyId}
          initial={{
            brandPrimaryColor: membership.agency.brandPrimaryColor,
            logoUrl: membership.agency.logoUrl,
            coverUrl: membership.agency.coverUrl,
            welcomeVideoUrl: membership.agency.welcomeVideoUrl,
            welcomeVideoDescription: membership.agency.welcomeVideoDescription,
          }}
        />
        } presentation={<AgencyPresentationSettings
          agencyId={membership.agency.id}
          config={parseDemoConfig(presentationConfig?.demoTourConfig)??defaultDemoConfig}
          realProperties={properties}
          propertyEditor={<RealAgencyMap agencySlug={agencyId} agencyId={membership.agency.id} agencyName={membership.agency.name}
            properties={properties} settings={settings} photosEnabled={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
            onCreate={createMapPropertyAction.bind(null, agencyId)} onUpdate={updateMapPropertyAction.bind(null, agencyId)} canCustomize={canEdit} embedded />}
          initialSettings={settings}
          onPersist={savePresentationSettingsAction.bind(null, agencyId)}
        />} />
      </main>
    </WorkspaceShell>
  );
}
