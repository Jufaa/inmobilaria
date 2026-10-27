import Link from 'next/link';
import { RegistrationForm } from './RegistrationForm';
import styles from './form.module.css';
import { isDemoAccessEnabled } from '@/lib/auth/demo-access';

export default function RegistrationPage() {
  if (isDemoAccessEnabled()) {
    return <main className={styles.page}><section className={styles.card}>
      <p className={styles.eyebrow}>Territorio · Espacio inmobiliario</p>
      <h1>Registro deshabilitado</h1>
      <p>El acceso de demostración usa una cuenta previamente configurada.</p>
      <Link href="/login">Ingresar a la demo</Link>
    </section></main>;
  }
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Territorio · Espacio inmobiliario</p>
        <h1>Crear cuenta</h1>
        <p>Registrate con tu correo y verificá la dirección antes de iniciar sesión.</p>
        <RegistrationForm />
        <p className={styles.footer}>¿Ya tenés cuenta? <Link href="/login">Ingresar</Link></p>
      </section>
    </main>
  );
}
