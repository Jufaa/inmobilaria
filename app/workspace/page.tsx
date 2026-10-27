import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Building2, Layers3, MapPinned, Plus } from 'lucide-react';
import { getCurrentUserMemberships } from '@/lib/agency-access';
import { prisma } from '@/lib/prisma';
import { GoogleSignOut } from '@/components/auth/GoogleSignOut';
import styles from './workspace.module.css';

export default async function WorkspacePage() {
  const { user, memberships, isPlatformOwner } = await getCurrentUserMemberships();
  if (!isPlatformOwner && memberships.length === 1 && ['OWNER', 'ADMIN', 'EDITOR'].includes(memberships[0].role)) {
    redirect(`/inmobiliaria/${encodeURIComponent(memberships[0].agency.slug)}/panel`);
  }
  if (memberships.length === 0 && !isPlatformOwner) redirect('/onboarding');
  const agencies = isPlatformOwner
    ? (await prisma.agency.findMany({ orderBy: { name: 'asc' } })).map((agency) => ({ agency, role: 'OWNER' as const }))
    : memberships;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Territorio, inicio">
          <span className={styles.brandMark}><MapPinned size={19} /></span>
          <span>territorio<span>.</span></span>
        </Link>
        <div className={styles.account}>
          <span className={styles.email}>{user.email}</span>
          <GoogleSignOut />
        </div>
      </header>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>{isPlatformOwner ? 'Administración de Territorio' : 'Tu espacio de trabajo'}</p>
        <h1>{isPlatformOwner ? 'Inmobiliarias' : 'Elegí tu inmobiliaria'}</h1>
        <p>{isPlatformOwner ? 'Entrá al mapa de cualquier inmobiliaria o revisá los espacios compartidos.' : 'Abrí un espacio para ver su mapa, propiedades y actividad.'}</p>
      </section>
      {isPlatformOwner && <>
        <aside className={styles.ownerBanner}>
          <span className={styles.ownerIcon}><Building2 size={19} /></span>
          <p><strong>Acceso global</strong><span>Podés observar todas las inmobiliarias y abrir sus espacios.</span></p>
        </aside>
        <nav className={styles.ownerActions} aria-label="Acciones de administración">
          <Link className={styles.createLink} href="/onboarding"><Plus size={17} /> Crear inmobiliaria</Link>
          <Link className={styles.sharedLink} href="/compartido"><Layers3 size={17} /> Mapas compartidos <ArrowRight size={15} /></Link>
        </nav>
      </>}
      <section className={styles.agenciesSection} aria-label="Inmobiliarias disponibles">
        <div className={styles.sectionHeading}>
          <h2>{isPlatformOwner ? 'Todos los espacios' : 'Tus espacios'}</h2>
          <span>{agencies.length} {agencies.length === 1 ? 'inmobiliaria' : 'inmobiliarias'}</span>
        </div>
        {agencies.length > 0 ? <ul className={styles.list}>
          {agencies.map(({ agency, role }) => (
            <li className={styles.agencyCard} key={agency.id}>
              <span className={styles.agencyIcon}><Building2 size={20} /></span>
              <div className={styles.agencyInfo}>
                <strong>{agency.name}</strong>
                <span>{isPlatformOwner ? 'Administración global' : `Rol · ${role.toLowerCase()}`}</span>
              </div>
              {role !== 'AGENT'
                ? <Link className={styles.openLink} href={`/inmobiliaria/${encodeURIComponent(agency.slug)}/panel`}>Abrir espacio <ArrowRight size={16} /></Link>
                : <span className={styles.accessNote}>Pedile acceso a una persona administradora.</span>}
            </li>
          ))}
        </ul> : <div className={styles.emptyState}><strong>Todavía no hay inmobiliarias</strong><span>Creá un espacio para empezar a cargar propiedades y explorar su mapa.</span><Link className={styles.createLink} href="/onboarding"><Plus size={17} /> Crear inmobiliaria</Link></div>}
      </section>
    </main>
  );
}
