'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import type {
  PublicPropertyDiscoveryResult,
} from '@/lib/properties/public-property-service';
import styles from './public-property-discovery.module.css';
import { trackPublicAnalytics, PublicAnalyticsEvent } from './PublicAnalyticsEvent';

const PublicPropertyMap = dynamic(
  () => import('./PublicPropertyMap'),
  {
    ssr: false,
    loading: () => <div className={styles.mapPlaceholder}>Preparando el mapa…</div>,
  },
);

const operationLabels = { SALE: 'Venta', RENT: 'Alquiler' } as const;
const typeLabels = {
  APARTMENT: 'Departamento',
  HOUSE: 'Casa',
  PH: 'PH',
  LAND: 'Terreno',
  COMMERCIAL: 'Comercial',
  OTHER: 'Otro',
} as const;

function formatPrice(value: number, currency: string) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function PublicPropertyDiscovery({
  result,
  filters,
}: {
  result: PublicPropertyDiscoveryResult;
  filters: {
    operation: string;
    type: string;
    currency: string;
    neighborhood: string;
    zoneId: string;
    minPrice: string;
    maxPrice: string;
    minBedrooms: string;
    agencySlug: string;
  };
}) {
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const query = new URLSearchParams();
  if (filters.operation) query.set('operacion', filters.operation);
  if (filters.type) query.set('tipo', filters.type);
  if (filters.currency) query.set('moneda', filters.currency);
  if (filters.neighborhood) query.set('barrio', filters.neighborhood);
  if (filters.zoneId) query.set('zona', filters.zoneId);
  if (filters.minPrice) query.set('desde', filters.minPrice);
  if (filters.maxPrice) query.set('hasta', filters.maxPrice);
  if (filters.minBedrooms) query.set('dormitorios', filters.minBedrooms);
  if (filters.agencySlug) query.set('inmobiliaria', filters.agencySlug);

  const pageHref = (page: number) => {
    const next = new URLSearchParams(query);
    next.set('pagina', String(page));
    return `/explorar-propiedades?${next.toString()}`;
  };

  function trackSearch(event: React.FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const operation = String(form.get('operacion') ?? '');
    const propertyType = String(form.get('tipo') ?? '');
    const currency = String(form.get('moneda') ?? '');
    const zoneId = String(form.get('zona') ?? '');
    const neighborhood = String(form.get('barrio') ?? '');
    const agencySlug = String(form.get('inmobiliaria') ?? '');
    const bedroomsFrom = Number(form.get('dormitorios'));
    trackPublicAnalytics({
      type: 'SEARCH',
      ...(agencySlug ? { presentingAgencySlug: agencySlug } : {}),
      ...(operation ? { operation } : {}),
      ...(propertyType ? { propertyType } : {}),
      ...(currency ? { currency } : {}),
      ...(zoneId ? { zoneId } : {}),
      ...(neighborhood ? { neighborhood } : {}),
      ...(Number.isInteger(bedroomsFrom) && bedroomsFrom >= 0 ? { bedroomsFrom } : {}),
    });
  }

  return (
    <main className={styles.page}>
      <PublicAnalyticsEvent payload={{
        type: 'LISTING_VIEW',
        ...(filters.agencySlug ? { presentingAgencySlug: filters.agencySlug } : {}),
        propertyIds: result.properties.map((property) => property.id),
      }} />
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Territorio, inicio">
          <span className={styles.brandMark} aria-hidden="true">T</span>
          <span>territorio</span>
        </a>
        <div className={styles.headerCopy}>
          <p className={styles.eyebrow}>Exploración inmobiliaria</p>
          <h1>{result.agencyContext ? `Catálogo de ${result.agencyContext.name} y su red` : 'Encontrá tu lugar'}</h1>
          <p>{result.agencyContext ? 'Propiedades propias y publicadas por inmobiliarias asociadas con permiso activo.' : 'Propiedades publicadas por inmobiliarias de la red.'}</p>
        </div>
      </header>

      <section className={styles.filtersSection} aria-label="Filtros de búsqueda">
        <form className={styles.filters} action="/explorar-propiedades" onSubmit={trackSearch}>
          <label>
            Inmobiliaria
            <select name="inmobiliaria" defaultValue={filters.agencySlug}>
              <option value="">Todas las inmobiliarias</option>
              {filters.agencySlug && !result.agencies.some((agency) => agency.slug === filters.agencySlug) && (
                <option value={filters.agencySlug}>Inmobiliaria no encontrada</option>
              )}
              {result.agencies.map((agency) => (
                <option key={agency.slug} value={agency.slug}>{agency.name}</option>
              ))}
            </select>
          </label>
          <label>
            Operación
            <select name="operacion" defaultValue={filters.operation}>
              <option value="">Todas</option>
              <option value="SALE">Venta</option>
              <option value="RENT">Alquiler</option>
            </select>
          </label>
          <label>
            Tipo
            <select name="tipo" defaultValue={filters.type}>
              <option value="">Todos</option>
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Barrio
            <select name="barrio" defaultValue={filters.neighborhood}>
              <option value="">Todos los barrios</option>
              {result.neighborhoods.map((neighborhood) => (
                <option key={neighborhood} value={neighborhood}>{neighborhood}</option>
              ))}
            </select>
          </label>
          <label>
            Zona del mapa
            <select
              name="zona"
              defaultValue={filters.zoneId}
              onChange={(event) => {
                if (event.currentTarget.value) {
                  trackPublicAnalytics({ type: 'ZONE_SELECTION', zoneId: event.currentTarget.value, ...(filters.agencySlug ? { presentingAgencySlug: filters.agencySlug } : {}) });
                }
              }}
            >
              <option value="">Todas las zonas</option>
              {result.zones.map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.name} · {zone.city}</option>
              ))}
            </select>
          </label>
          <label>
            Moneda
            <select name="moneda" defaultValue={filters.currency}>
              <option value="">Cualquiera</option>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </label>
          <label>
            Precio desde
            <input name="desde" type="number" min="0" step="1" inputMode="numeric" defaultValue={filters.minPrice} />
          </label>
          <label>
            Precio hasta
            <input name="hasta" type="number" min="0" step="1" inputMode="numeric" defaultValue={filters.maxPrice} />
          </label>
          <label>
            Dormitorios desde
            <select name="dormitorios" defaultValue={filters.minBedrooms}>
              <option value="">Cualquiera</option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>{value}{value === 5 ? '+' : ''}</option>
              ))}
            </select>
          </label>
          <button className={styles.submit} type="submit">Aplicar filtros</button>
          <a className={styles.clear} href={filters.agencySlug ? `/explorar-propiedades?inmobiliaria=${encodeURIComponent(filters.agencySlug)}` : '/explorar-propiedades'}>Limpiar</a>
        </form>
      </section>

      {!result.available && (
        <div className={styles.notice} role="status">
          El catálogo público todavía no está disponible. Se habilitará cuando la base de datos esté configurada.
        </div>
      )}

      <section className={styles.results} aria-label="Propiedades disponibles">
        <div className={styles.resultsHeader}>
          <div>
            <p className={styles.eyebrow}>Catálogo de la red</p>
            <h2>{result.total} {result.total === 1 ? 'propiedad' : 'propiedades'}</h2>
          </div>
          {result.total > 0 && <p>Página {result.page} de {pages}</p>}
        </div>

        <div className={styles.discoveryGrid}>
          <div className={styles.mapPanel}>
            <PublicPropertyMap properties={result.properties} zones={result.zones} pointsOfInterest={result.pointsOfInterest} selectedZoneId={filters.zoneId} presentingAgencySlug={filters.agencySlug} />
            <p className={styles.mapCaption}>Las ubicaciones del mapa son aproximadas.</p>
          </div>
          {result.properties.length > 0 ? (
            <div className={styles.listPanel}>
              <div className={styles.cards}>
                {result.properties.map((property) => (
                  <article className={styles.card} key={property.id}>
                    <div className={styles.cardTop}>
                      <span className={styles.operation}>{operationLabels[property.operation]}</span>
                      <strong>{formatPrice(property.price, property.currency)}</strong>
                    </div>
                    <h3>{property.title}</h3>
                    <p className={styles.location}>{property.neighborhood}</p>
                    <p className={styles.facts}>
                      {typeLabels[property.type]} <span>·</span> {property.area} m² <span>·</span> {property.bedrooms} dorm. <span>·</span> {property.bathrooms} baños
                    </p>
                    {property.description && <p className={styles.description}>{property.description}</p>}
                    <p className={styles.agency}>{property.presentedByName ? `Presenta ${property.presentedByName} · Titular ${property.agencyName}` : `Publica ${property.agencyName}`}</p>
                    <Link className={styles.cardLink} href={`/explorar-propiedades/${encodeURIComponent(property.id)}${filters.agencySlug ? `?inmobiliaria=${encodeURIComponent(filters.agencySlug)}` : ''}`}>
                      Ver detalle y consultar →
                    </Link>
                  </article>
                ))}
              </div>
              {pages > 1 && (
                <nav className={styles.pagination} aria-label="Paginación">
                  {result.page > 1 && <a href={pageHref(result.page - 1)}>← Anterior</a>}
                  {result.page < pages && <a href={pageHref(result.page + 1)}>Siguiente →</a>}
                </nav>
              )}
            </div>
          ) : (
            <div className={styles.empty}>
              <span aria-hidden="true">⌕</span>
              <h3>{result.available ? 'Todavía no hay coincidencias' : 'Sin propiedades para mostrar'}</h3>
              <p>{result.available ? 'Probá cambiar los filtros para ampliar la búsqueda.' : 'Cuando haya fichas publicadas, vas a poder explorarlas desde acá.'}</p>
            </div>
          )}
        </div>
      </section>

      <footer className={styles.footer}>
        <p>La ubicación se muestra por barrio. Las fotografías y los recorridos virtuales se incorporarán en próximas etapas.</p>
        <span>Territorio · Río Cuarto</span>
      </footer>
    </main>
  );
}
