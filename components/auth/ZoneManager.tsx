'use client';

import { useActionState } from 'react';
import {
  assignPropertyZoneAction,
  createPointOfInterestAction,
  createZoneAction,
  deletePointOfInterestAction,
  deleteZoneAction,
  updateZoneAction,
  updatePointOfInterestAction,
  type ZoneActionState,
} from '@/app/inmobiliaria/[agencyId]/panel/zonas/actions';
import { pointOfInterestCategories } from '@/lib/zones/zone-constants';
import styles from './zone-manager.module.css';

type Zone = { id: string; name: string; city: string; geometry: unknown; latitude: number | null; longitude: number | null };
type Property = { id: string; title: string; neighborhood: string; zoneId: string | null };
type Point = { id: string; name: string; category: string; description: string | null; latitude: number; longitude: number; zone: { id: string; name: string } | null };
const initial: ZoneActionState = {};
const categoryLabels: Record<(typeof pointOfInterestCategories)[number], string> = {
  PARK: 'Plaza o parque', AVENUE: 'Avenida', SCHOOL: 'Escuela', SHOPPING: 'Centro comercial',
  HOSPITAL: 'Hospital', LANDMARK: 'Lugar destacado', OTHER: 'Otro',
};

function Feedback({ state }: { state: ZoneActionState }) {
  return state.error ? <p className={styles.error} role="alert">{state.error}</p>
    : state.success ? <p className={styles.success} role="status">{state.success}</p> : null;
}

function ZoneForm({ slug }: { slug: string }) {
  const action = createZoneAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, initial);
  return <form action={formAction} className={styles.form}>
    <h2>Agregar barrio o zona</h2>
    <div className={styles.fields}>
      <label>Nombre<input name="name" required minLength={2} maxLength={120} /></label>
      <label>Ciudad<input name="city" defaultValue="Río Cuarto" maxLength={120} /></label>
      <label>Latitud del centro (opcional)<input name="latitude" type="number" min="-90" max="90" step="any" /></label>
      <label>Longitud del centro (opcional)<input name="longitude" type="number" min="-180" max="180" step="any" /></label>
      <label className={styles.wide}>Límite GeoJSON Polygon/MultiPolygon (opcional)<textarea name="geometry" rows={3} maxLength={100000} placeholder='{"type":"Polygon","coordinates":[...]}' /></label>
    </div>
    <p className={styles.hint}>Si no hay un límite geográfico confirmado, dejalo vacío: el barrio igual queda disponible como filtro de lista.</p>
    <Feedback state={state} />
    <button disabled={pending}>{pending ? 'Guardando…' : 'Guardar barrio'}</button>
  </form>;
}

function EditZoneForm({ slug, zone }: { slug: string; zone: Zone }) {
  const action = updateZoneAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, initial);
  return <details className={styles.edit}>
    <summary>Editar zona</summary>
    <form action={formAction} className={styles.editForm}>
      <input type="hidden" name="zoneId" value={zone.id} />
      <label>Nombre<input name="name" required minLength={2} maxLength={120} defaultValue={zone.name} /></label>
      <label>Ciudad<input name="city" maxLength={120} defaultValue={zone.city} /></label>
      <label>Latitud<input name="latitude" type="number" min="-90" max="90" step="any" defaultValue={zone.latitude ?? ''} /></label>
      <label>Longitud<input name="longitude" type="number" min="-180" max="180" step="any" defaultValue={zone.longitude ?? ''} /></label>
      <label className={styles.wide}>Límite GeoJSON (opcional)<textarea name="geometry" rows={3} maxLength={100000} defaultValue={zone.geometry ? JSON.stringify(zone.geometry) : ''} /></label>
      <Feedback state={state} />
      <button disabled={pending}>{pending ? 'Guardando…' : 'Guardar cambios'}</button>
    </form>
  </details>;
}

function PointForm({ slug, zones }: { slug: string; zones: Zone[] }) {
  const action = createPointOfInterestAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, initial);
  return <form action={formAction} className={styles.form}>
    <h2>Agregar punto de interés</h2>
    <div className={styles.fields}>
      <label>Nombre<input name="name" required minLength={2} maxLength={120} /></label>
      <label>Categoría<select name="category">{pointOfInterestCategories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}</select></label>
      <label>Barrio (opcional)<select name="zoneId"><option value="">Toda la ciudad</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} · {zone.city}</option>)}</select></label>
      <label>Latitud<input name="latitude" required type="number" min="-90" max="90" step="any" /></label>
      <label>Longitud<input name="longitude" required type="number" min="-180" max="180" step="any" /></label>
      <label className={styles.wide}>Descripción (opcional)<input name="description" maxLength={500} /></label>
    </div>
    <Feedback state={state} />
    <button disabled={pending}>{pending ? 'Guardando…' : 'Guardar punto'}</button>
  </form>;
}

function PropertyZoneForm({ slug, property, zones }: { slug: string; property: Property; zones: Zone[] }) {
  const action = assignPropertyZoneAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, initial);
  return <form className={styles.assignment} action={formAction}>
    <input type="hidden" name="propertyId" value={property.id} />
    <span>{property.title} <small>({property.neighborhood})</small></span>
    <select name="zoneId" defaultValue={property.zoneId ?? ''} aria-label={`Barrio para ${property.title}`}>
      <option value="">Sin asignar</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} · {zone.city}</option>)}
    </select>
    <button disabled={pending}>{pending ? 'Guardando…' : 'Asignar'}</button>
    <Feedback state={state} />
  </form>;
}

function EditPointForm({ slug, point, zones }: { slug: string; point: Point; zones: Zone[] }) {
  const action = updatePointOfInterestAction.bind(null, slug);
  const [state, formAction, pending] = useActionState(action, initial);
  return <details className={styles.edit}>
    <summary>Editar punto</summary>
    <form action={formAction} className={styles.editForm}>
      <input type="hidden" name="pointId" value={point.id} />
      <label>Nombre<input name="name" required minLength={2} maxLength={120} defaultValue={point.name} /></label>
      <label>Categoría<select name="category" defaultValue={point.category}>{pointOfInterestCategories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}</select></label>
      <label>Barrio<select name="zoneId" defaultValue={point.zone?.id ?? ''}><option value="">Toda la ciudad</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} · {zone.city}</option>)}</select></label>
      <label>Latitud<input name="latitude" required type="number" min="-90" max="90" step="any" defaultValue={point.latitude} /></label>
      <label>Longitud<input name="longitude" required type="number" min="-180" max="180" step="any" defaultValue={point.longitude} /></label>
      <label className={styles.wide}>Descripción<input name="description" maxLength={500} defaultValue={point.description ?? ''} /></label>
      <Feedback state={state} />
      <button disabled={pending}>{pending ? 'Guardando…' : 'Guardar cambios'}</button>
    </form>
  </details>;
}

export function ZoneManager({ slug, zones, properties, points }: { slug: string; zones: Zone[]; properties: Property[]; points: Point[] }) {
  const deleteZone = deleteZoneAction.bind(null, slug);
  const deletePoint = deletePointOfInterestAction.bind(null, slug);
  return <main className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Mapa inmobiliario</p><h1>Barrios y puntos de interés</h1><p>Organizá las zonas de tu inmobiliaria. El catálogo público usa los barrios como filtro y muestra límites o referencias cuando están cargados.</p></div><span className={styles.count}>{zones.length} zonas</span></header>
    <div className={styles.note}>No se precargaron límites ni puntos de interés oficiales. Los límites son opcionales; mientras estén vacíos, los barrios funcionan como filtros de lista.</div>
    <div className={styles.forms}><ZoneForm slug={slug} /><PointForm slug={slug} zones={zones} /></div>
    <section className={styles.section}><h2>Vincular propiedades</h2><p>La relación se guarda en esta inmobiliaria y sincroniza el nombre del barrio de la ficha para mantener el catálogo compatible.</p>
      {properties.length ? properties.map((property) => <PropertyZoneForm key={property.id} slug={slug} property={property} zones={zones} />) : <p>Todavía no hay propiedades cargadas.</p>}
    </section>
    <section className={styles.section}><h2>Zonas guardadas</h2>{zones.length ? <div className={styles.cards}>{zones.map((zone) => <article className={styles.card} key={zone.id}>
      <div><h3>{zone.name}</h3><p>{zone.city} · {zone.geometry ? 'Límite cargado' : 'Sin límite geográfico'}</p><EditZoneForm slug={slug} zone={zone} /></div>
      <form action={deleteZone}><input type="hidden" name="zoneId" value={zone.id} /><button className={styles.danger}>Eliminar zona</button></form>
    </article>)}</div> : <p>Aún no se agregaron zonas.</p>}</section>
    <section className={styles.section}><h2>Puntos de interés</h2>{points.length ? <div className={styles.cards}>{points.map((point) => <article className={styles.card} key={point.id}>
      <div><h3>{point.name}</h3><p>{categoryLabels[point.category as keyof typeof categoryLabels] ?? 'Otro'} · {point.zone?.name ?? 'Toda la ciudad'}</p><EditPointForm slug={slug} point={point} zones={zones} /></div>
      <form action={deletePoint}><input type="hidden" name="pointId" value={point.id} /><button className={styles.danger}>Eliminar punto</button></form>
    </article>)}</div> : <p>Aún no se agregaron puntos de interés.</p>}</section>
  </main>;
}
