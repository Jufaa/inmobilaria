'use client';

import { useActionState } from 'react';
import { loginAction } from './actions';
import styles from './login.module.css';

export function LoginForm({ demoMode = false, demoAction }: { demoMode?: boolean; demoAction?: (formData: FormData) => void | Promise<void> }) {
  const [state, action, pending] = useActionState(loginAction, {});
  if (demoMode) {
    return <form action={demoAction} className={styles.form}>
      <label>Usuario<input autoComplete="username" name="username" required /></label>
      <label>Contraseña<input autoComplete="current-password" name="password" required type="password" maxLength={128} /></label>
      <button className={styles.button} disabled={pending} type="submit">Ingresar a la demo</button>
    </form>;
  }
  return (
    <form action={action} className={styles.form}>
      <label>Correo electrónico<input autoComplete="email" name="email" required type="email" maxLength={254} /></label>
      <label>Contraseña<input autoComplete="current-password" name="password" required type="password" maxLength={128} /></label>
      {state.error && <p className={styles.error} role="alert">{state.error}</p>}
      <button className={styles.button} disabled={pending} type="submit">{pending ? 'Ingresando…' : 'Ingresar'}</button>
    </form>
  );
}
