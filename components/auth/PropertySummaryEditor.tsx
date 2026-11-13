'use client';

import { useRef, useState, type FormEvent } from 'react';
import type { PropertySummaryFields } from '@/lib/property-offers';
import styles from './real-agency-map.module.css';

export function PropertySummaryEditor({ initial, onSave, onCancel }: { initial: PropertySummaryFields; onSave: (fields: PropertySummaryFields) => Promise<string | null>; onCancel: () => void }) {
  const [error,setError] = useState(''); const [busy,setBusy] = useState(false); const pending=useRef(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();if(pending.current)return;
    const data=new FormData(event.currentTarget);
    const fields:PropertySummaryFields={title:String(data.get('title')??'').trim(),amount:Number(data.get('amount')),currency:data.get('currency') as 'ARS'|'USD',area:Number(data.get('area')),bedrooms:Number(data.get('bedrooms')),bathrooms:Number(data.get('bathrooms')),features:String(data.get('features')??'').split(',').map(item=>item.trim()).filter(Boolean)};
    pending.current=true;setBusy(true);setError('');
    try {const result=await onSave(fields);if(result)setError(result);}
    catch {setError('No se pudieron guardar los datos.');}
    finally {pending.current=false;setBusy(false);}
  }
  return <form className={styles.formPanel} onSubmit={save} aria-label="Editar precio y características"><fieldset disabled={busy} className={styles.fields}>
    <label className={styles.wide}>Título<input name="title" required minLength={3} maxLength={100} defaultValue={initial.title}/></label>
    <label>Precio<input name="amount" type="number" required min={0} max={1e12} step="any" defaultValue={initial.amount}/></label>
    <label>Moneda<select name="currency" defaultValue={initial.currency}><option>USD</option><option>ARS</option></select></label>
    <label>Superficie (m²)<input name="area" type="number" required min={0.01} max={99999999} step="any" defaultValue={initial.area}/></label>
    <label>Dormitorios<input name="bedrooms" type="number" min={0} max={50} step={1} required defaultValue={initial.bedrooms}/></label>
    <label>Baños<input name="bathrooms" type="number" min={0} max={50} step={1} required defaultValue={initial.bathrooms}/></label>
    <label className={styles.wide}>Características<input name="features" maxLength={2400} defaultValue={initial.features.join(', ')} placeholder="Patio, cochera"/></label>
  </fieldset>{error&&<p role="alert">{error}</p>}<div className={styles.actions}><button type="button" disabled={busy} onClick={onCancel}>Cancelar</button><button type="submit" className={styles.primary} disabled={busy}>{busy?'Guardando…':'Guardar datos'}</button></div></form>;
}
