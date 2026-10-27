import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import type { getPublicAgencyStorefront } from '@/lib/agencies/public-storefront';
import styles from './agency-storefront.module.css';

type Storefront = NonNullable<Awaited<ReturnType<typeof getPublicAgencyStorefront>>>;

function safeHttpsUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

const typeLabels: Record<string, string> = {
  APARTMENT: 'Departamento', HOUSE: 'Casa', PH: 'PH', LAND: 'Terreno', COMMERCIAL: 'Comercial', OTHER: 'Propiedad',
};

export function AgencyStorefront({ agency }: { agency: Storefront }) {
  const primary = /^#[0-9a-f]{6}$/i.test(agency.brandPrimaryColor ?? '') ? agency.brandPrimaryColor! : '#236b58';
  const coverUrl = safeHttpsUrl(agency.coverUrl);
  const logoUrl = safeHttpsUrl(agency.logoUrl);
  const welcomeUrl = safeHttpsUrl(agency.welcomeVideoUrl);
  const brandStyle = { '--brand-primary': primary } as CSSProperties;

  return (
    <main className={styles.page} style={brandStyle}>
      <header className={styles.topbar}>
        <Link href={`/inmobiliaria/${encodeURIComponent(agency.slug)}`} className={styles.identity}>
          {logoUrl ? <img src={logoUrl} alt="" /> : <span className={styles.logoFallback}>{agency.name.slice(0, 1).toUpperCase()}</span>}
          <strong>{agency.name}</strong>
        </Link>
        <ThemeToggle />
      </header>
      <section className={styles.hero} style={coverUrl ? { backgroundImage: `linear-gradient(90deg, #091b16d9, #091b1638), url("${coverUrl}")` } : undefined}>
        <p>Propiedades seleccionadas</p>
        <h1>{agency.name}</h1>
        <a className={styles.primaryLink} href="#propiedades">Explorar propiedades</a>
          <Link className={styles.primaryLink} href={`/explorar-propiedades?inmobiliaria=${encodeURIComponent(agency.slug)}`}>
            Ver propiedades propias y compartidas
          </Link>
      </section>
      {welcomeUrl && (
        <section className={styles.welcome} aria-label="Presentación de la inmobiliaria">
          <div>
            <h2>Conocé {agency.name}</h2>
            {agency.welcomeVideoDescription && <p>{agency.welcomeVideoDescription}</p>}
          </div>
          <a href={welcomeUrl} target="_blank" rel="noopener noreferrer">Ver presentación en otra pestaña</a>
          <a className={styles.skipLink} href="#propiedades">Saltar presentación</a>
        </section>
      )}
      <section className={styles.catalog} id="propiedades">
        <div className={styles.catalogHeading}>
          <div><p>Catálogo</p><h2>Propiedades disponibles</h2></div>
          <span>{agency.properties.length} {agency.properties.length === 1 ? 'propiedad' : 'propiedades'}</span>
        </div>
        {agency.properties.length === 0 ? (
          <p className={styles.empty}>Esta inmobiliaria todavía no tiene propiedades publicadas.</p>
        ) : (
          <div className={styles.grid}>
            {agency.properties.map((property) => {
              const photoUrl = safeHttpsUrl(property.media[0]?.url ?? null);
              return (
                <article className={styles.card} key={property.id}>
                  {photoUrl ? <img className={styles.photo} src={photoUrl} alt={property.media[0]?.caption || property.title} loading="lazy" /> : <div className={styles.photoFallback} aria-hidden="true">{typeLabels[property.type]}</div>}
                  <div className={styles.cardBody}>
                    <p className={styles.location}>{property.neighborhood} · {typeLabels[property.type]}</p>
                    <h3>{property.title}</h3>
                    <p className={styles.price}>{property.currency} {property.price.toLocaleString('es-AR')} <span>· {property.operation === 'SALE' ? 'Venta' : 'Alquiler'}</span></p>
                    <p className={styles.facts}>{property.area.toLocaleString('es-AR')} m² · {property.bedrooms} dormitorios · {property.bathrooms} baños</p>
                    <Link href={`/explorar-propiedades/${encodeURIComponent(property.id)}`} className={styles.detailLink}>Ver propiedad</Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <footer className={styles.footer}>{agency.name}</footer>
    </main>
  );
}
