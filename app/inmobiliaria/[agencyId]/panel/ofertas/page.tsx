import { requireAgencyPlatformEditAccess } from '@/lib/agency-access';
import { prisma } from '@/lib/prisma';
import { WorkspaceShell } from '@/components/auth/WorkspaceShell';
import { AgencyOffersManager } from '@/components/auth/AgencyOffersManager';
import { listAgencyProperties } from '@/lib/properties/agency-property-service';
import { defaultPresentationSettings, parsePresentationSettings } from '@/lib/agency-presentation';
import { defaultDemoConfig, parseDemoConfig } from '@/lib/property-tour-config';
import { agencyOfferTargets } from '@/lib/agency-offer-targets';
import { savePresentationSettingsAction } from '../personalizacion/presentation-actions';
export default async function Page({params}:{params:Promise<{agencyId:string}>}) {
  const {agencyId}=await params;
  const {user,membership}=await requireAgencyPlatformEditAccess(agencyId);
  const [properties,config]=await Promise.all([listAgencyProperties(membership.agency.id),prisma.agencyPresentationConfig.findUnique({where:{agencyId:membership.agency.id}})]);
  const settings=parsePresentationSettings(config?.presentationSettings)??defaultPresentationSettings;
  const targets=agencyOfferTargets(properties,settings,parseDemoConfig(config?.demoTourConfig)??defaultDemoConfig);
  return <WorkspaceShell agencyName={membership.agency.name} agencySlug={agencyId} brandPrimaryColor={membership.agency.brandPrimaryColor} email={user.email} activeSection="offers" canEdit canManageCollaboration canManageRentals>
    <AgencyOffersManager initialSettings={settings} targets={targets} onPersist={savePresentationSettingsAction.bind(null,agencyId)}/>
  </WorkspaceShell>;
}
