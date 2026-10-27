import { signIn } from '@/auth';
import { readDemoAccessConfig } from '@/lib/auth/demo-access';
import { LoginForm } from './LoginForm';
import styles from './login.module.css';

export default function LoginPage() {
  const demoAccess = readDemoAccessConfig();
  const isDevelopment = process.env.NODE_ENV === 'development';
  const hasGoogle = !demoAccess && Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

  async function demoLoginAction(formData: FormData) {
    'use server';
    await signIn('credentials', {
      username: formData.get('username'),
      password: formData.get('password'),
      redirectTo: '/workspace',
    });
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Territorio · Espacio inmobiliario</p>
        <h1>Ingresá a tu inmobiliaria</h1>
        <p>{demoAccess ? 'Ingresá con el acceso de demostración.' : 'Accedé con tu correo y contraseña o continuá con Google.'}</p>
        <LoginForm demoMode={Boolean(demoAccess)} demoAction={demoAccess ? demoLoginAction : undefined} />
        {!demoAccess && <p className={styles.linkLine}>¿Todavía no tenés cuenta? <a href="/registro">Crear cuenta</a></p>}
        {hasGoogle && <>
          <div className={styles.divider}><span>o</span></div>
          <form action={async () => {
            'use server';
            await signIn('google', { redirectTo: '/workspace' });
          }}>
            <button className={styles.button} type="submit"><span aria-hidden="true">G</span>Continuar con Google</button>
          </form>
          <small>Google solo permite ingresar con correos verificados.</small>
        </>}
        {!demoAccess && isDevelopment && <div className={styles.localForm}>
          <h2>Acceso local de desarrollo</h2>
          <form action={async (formData) => {
            'use server';
            await signIn('credentials', {
              username: formData.get('username'),
              password: formData.get('password'),
              redirectTo: '/workspace',
            });
          }}>
            <label>Usuario<input autoComplete="username" name="username" required /></label>
            <label>Contraseña<input autoComplete="current-password" name="password" required type="password" /></label>
            <button className={styles.button} type="submit">Ingresar como administrador local</button>
            <small>Solo disponible en desarrollo. Usuario: admin.</small>
          </form>
        </div>}
      </section>
    </main>
  );
}
