import { requireAgencyCollaborationAccess } from '@/lib/agency-access';
import { WorkspaceShell } from '@/components/auth/WorkspaceShell';
import { AgencyPresentationSettings } from '@/components/auth/AgencyPresentationSettings';
import { BrandingForm } from './BrandingForm';
import styles from './branding.module.css';
import { prisma } from '@/lib/prisma';
import { defaultPresentationSettings, parsePresentationSettings } from '@/lib/agency-presentation';
import { savePresentationSettingsAction } from './presentation-actions';

export default async function Page({ params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const { user, membership } = await requireAgencyCollaborationAccess(agencyId);
  const presentationConfig = await prisma.agencyPresentationConfig.findUnique({ where: { agencyId: membership.agency.id } });

  return (
    <WorkspaceShell
      agencyName={membership.agency.name}
      agencySlug={agencyId}
      email={user.email}
      activeSection="branding"
      canManageCollaboration
    >
      <main className={styles.page}>
        <header><p>Presentación pública</p><h1>Identidad de tu inmobiliaria</h1><span>La marca se muestra en la página pública de tu inmobiliaria.</span></header>
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
        <AgencyPresentationSettings
          agencyId={membership.agency.id}
          initialSettings={parsePresentationSettings(presentationConfig?.presentationSettings) ?? defaultPresentationSettings}
          onPersist={savePresentationSettingsAction.bind(null, agencyId)}
        />
      </main>
    </WorkspaceShell>
  );
}
