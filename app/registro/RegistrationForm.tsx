'use client';

import { useActionState } from 'react';
import { registerAction } from './actions';
import styles from './form.module.css';

export function RegistrationForm() {
  const [state, action, pending] = useActionState(registerAction, {});
  return (
    <form action={action} className={styles.form}>
      <label>Nombre<input autoComplete="name" name="name" required minLength={2} maxLength={120} /></label>
      <label>Correo electrónico<input autoComplete="email" name="email" required type="email" maxLength={254} /></label>
      <label>Contraseña<input autoComplete="new-password" name="password" required type="password" minLength={12} maxLength={128} /></label>
      <small>Usá al menos 12 caracteres.</small>
      <label>Confirmar contraseña<input autoComplete="new-password" name="confirmation" required type="password" minLength={12} maxLength={128} /></label>
      {state.error && <p className={styles.error} role="alert">{state.error}</p>}
      {state.message && <p className={styles.success} role="status">{state.message}</p>}
      {state.verificationUrl && <p className={styles.localLink}><a href={state.verificationUrl}>Verificar correo localmente</a></p>}
      <button disabled={pending} type="submit">{pending ? 'Creando cuenta…' : 'Crear cuenta'}</button>
    </form>
  );
}
