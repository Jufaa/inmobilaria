'use server';

import { prisma } from '@/lib/prisma';
import { hashVerificationToken } from '@/lib/auth/password-auth';
import { Prisma } from '@/generated/prisma/client';

export type VerificationState = { success?: boolean; error?: string };

export async function verifyEmailAction(_previous: VerificationState, formData: FormData): Promise<VerificationState> {
  const token = String(formData.get('token') ?? '');
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { error: 'El enlace no es válido o ya venció.' };
  const tokenHash = hashVerificationToken(token);
  const now = new Date();

  try {
    const verified = await prisma.$transaction(async (tx) => {
      const verification = await tx.verificationToken.findUnique({ where: { token: tokenHash } });
      if (!verification || verification.expires <= now) return false;

      const updated = await tx.user.updateMany({
        where: { email: verification.identifier, emailVerified: null },
        data: { emailVerified: now },
      });
      if (updated.count !== 1) return false;

      const consumed = await tx.verificationToken.deleteMany({ where: { token: tokenHash, expires: { gt: now } } });
      if (consumed.count !== 1) throw new Error('VERIFICATION_TOKEN_ALREADY_CONSUMED');
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return verified ? { success: true } : { error: 'El enlace no es válido o ya venció.' };
  } catch {
    return { error: 'No pudimos verificar el correo. Solicitá un nuevo enlace e intentá nuevamente.' };
  }
}
