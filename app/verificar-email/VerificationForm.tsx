'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { verifyEmailAction } from './actions';
import styles from './verification.module.css';

export function VerificationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(verifyEmailAction, {});
  if (state.success) {
    return <div className={styles.result} role="status"><p>Correo verificado. Tu cuenta ya está activa.</p><Link href="/login">Ingresar</Link></div>;
  }
  if (!token) return <p className={styles.error} role="alert">El enlace no es válido o ya venció.</p>;

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="token" value={token} />
      <p>Confirmá tu dirección de correo para activar la cuenta.</p>
      {state.error && <p className={styles.error} role="alert">{state.error}</p>}
      <button disabled={pending} type="submit">{pending ? 'Verificando…' : 'Verificar correo'}</button>
    </form>
  );
}
