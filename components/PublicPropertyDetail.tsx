import Link from 'next/link';
import type { PublicPropertyDetails } from '@/lib/properties/public-inquiry-service';
import { PublicPropertyInquiryForm } from './PublicPropertyInquiryForm';
import styles from './public-property-detail.module.css';
import { PublicAnalyticsEvent } from './PublicAnalyticsEvent';

const typeLabels: Record<string, string> = {
  APARTMENT: 'Departamento', HOUSE: 'Casa', PH: 'PH', LAND: 'Terreno',
  COMMERCIAL: 'Comercial', OTHER: 'Otro',
};

function formatPrice(value: number, currency: string) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(value);
}

export function PublicPropertyDetail({ property }: { property: PublicPropertyDetails }) {
  const backHref = property.presentingAgencySlug
    ? `/explorar-propiedades?inmobiliaria=${encodeURIComponent(property.presentingAgencySlug)}`
    : '/explorar-propiedades';
  return (
    <main className={styles.page}>
      <PublicAnalyticsEvent payload={{ type: 'PROPERTY_VIEW', propertyId: property.id, ...(property.presentingAgencySlug ? { presentingAgencySlug: property.presentingAgencySlug } : {}) }} />
      <header className={styles.header}>
          <Link className={styles.brand} href={backHref}>← Volver a propiedades</Link>
        <span className={styles.brandName}><span aria-hidden="true">T</span> territorio</span>
      </header>
      <div className={styles.layout}>
        <article className={styles.content}>
          <div className={styles.mediaPlaceholder} aria-label="Galería de imágenes no disponible todavía">
            <span>Presentación visual próximamente</span>
          </div>
          <p className={styles.eyebrow}>{property.operation === 'SALE' ? 'En venta' : 'En alquiler'} · {typeLabels[property.type] ?? 'Propiedad'}</p>
          <h1>{property.title}</h1>
          <p className={styles.location}>{property.neighborhood}</p>
          <p className={styles.price}>{formatPrice(property.price, property.currency)}</p>
          <div className={styles.facts}>
            <span>{property.area} m²</span>
            <span>{property.bedrooms} dormitorios</span>
            <span>{property.bathrooms} baños</span>
          </div>
          {property.description && <section className={styles.section}><h2>Sobre la propiedad</h2><p>{property.description}</p></section>}
          {property.features.length > 0 && (
            <section className={styles.section}>
              <h2>Características</h2>
              <ul className={styles.features}>{property.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
            </section>
          )}
          <p className={styles.agency}>
            {property.presentingAgencySlug && property.presentingAgencyName !== property.agencyName
              ? `Presenta ${property.presentingAgencyName} · Titular ${property.agencyName}`
              : `Publica ${property.agencyName}`}
          </p>
          <p className={styles.locationPrivacy}>La ubicación se muestra por barrio para proteger la privacidad del inmueble.</p>
        </article>
        <aside className={styles.contact}>
          <PublicPropertyInquiryForm propertyId={property.id} presentingAgencySlug={property.presentingAgencySlug} />
        </aside>
      </div>
      <footer className={styles.footer}>Territorio · Río Cuarto</footer>
    </main>
  );
}
