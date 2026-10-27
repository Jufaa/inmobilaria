'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, RotateCcw, Save, X } from 'lucide-react';
import { defaultDemoConfig, reorderDemoProperty, type DemoConfig, type DemoListing } from '@/lib/property-tour-config';
import styles from './aerial-experience.module.css';

type DraftListing = Omit<DemoListing, 'latitude' | 'longitude' | 'price'> & { latitude: string; longitude: string; price: string };
const draftOf = (config: DemoConfig): DraftListing[] => config.properties.map((item) => ({ ...item, latitude: String(item.latitude), longitude: String(item.longitude), price: String(item.price) }));

export function TourDemoEditor({ config, onSave, onClose, persisted = false }: { config: DemoConfig; onSave: (value: unknown) => string | null | Promise<string | null>; onClose: () => void; persisted?: boolean }) {
  const [draft, setDraft] = useState(() => draftOf(config));
  const [error, setError] = useState('');
  function patch(id: string, key: keyof DraftListing, value: string) {
    setDraft((previous) => previous.map((item) => item.id === id ? { ...item, [key]: value } : item));
  }
  function move(id: string, direction: -1 | 1) {
    // Reuse the configuration ordering helper; never derive identities from positions.
    const order = reorderDemoProperty({ version: 1, properties: draft.map((item) => ({ ...item, latitude: Number(item.latitude), longitude: Number(item.longitude), price: Number(item.price) })) }, id, direction);
    setDraft(order.properties.map((item) => draft.find((entry) => entry.id === item.id)!));
  }
  return (
    <form className={styles.editor} onSubmit={async (event) => {
      event.preventDefault();
      const number = (value: string) => value.trim() ? Number(value) : NaN;
      const result = await onSave({ version: 1, properties: draft.map((item) => ({ ...item, latitude: number(item.latitude), longitude: number(item.longitude), price: number(item.price) })) });
      if (result) setError(result);
    }}>
      <header className={styles.editorHeader}><div><span className={styles.eyebrow}>PERSONALIZACIÓN DE LA PRESENTACIÓN</span><h2>Tu mapa, a tu manera.</h2></div><button type="button" onClick={onClose} aria-label="Cerrar personalización"><X size={20} /></button></header>
      <p className={styles.editorNotice}>Edita las dos plantillas compartidas por las zonas del panel. Cada zona presenta seis fichas ficticias con los videos de una plantilla. {persisted ? 'Los cambios se guardan para esta inmobiliaria y están disponibles en otros dispositivos.' : 'Los cambios se guardan solo en este navegador.'} No modifican el catálogo. Cerrar sin guardar descarta el borrador.</p>
      {draft.map((item, index) => <fieldset key={item.id} className={styles.editorProperty}>
        <legend>Plantilla {index + 1} · {item.id}</legend>
        <div className={styles.reorder}><span>Orden de las plantillas</span><button type="button" disabled={index === 0} onClick={() => move(item.id, -1)} aria-label={`Subir ${item.title}`}><ArrowUp size={15} /></button><button type="button" disabled={index === draft.length - 1} onClick={() => move(item.id, 1)} aria-label={`Bajar ${item.title}`}><ArrowDown size={15} /></button></div>
        <div className={styles.editorGrid}>
          <label>Título<input required minLength={3} maxLength={160} value={item.title} onChange={(event) => patch(item.id, 'title', event.target.value)} /></label>
          <label>Barrio o ubicación<input required minLength={2} maxLength={100} value={item.neighborhood} onChange={(event) => patch(item.id, 'neighborhood', event.target.value)} /></label>
          <label className={styles.wideField}>Descripción<textarea required maxLength={1000} rows={3} value={item.description} onChange={(event) => patch(item.id, 'description', event.target.value)} /></label>
          <label>Latitud<input required type="number" step="any" min={-90} max={90} value={item.latitude} onChange={(event) => patch(item.id, 'latitude', event.target.value)} /></label>
          <label>Longitud<input required type="number" step="any" min={-180} max={180} value={item.longitude} onChange={(event) => patch(item.id, 'longitude', event.target.value)} /></label>
          <label>Precio de muestra<input required type="number" min={0} max={1e12} value={item.price} onChange={(event) => patch(item.id, 'price', event.target.value)} /></label>
          <label>Moneda<select value={item.currency} onChange={(event) => patch(item.id, 'currency', event.target.value)}><option value="USD">USD</option><option value="ARS">ARS</option></select></label>
          {([
            ['locationVideo', 'Video del entorno · MP4 (demo anterior)'], ['entranceVideo', 'Video de entrada al recorrido · MP4'],
            ['interiorVideo', 'Video de la propiedad · MP4'], ['poster', 'Imagen de portada · JPG, PNG o WEBP'],
          ] as const).map(([key, label]) => <label className={styles.wideField} key={key}>{label}<input required maxLength={2048} value={item[key]} onChange={(event) => patch(item.id, key, event.target.value)} spellCheck={false} /></label>)}
        </div>
        <p className={styles.fieldHint}>Coordenadas en grados decimales. Usa archivos de la demo o URLs públicas HTTPS, sin contraseñas. No se suben archivos ni se comprueba que una URL externa esté disponible hasta reproducirla.</p>
      </fieldset>)}
      {error && <p className={styles.editorError} role="alert">{error}</p>}
      <footer className={styles.editorFooter}><button type="button" onClick={() => { setDraft(draftOf(defaultDemoConfig)); setError(''); }}><RotateCcw size={15} /> Cargar valores originales</button><button type="submit" className={styles.saveButton}><Save size={15} /> Guardar presentación</button></footer>
    </form>
  );
}
