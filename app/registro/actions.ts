'use server';

import { prisma } from '@/lib/prisma';
import { isDemoAccessEnabled } from '@/lib/auth/demo-access';
import {
  createVerificationToken,
  hashPassword,
  normalizeEmail,
  sendVerificationEmail,
  validateEmail,
  verificationUrl,
} from '@/lib/auth/password-auth';

export type RegistrationState = { error?: string; message?: string; verificationUrl?: string };

const isUniqueEmailError = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

export async function registerAction(_previous: RegistrationState, formData: FormData): Promise<RegistrationState> {
  if (isDemoAccessEnabled()) return { error: 'El registro está deshabilitado durante el acceso de demostración.' };
  const name = String(formData.get('name') ?? '').trim();
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const password = String(formData.get('password') ?? '');
  const confirmation = String(formData.get('confirmation') ?? '');

  if (name.length < 2 || name.length > 120) return { error: 'Ingresá un nombre de entre 2 y 120 caracteres.' };
  if (!validateEmail(email)) return { error: 'Ingresá un correo válido.' };
  if (password.length < 12 || password.length > 128) return { error: 'La contraseña debe tener entre 12 y 128 caracteres.' };
  if (password !== confirmation) return { error: 'Las contraseñas no coinciden.' };

  let link: string;
  try {
    link = verificationUrl('pending');
  } catch {
    return { error: 'El registro por correo no está configurado todavía. Contactá al administrador.' };
  }

  const passwordHash = await hashPassword(password);
  const verification = createVerificationToken();
  link = verificationUrl(verification.token);
  let userId: string;

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { name, email, passwordHash } });
      await tx.verificationToken.create({ data: { identifier: email, token: verification.tokenHash, expires: verification.expires } });
      return created;
    });
    userId = user.id;
  } catch (error) {
    if (isUniqueEmailError(error)) {
      return { message: 'Si el correo puede registrarse, recibirás instrucciones para verificarlo.' };
    }
    return { error: 'No pudimos crear la cuenta. Intentá nuevamente más tarde.' };
  }

  try {
    const sent = await sendVerificationEmail(email, name, link);
    return sent
      ? { message: 'Si el correo puede registrarse, recibirás instrucciones para verificarlo.' }
      : { message: 'Cuenta creada. Usá este enlace local para verificar el correo.', verificationUrl: link };
  } catch {
    await prisma.$transaction([
      prisma.verificationToken.deleteMany({ where: { token: verification.tokenHash } }),
      prisma.user.deleteMany({ where: { id: userId, emailVerified: null } }),
    ]).catch(() => undefined);
    return { error: 'No pudimos enviar el correo de verificación. La cuenta no se guardó; intentá nuevamente más tarde.' };
  }
}
