'use client';

import { useRef, useState, type FormEvent } from 'react';
import { upload } from '@vercel/blob/client';
import type { AgencyPropertyRecord } from '@/lib/properties/agency-property-service';
import styles from './real-agency-map.module.css';

export type MapPropertyResult = { property?: AgencyPropertyRecord; error?: string };
export function RealMapPropertyForm({ agencySlug, agencyId, position, photosEnabled, onCreate, onSaved, onCancel, initial }: {
  initial?: AgencyPropertyRecord;
  agencySlug: string; agencyId: string; position: [number, number]; photosEnabled: boolean;
  onCreate: (data: FormData) => Promise<MapPropertyResult>;
  onSaved: (property: AgencyPropertyRecord) => void; onCancel: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const uploaded = useRef(new Map<File, string>());
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const data = new FormData(event.currentTarget);
    pending.current = true;
    setBusy(true); setError('');
    try {
      const photoUrls: string[] = [];
      for (const file of files) {
        let url = uploaded.current.get(file);
        if (!url) {
          const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[file.type];
          if (!extension || file.size > 5 * 1024 * 1024) throw new Error('invalid-photo');
          const blob = await upload(`agencies/${agencyId}/${crypto.randomUUID()}.${extension}`, file, {
            access: 'public', handleUploadUrl: `/api/inmobiliaria/${encodeURIComponent(agencySlug)}/photos`,
          });
          url = blob.url; uploaded.current.set(file, url);
        }
        photoUrls.push(url);
      }
      data.set('photoUrls', JSON.stringify(photoUrls));
      const result = await onCreate(data);
      if (!result.property || result.error) { setError(result.error || 'No se pudo guardar la propiedad.'); return; }
      onSaved(result.property);
    } catch { setError('No se pudo completar la carga. Revise la conexión y vuelva a guardar; se conservan los datos.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className={styles.formPanel} aria-label="Agregar propiedad en el punto elegido">
    <h2>{initial ? 'Editar propiedad' : 'Agregar propiedad'}</h2><p>Ubicación elegida en el mapa.</p>
    <form onSubmit={save}>
      <input type="hidden" name="latitude" value={position[1]} /><input type="hidden" name="longitude" value={position[0]} />
      <fieldset disabled={busy} className={styles.fields}>
        <label className={styles.wide}>Título<input name="title" required minLength={3} maxLength={160} placeholder="Casa con patio" defaultValue={initial?.title} /></label>
        <label>Tipo<select name="type" defaultValue={initial?.type ?? 'HOUSE'}><option value="HOUSE">Casa</option><option value="APARTMENT">Departamento</option><option value="PH">PH</option><option value="LAND">Lote</option><option value="COMMERCIAL">Local</option><option value="OTHER">Otro</option></select></label>
        <label>Operación<select name="operation" defaultValue={initial?.operation ?? 'SALE'}><option value="SALE">Venta</option><option value="RENT">Alquiler</option></select></label>
        <label>Precio<input name="price" type="number" min={0} max={999999999999} step="any" required defaultValue={initial?.price} /></label>
        <label>Moneda<select name="currency" defaultValue={initial?.currency ?? 'USD'}><option>USD</option><option>ARS</option></select></label>
        <label>Dirección<input name="address" required maxLength={240} defaultValue={initial?.address} /></label><label>Barrio<input name="neighborhood" required maxLength={120} defaultValue={initial?.neighborhood} /></label>
        <label>Superficie (m²)<input name="area" type="number" min={0.01} max={99999999} step="any" required defaultValue={initial?.area} /></label>
        <label>Estado<select name="status" defaultValue={initial?.status ?? 'DRAFT'}><option value="DRAFT">Borrador · no publicar</option><option value="PUBLISHED">Publicar en el catálogo</option><option value="RESERVED">Reservada</option><option value="SOLD">Vendida</option><option value="UNAVAILABLE">No disponible</option></select></label>
        {initial && initial.media.filter(item => item.kind === 'PHOTO').length > 0 && <p className={styles.wide}>Se conservan las {initial.media.filter(item => item.kind === 'PHOTO').length} fotos existentes. Puede agregar otras, hasta un total de 6.</p>}
        <label className={styles.wide}>Fotos<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!photosEnabled} onChange={event => {
          const selected = Array.from(event.target.files ?? []); event.target.value = '';
          if (selected.some(file => !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) || files.length + selected.length + (initial?.media.filter(item => item.kind === 'PHOTO').length ?? 0) > 6) { setError('Seleccione hasta 6 fotos JPEG, PNG o WebP, de hasta 5 MB cada una.'); return; }
          setFiles(current => [...current, ...selected]); setError('');
        }} /></label>
        <p className={styles.wide}>{photosEnabled ? 'Hasta 6 fotos de 5 MB. Las fotos tienen enlaces públicos, incluso si la propiedad es borrador.' : 'La carga de fotos requiere configurar Vercel Blob. Puede guardar la propiedad sin fotos.'}</p>
        {files.length > 0 && <ul className={styles.wide}>{files.map((file, index) => <li key={`${index}-${file.name}`}>{file.name} <button type="button" onClick={() => setFiles(current => current.filter((_, i) => i !== index))}>Quitar</button></li>)}</ul>}
        <details className={styles.wide}><summary>Más datos</summary><div className={styles.fields}>
          <label>Dormitorios<input type="number" name="bedrooms" min={0} max={50} defaultValue={initial?.bedrooms ?? 0} /></label><label>Baños<input type="number" name="bathrooms" min={0} max={50} defaultValue={initial?.bathrooms ?? 0} /></label>
          <label className={styles.wide}>Descripción<textarea name="description" maxLength={5000} defaultValue={initial?.description} /></label><label className={styles.wide}>Características<input name="features" defaultValue={initial?.features.join(', ')} placeholder="Cochera, patio" /></label>
        </div></details>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <div className={styles.actions}><button type="button" disabled={busy} onClick={onCancel}>Cancelar</button><button className={styles.primary} disabled={busy} type="submit">{busy ? 'Guardando…' : 'Guardar propiedad'}</button></div>
    </form>
  </section>;
}
