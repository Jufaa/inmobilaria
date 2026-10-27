import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { WorkspaceMapProperty } from '@/components/auth/WorkspacePropertyMap';
import { AgencyPresentationMap } from '@/components/auth/AgencyPresentationMap';
import { GoogleSignOut } from '@/components/auth/GoogleSignOut';
import { getCurrentUserMemberships } from '@/lib/agency-access';
import { prisma } from '@/lib/prisma';
import { defaultPresentationSettings } from '@/lib/agency-presentation';
import { defaultDemoConfig } from '@/lib/property-tour-config';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import shellStyles from '@/components/auth/workspace-shell.module.css';
import styles from './shared.module.css';

export default async function SharedPage() {
  const { user, isPlatformOwner } = await getCurrentUserMemberships();
  if (!isPlatformOwner) redirect('/workspace');

  const connections = await prisma.agencyConnection.findMany({
    where: { status: 'ACCEPTED' },
    include: {
      agencyLow: { select: { id: true, name: true } },
      agencyHigh: { select: { id: true, name: true } },
      shareGrants: {
        where: { active: true, revokedAt: null, property: { status: 'PUBLISHED' } },
        include: {
          property: {
            select: { id: true, title: true, status: true, price: true, currency: true, neighborhood: true, latitude: true, longitude: true },
          },
          ownerAgency: { select: { name: true } },
        },
        orderBy: { grantedAt: 'desc' },
      },
    },
    orderBy: [{ agencyLow: { name: 'asc' } }, { agencyHigh: { name: 'asc' } }],
  });

  const cards = connections.map((connection) => ({
    id: connection.id,
    title: `${connection.agencyLow.name} ↔ ${connection.agencyHigh.name}`,
    properties: connection.shareGrants.map(({ property, ownerAgency }): WorkspaceMapProperty => ({
      id: property.id,
      title: property.title,
      status: property.status,
      price: property.price.toNumber(),
      currency: property.currency as 'ARS' | 'USD',
      neighborhood: property.neighborhood,
      latitude: property.latitude === null ? null : Math.round(property.latitude.toNumber() * 1_000) / 1_000,
      longitude: property.longitude === null ? null : Math.round(property.longitude.toNumber() * 1_000) / 1_000,
      ownerAgency: ownerAgency.name,
    })),
  }));

  return (
    <main className={`${styles.page} ${shellStyles.shell}`}>
      <header className={`${styles.header} ${shellStyles.content}`}>
        <div><p>Vista global de colaboración</p><h1>Compartido</h1><span>Un mapa independiente por cada vínculo aceptado entre inmobiliarias.</span></div>
        <div className={`${styles.actions} ${shellStyles.actions}`}><ThemeToggle /><span>{user.email}</span><Link href="/workspace">Espacios</Link><GoogleSignOut /></div>
      </header>
      {cards.length === 0 ? <p className={styles.empty}>Todavía no hay vínculos aceptados entre inmobiliarias.</p> : (
        <div className={`${styles.cards} ${shellStyles.content}`}>
          {cards.map((card) => (
            <section className={styles.card} key={card.id}>
              <header><h2>{card.title}</h2><p>{card.properties.length} {card.properties.length === 1 ? 'propiedad compartida activa' : 'propiedades compartidas activas'}</p></header>
              <AgencyPresentationMap
                agencyId={`shared-${card.id}`}
                agencyName={card.title}
                title={`Compartido: ${card.title}`}
                properties={card.properties}
                sharedCatalogue
                zones={[]}
                points={[]}
                initialSettings={defaultPresentationSettings}
                initialDemoConfig={defaultDemoConfig}
              />
              {card.properties.length === 0 && <p className={styles.emptyCard}>Este vínculo está aceptado, pero todavía no tiene propiedades compartidas activas.</p>}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
