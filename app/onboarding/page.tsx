import { createAgency } from './actions';
import { getCurrentUserMemberships } from '@/lib/agency-access';
import { redirect } from 'next/navigation';
import styles from './onboarding.module.css';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { user, memberships, isPlatformOwner } = await getCurrentUserMemberships();
  if (memberships.length && !isPlatformOwner) redirect('/workspace');
  const { error } = await searchParams;

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Primer paso</p>
        <h1>Creá el espacio de tu inmobiliaria</h1>
        <p>{isPlatformOwner
          ? `La cuenta ${user.email} tiene acceso global y podrá administrar esta inmobiliaria junto con las demás.`
          : `La cuenta ${user.email} quedará como propietaria y podrá invitar al equipo más adelante.`}</p>
        {error === 'invalid-name' && <p className={styles.error} role="alert">El nombre debe tener entre 2 y 120 caracteres.</p>}
        <form action={createAgency}>
          <label htmlFor="agency-name">Nombre de la inmobiliaria</label>
          <input id="agency-name" name="name" autoComplete="organization" minLength={2} maxLength={120} required />
          <button type="submit">Crear inmobiliaria</button>
        </form>
      </section>
    </main>
  );
}
