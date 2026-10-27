'use server';

import { redirect } from 'next/navigation';
import { getCurrentUserMemberships } from '@/lib/agency-access';
import { prisma } from '@/lib/prisma';

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export async function createAgency(formData: FormData) {
  const { user, memberships: existing, isPlatformOwner } = await getCurrentUserMemberships();
  if (existing.length && !isPlatformOwner) redirect('/workspace');

  const name = String(formData.get('name') ?? '').trim();
  if (name.length < 2 || name.length > 120) {
    redirect('/onboarding?error=invalid-name');
  }

  const baseSlug = slugify(name) || 'inmobiliaria';
  const slug = `${baseSlug.slice(0, 50)}-${crypto.randomUUID().slice(0, 8)}`;
  const agency = await prisma.$transaction(async (tx) => {
    const created = await tx.agency.create({ data: { name, slug } });
    await tx.membership.create({
      data: { userId: user.id, agencyId: created.id, role: 'OWNER' },
    });
    return created;
  });

  redirect(`/inmobiliaria/${encodeURIComponent(agency.slug)}/panel`);
}
