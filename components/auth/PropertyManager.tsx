'use client';

import { useActionState, useState } from 'react';
import {
  createPropertyAction,
  updatePropertyAction,
  updatePropertyAvailabilityAction,
  type PropertyActionState,
} from '@/app/inmobiliaria/[agencyId]/panel/actions';
import type { AgencyPropertyRecord } from '@/lib/properties/agency-property-service';
import styles from './property-manager.module.css';

const emptyState: PropertyActionState = {};
const types = [
  ['APARTMENT', 'Departamento'],
  ['HOUSE', 'Casa'],
  ['PH', 'PH'],
  ['LAND', 'Terreno'],
  ['COMMERCIAL', 'Comercial'],
  ['OTHER', 'Otro'],
] as const;
const statuses = [
  ['DRAFT', 'Borrador'],
  ['PUBLISHED', 'Publicada'],
  ['RESERVED', 'Reservada'],
  ['SOLD', 'Vendida'],
  ['UNAVAILABLE', 'No disponible'],
] as const;
const statusLabel = Object.fromEntries(statuses) as Record<string, string>;

function Feedback({ state }: { state: PropertyActionState }) {
  if (state.error) return <p className={styles.error} role="alert">{state.error}</p>;
  if (state.success) return <p className={styles.success} role="status">{state.success}</p>;
  return null;
}

function PropertyForm({
  agencySlug,
  property,
  onCancel,
}: {
  agencySlug: string;
  property?: AgencyPropertyRecord;
  onCancel?: () => void;
}) {
  const action = property
    ? updatePropertyAction.bind(null, agencySlug)
    : createPropertyAction.bind(null, agencySlug);
  const [state, formAction, pending] = useActionState(action, emptyState);

  return (
    <form action={formAction} className={styles.form}>
      {property && <input type="hidden" name="propertyId" value={property.id} />}
      <div className={styles.formHeading}>
        <div>
          <p className={styles.eyebrow}>{property ? 'Editar ficha' : 'Nueva ficha'}</p>
          <h2>{property ? property.title : 'Cargar propiedad'}</h2>
        </div>
        {onCancel && <button type="button" className={styles.textButton} onClick={onCancel}>Cancelar</button>}
      </div>
      <div className={styles.fields}>
        <label className={styles.wide}>Título<input name="title" required minLength={3} maxLength={160} defaultValue={property?.title} /></label>
        <label>Tipo<select name="type" defaultValue={property?.type ?? 'APARTMENT'}>{types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Operación<select name="operation" defaultValue={property?.operation ?? 'SALE'}><option value="SALE">Venta</option><option value="RENT">Alquiler</option></select></label>
        <label>Precio<input name="price" type="number" min="0" step="0.01" required defaultValue={property?.price} /></label>
        <label>Moneda<select name="currency" defaultValue={property?.currency ?? 'USD'}><option value="USD">USD</option><option value="ARS">ARS</option></select></label>
        <label>Barrio<input name="neighborhood" maxLength={120} required defaultValue={property?.neighborhood} /></label>
        <label className={styles.wide}>Dirección<input name="address" maxLength={240} required defaultValue={property?.address} /></label>
        <label>Superficie (m²)<input name="area" type="number" min="0.01" step="0.01" required defaultValue={property?.area} /></label>
        <label>Dormitorios<input name="bedrooms" type="number" min="0" max="50" step="1" required defaultValue={property?.bedrooms ?? 0} /></label>
        <label>Baños<input name="bathrooms" type="number" min="0" max="50" step="1" required defaultValue={property?.bathrooms ?? 0} /></label>
        <label>Estado<select name="status" defaultValue={property?.status ?? 'DRAFT'}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Latitud<input name="latitude" type="number" min="-90" max="90" step="any" defaultValue={property?.latitude ?? ''} /></label>
        <label>Longitud<input name="longitude" type="number" min="-180" max="180" step="any" defaultValue={property?.longitude ?? ''} /></label>
        <label className={styles.wide}>Características <span>(separadas por coma)</span><input name="features" maxLength={2500} defaultValue={property?.features.join(', ')} /></label>
        <label className={styles.wide}>Descripción<textarea name="description" rows={4} maxLength={5000} defaultValue={property?.description} /></label>
      </div>
      <Feedback state={state} />
      <div className={styles.formFooter}>
        <p>Las imágenes, videos y recorridos 360° todavía no se pueden cargar.</p>
        <button className={styles.primaryButton} type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar propiedad'}</button>
      </div>
    </form>
  );
}

function AvailabilityForm({ agencySlug, property }: { agencySlug: string; property: AgencyPropertyRecord }) {
  const action = updatePropertyAvailabilityAction.bind(null, agencySlug);
  const [state, formAction, pending] = useActionState(action, emptyState);
  return (
    <form action={formAction} className={styles.availability}>
      <input type="hidden" name="propertyId" value={property.id} />
      <label>Estado<select name="status" defaultValue={property.status}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className={styles.secondaryButton} type="submit" disabled={pending}>{pending ? 'Actualizando…' : 'Actualizar'}</button>
      <Feedback state={state} />
    </form>
  );
}

export function PropertyManager({
  agencySlug,
  properties,
}: {
  agencySlug: string;
  properties: AgencyPropertyRecord[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingProperty = properties.find((property) => property.id === editingId);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>Catálogo de la inmobiliaria</p><h1>Propiedades</h1><p>Las fichas se guardan en la base de datos y solo son visibles desde esta inmobiliaria.</p></div>
        <span className={styles.count}>{properties.length} {properties.length === 1 ? 'propiedad' : 'propiedades'}</span>
      </header>
      <div className={styles.notice} role="note">
        Este panel administra información persistente. La carga de fotos, videos y recorridos 360° todavía no está disponible; tampoco se publican estas fichas en el sitio público.
      </div>
      {editingProperty ? (
        <PropertyForm agencySlug={agencySlug} property={editingProperty} onCancel={() => setEditingId(null)} />
      ) : (
        <PropertyForm agencySlug={agencySlug} />
      )}
      <section className={styles.list} aria-labelledby="agency-property-list-title">
        <div className={styles.listHeading}><h2 id="agency-property-list-title">Listado</h2><span>Solo datos reales ingresados por tu equipo</span></div>
        {properties.length === 0 ? (
          <p className={styles.empty}>Todavía no hay propiedades guardadas para esta inmobiliaria.</p>
        ) : (
          <div className={styles.cards}>
            {properties.map((property) => (
              <article className={styles.card} key={property.id}>
                <div className={styles.cardTop}>
                  <div><span className={styles.status}>{statusLabel[property.status]}</span><h3>{property.title}</h3><p>{property.neighborhood} · {property.address}</p></div>
                  <strong>{new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(property.price)} {property.currency}</strong>
                </div>
                <p className={styles.facts}>{types.find(([value]) => value === property.type)?.[1]} · {property.operation === 'SALE' ? 'Venta' : 'Alquiler'} · {property.area} m² · {property.bedrooms} dorm. · {property.bathrooms} baños</p>
                {property.description && <p className={styles.description}>{property.description}</p>}
                {property.features.length > 0 && <p className={styles.features}>Características: {property.features.join(', ')}</p>}
                <div className={styles.cardActions}>
                  <button className={styles.secondaryButton} type="button" onClick={() => setEditingId(property.id)}>Editar ficha</button>
                  <AvailabilityForm key={`${property.id}-${property.status}`} agencySlug={agencySlug} property={property} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
