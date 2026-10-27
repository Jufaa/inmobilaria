'use server';

import { AuthError } from 'next-auth';
import { signIn } from '@/auth';

export type LoginState = { error?: string };

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  try {
    await signIn('credentials', { email, password, redirectTo: '/workspace' });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'No pudimos iniciar sesión. Revisá los datos o verificá tu correo.' };
    }
    throw error;
  }
}
