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

  const canEdit = account?.platformRole === 'OWNER';
  if (membership) return { user, membership, canEdit };
  if (account?.platformRole === 'OWNER') {
    const agency = await prisma.agency.findUnique({ where: { slug } });
    if (agency) return { user, membership: { role: 'OWNER' as const, agency }, canEdit: true };
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

export async function getPlatformEditPermission(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const account = await prisma.user.findUnique({ where: { id: session.user.id }, select: { platformRole: true } });
  return account?.platformRole === 'OWNER';
}

export async function requireAgencyPlatformEditAccess(slug: string) {
  const user = await requireSignedInUser();
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { platformRole: true } });
  if (account?.platformRole !== 'OWNER') redirect('/workspace');
  const agency = await prisma.agency.findUnique({ where: { slug } });
  if (!agency) redirect('/workspace');
  return { user, membership: { role: 'OWNER' as const, agency }, canEdit: true };
}
