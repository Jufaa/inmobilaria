import 'server-only';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function requireSignedInUser() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return session.user;
}

export async function getCurrentUserMemberships() {
  const user = await requireSignedInUser();
  const [memberships, account] = await Promise.all([
    prisma.membership.findMany({
      where: { userId: user.id },
      include: { agency: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.user.findUnique({ where: { id: user.id }, select: { platformRole: true } }),
  ]);
  return { user, memberships, isPlatformOwner: account?.platformRole === 'OWNER' };
}

async function requireAgencyAccess(slug: string, membershipRoles: ('OWNER' | 'ADMIN' | 'EDITOR')[]) {
  const user = await requireSignedInUser();
  const [membership, account] = await Promise.all([
    prisma.membership.findFirst({
      where: { userId: user.id, agency: { slug }, role: { in: membershipRoles } },
      include: { agency: true },
    }),
    prisma.user.findUnique({ where: { id: user.id }, select: { platformRole: true } }),
  ]);

  if (membership) return { user, membership };
  if (account?.platformRole === 'OWNER') {
    const agency = await prisma.agency.findUnique({ where: { slug } });
    if (agency) return { user, membership: { role: 'OWNER' as const, agency } };
  }
  redirect('/workspace');
}

export async function requireAgencyDashboardAccess(slug: string) {
  return requireAgencyAccess(slug, ['OWNER', 'ADMIN', 'EDITOR']);
}

export async function requireAgencyCollaborationAccess(slug: string) {
  return requireAgencyAccess(slug, ['OWNER', 'ADMIN']);
}

export async function requireAgencyFinanceAccess(slug: string) {
  return requireAgencyAccess(slug, ['OWNER', 'ADMIN']);
}
