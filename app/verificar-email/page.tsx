import styles from './verification.module.css';
import { VerificationForm } from './VerificationForm';

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : '';
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Territorio · Espacio inmobiliario</p>
        <h1>Verificar correo</h1>
        <VerificationForm token={token} />
      </section>
    </main>
  );
}
