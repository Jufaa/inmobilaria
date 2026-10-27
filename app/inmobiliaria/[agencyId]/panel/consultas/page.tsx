import { WorkspaceShell } from '@/components/auth/WorkspaceShell';
import { InquiryManager } from '@/components/auth/InquiryManager';
import { requireAgencyDashboardAccess } from '@/lib/agency-access';
import { listAgencyInquiries } from '@/lib/properties/public-inquiry-service';

export default async function InquiriesPage({
  params,
}: {
  params: Promise<{ agencyId: string }>;
}) {
  const { agencyId } = await params;
  const { user, membership } = await requireAgencyDashboardAccess(agencyId);
  const inquiries = await listAgencyInquiries(membership.agency.id);

  return (
    <WorkspaceShell
      agencyName={membership.agency.name}
      agencySlug={agencyId}
      email={user.email}
      activeSection="inquiries"
      canManageCollaboration={['OWNER', 'ADMIN'].includes(membership.role)}
    >
      <InquiryManager agencySlug={agencyId} inquiries={inquiries} />
    </WorkspaceShell>
  );
}
