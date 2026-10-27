'use client';

import { useEffect, useRef, useState } from 'react';
import {
  defaultPresentationSettings,
  presentationUpdatedEvent,
  readPresentationSettings,
  savePresentationSettings,
  type PresentationPoint,
  type PresentationSettings,
} from '@/lib/agency-presentation';
import styles from './agency-presentation-settings.module.css';

const zoneIds = ['centro', 'banda-norte'] as const;
const zoneNames: Record<(typeof zoneIds)[number], string> = { centro: 'Centro', 'banda-norte': 'Banda Norte' };
const propertyIds = zoneIds.flatMap(zone => Array.from({ length: 6 }, (_, index) => `presentation-${zone}-${index + 1}`));
const propertyNames = zoneIds.flatMap(zone => Array.from({ length: 6 }, (_, index) => `${zoneNames[zone]} · Propiedad ${index + 1}`));
const copy = <T,>(value: T): T => structuredClone(value);

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className={styles.field}>
    <span>{label}</span>
    {children}
    {hint ? <small>{hint}</small> : null}
  </label>;
}

export function AgencyPresentationSettings({ agencyId, onSaved, initialSettings, onPersist }: {
  agencyId: string;
  onSaved?: (settings: PresentationSettings) => void;
  initialSettings?: PresentationSettings;
  onPersist?: (value: unknown) => Promise<{ settings: PresentationSettings | null; error: string | null }>;
}) {
  const [settings, setSettings] = useState<PresentationSettings>(() => copy(initialSettings ?? defaultPresentationSettings));
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const loaded = useRef<PresentationSettings>(copy(defaultPresentationSettings));
  const revision = useRef(0);
  const loadEpoch = useRef(0);

  useEffect(() => {
    const epoch = ++loadEpoch.current;
    revision.current++;
    let result: ReturnType<typeof readPresentationSettings>;
    try {
      result = initialSettings
        ? { settings: initialSettings, error: null }
        : readPresentationSettings(window.localStorage, agencyId);
    } catch {
      result = { settings: defaultPresentationSettings, error: 'No se pudo acceder al almacenamiento local. Se muestra la presentación original.' };
    }
    const next = copy(result.settings);
    loaded.current = next;
    setSettings(next);
    setError(result.error);
    setStatus('');
    return () => {
      if (loadEpoch.current === epoch) loadEpoch.current++;
      revision.current++;
    };
  }, [agencyId, initialSettings]);

  function update(change: (current: PresentationSettings) => PresentationSettings) {
    revision.current++;
    setSettings(current => change(copy(current)));
    setError(null);
    setStatus('');
  }

  function updateMap<K extends keyof PresentationSettings['map']>(key: K, value: PresentationSettings['map'][K]) {
    update(current => ({ ...current, map: { ...current.map, [key]: value } }));
  }

  function updateBounds(key: keyof PresentationSettings['map']['bounds'], value: string) {
    const number = value === '' ? Number.NaN : Number(value);
    update(current => ({ ...current, map: { ...current.map, bounds: { ...current.map.bounds, [key]: number } } }));
  }

  function updatePoint(index: number, change: Partial<PresentationPoint>) {
    update(current => ({ ...current, points: current.points.map((point, pointIndex) => pointIndex === index ? { ...point, ...change } : point) }));
  }

  function addPoint() {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replaceAll('-', '')
      : `point-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    update(current => current.points.length >= 50 ? current : ({
      ...current,
      points: [...current.points, { id, name: '', latitude: current.map.bounds.south, longitude: current.map.bounds.west, color: current.map.accentColor }],
    }));
  }

  function uploadArtwork(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Seleccione una imagen PNG, JPEG o WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('La imagen debe tener un tamaño máximo de 2 MB.');
      return;
    }
    setError(null);
    const requestRevision = ++revision.current;
    const requestEpoch = loadEpoch.current;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string' || requestRevision !== revision.current || requestEpoch !== loadEpoch.current) return;
      setSettings(current => ({ ...copy(current), map: { ...current.map, artworkUrl: reader.result as string, mode: 'artwork' } }));
      setStatus(`La imagen se cargó en el borrador. Guarde los ajustes para conservarla ${onPersist ? 'para esta inmobiliaria' : 'en este navegador'}.`);
    };
    reader.onerror = () => {
      if (requestRevision === revision.current && requestEpoch === loadEpoch.current) setError('No se pudo leer la imagen seleccionada.');
    };
    reader.readAsDataURL(file);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (onPersist) {
      const requestRevision = revision.current;
      try {
        const result = await onPersist(settings);
        if (requestRevision !== revision.current) return;
        if (!result.settings || result.error) {
          setError(result.error ?? 'No se pudieron guardar los ajustes.');
          setStatus('');
          return;
        }
        const saved = copy(result.settings);
        loaded.current = saved;
        setSettings(saved);
        setError(null);
        setStatus('Los ajustes de presentación se guardaron para esta inmobiliaria y estarán disponibles en otros dispositivos.');
        onSaved?.(saved);
      } catch {
        if (requestRevision === revision.current) {
          setError('No se pudieron guardar los ajustes de presentación. Los datos anteriores no se modificaron.');
          setStatus('');
        }
      }
      return;
    }
    let result: ReturnType<typeof savePresentationSettings>;
    try {
      result = savePresentationSettings(window.localStorage, agencyId, settings);
    } catch {
      setError('No se pudo acceder al almacenamiento local. Los ajustes anteriores no se modificaron.');
      setStatus('');
      return;
    }
    if (!result.settings || result.error) {
      setError(result.error ?? 'No se pudieron guardar los ajustes.');
      setStatus('');
      return;
    }
    const saved = copy(result.settings);
    loaded.current = saved;
    setSettings(saved);
    setError(null);
    setStatus('Los ajustes de presentación se guardaron en este navegador para esta inmobiliaria.');
    window.dispatchEvent(new CustomEvent(presentationUpdatedEvent, { detail: { agencyId } }));
    onSaved?.(saved);
  }

  function resetDraft() {
    setSettings(copy(loaded.current));
    setError(null);
    setStatus('Se restauró el borrador con los últimos ajustes guardados. Guarde explícitamente para conservar los cambios.');
    revision.current++;
  }

  return <section className={styles.editor} aria-labelledby="agency-presentation-title">
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Configuración de la presentación</p>
        <h2 id="agency-presentation-title">Personalice el plano de la inmobiliaria</h2>
    <p>{onPersist ? 'Estos ajustes se guardan para esta inmobiliaria y se cargan en otros dispositivos.' : 'Estos ajustes se aplican únicamente a esta inmobiliaria en este navegador.'} No modifican la identidad visual, las propiedades, las cuentas ni las plantillas compartidas.</p>
      </div>
    </header>
    <div className={styles.notice}>
      <strong>Demostración local para clientes</strong>
      <p>Las propiedades de demostración y los videos de muestra son ficticios. Los planos y videos deben prepararse externamente; la generación con IA también es externa y no está integrada en este editor.</p>
      <p>El plano se vincula con límites geográficos. Ajuste esos límites a la imagen y mantenga cada punto en su latitud y longitud reales.</p>
    </div>
    <form className={styles.form} onSubmit={save}>
      {error ? <p className={styles.messageError} role="alert">{error}</p> : null}
      {status ? <p className={styles.messageStatus} role="status">{status}</p> : null}

      <fieldset className={styles.group}>
        <legend>Video institucional</legend>
        <label className={styles.toggle}><input type="checkbox" checked={settings.intro.enabled} onChange={event => update(current => ({ ...current, intro: { ...current.intro, enabled: event.target.checked } }))} /> Activar video de presentación</label>
        <Field label="URL del video institucional (MP4)" hint="Opcional. Se sugiere una duración de 20 a 60 segundos. Déjela vacía o desactive la opción para omitirlo.">
          <input type="text" value={settings.intro.videoUrl} onChange={event => update(current => ({ ...current, intro: { ...current.intro, videoUrl: event.target.value } }))} placeholder="/demo-assets/tours/agency-intro-sample.mp4" />
        </Field>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Aspecto del plano</legend>
        <Field label="Modo de presentación del plano">
          <select value={settings.map.mode} onChange={event => updateMap('mode', event.target.value as PresentationSettings['map']['mode'])}>
            <option value="interactive">Plano interactivo</option><option value="artwork">Imagen preparada</option>
          </select>
        </Field>
        <Field label="URL de la imagen o ruta local" hint={`Admite imágenes HTTPS y rutas locales /demo-assets o /maps. Las imágenes cargadas se guardan ${onPersist ? 'para esta inmobiliaria' : 'en este navegador'}.`}>
          <input type="text" value={settings.map.artworkUrl} onChange={event => updateMap('artworkUrl', event.target.value)} placeholder="/maps/agency-plan.png" />
        </Field>
        <Field label="Cargar imagen del plano" hint="PNG, JPEG o WebP; máximo 2 MB.">
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadArtwork} />
        </Field>
        <div className={styles.colorGrid}>
          {([
            ['Color de acento', 'accentColor'], ['Color del terreno', 'landColor'], ['Color de las construcciones', 'buildingColor'], ['Color del agua', 'waterColor'],
          ] as const).map(([label, key]) => <Field key={key} label={label}><input aria-label={label} type="color" value={settings.map[key]} onChange={event => updateMap(key, event.target.value)} /></Field>)}
        </div>
        <div className={styles.coordinateGrid}>
          {([
            ['Longitud oeste', 'west'], ['Longitud este', 'east'], ['Latitud sur', 'south'], ['Latitud norte', 'north'],
          ] as const).map(([label, key]) => <Field key={key} label={label}><input type="number" step="any" value={settings.map.bounds[key]} onChange={event => updateBounds(key, event.target.value)} /></Field>)}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Puntos de interés <span className={styles.count}>({settings.points.length}/50)</span></legend>
        {settings.points.map((point, index) => <div className={styles.point} key={point.id}>
          <h3>Punto de interés {index + 1}</h3>
          <div className={styles.pointGrid}>
            <Field label="Nombre del punto"><input type="text" maxLength={100} value={point.name} onChange={event => updatePoint(index, { name: event.target.value })} /></Field>
            <Field label="Latitud del punto"><input type="number" step="any" value={point.latitude} onChange={event => updatePoint(index, { latitude: event.target.value === '' ? Number.NaN : Number(event.target.value) })} /></Field>
            <Field label="Longitud del punto"><input type="number" step="any" value={point.longitude} onChange={event => updatePoint(index, { longitude: event.target.value === '' ? Number.NaN : Number(event.target.value) })} /></Field>
            <Field label="Color del punto"><input aria-label="Color del punto" type="color" value={point.color} onChange={event => updatePoint(index, { color: event.target.value })} /></Field>
          </div>
          <button className={styles.removeButton} type="button" onClick={() => update(current => ({ ...current, points: current.points.filter((_, pointIndex) => pointIndex !== index) }))}>Quitar punto</button>
        </div>)}
        <button className={styles.secondaryButton} type="button" onClick={addPoint} disabled={settings.points.length >= 50}>Agregar punto de interés</button>
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Videos de transición por zona</legend>
        {zoneIds.map(id => <div className={styles.mediaRow} key={id}>
          <h3>{zoneNames[id]}</h3>
          <label className={styles.toggle}><input type="checkbox" checked={settings.zones[id].transitionEnabled} onChange={event => update(current => ({ ...current, zones: { ...current.zones, [id]: { ...current.zones[id], transitionEnabled: event.target.checked } } }))} /> Activar video de transición</label>
          <Field label={`URL del video de transición de ${zoneNames[id]} (MP4)`}><input type="text" value={settings.zones[id].videoUrl} onChange={event => update(current => ({ ...current, zones: { ...current.zones, [id]: { ...current.zones[id], videoUrl: event.target.value } } }))} placeholder="/demo-assets/tours/location-01.mp4" /></Field>
        </div>)}
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Videos de vuelo de dron por propiedad</legend>
        <p>El vuelo de dron se reproduce siempre antes de entrar. Puedes reemplazar el video para cada propiedad.</p>
        {propertyIds.map((id, index) => <div className={styles.mediaRow} key={id}>
          <h3>{propertyNames[index]}</h3>
          <Field label={`URL del video de dron de ${propertyNames[index]} (MP4)`}><input type="text" value={settings.properties[id].videoUrl} onChange={event => update(current => ({ ...current, properties: { ...current.properties, [id]: { ...current.properties[id], videoUrl: event.target.value } } }))} placeholder="/demo-assets/tours/entrance-01.mp4" /></Field>
        </div>)}
      </fieldset>

      <div className={styles.actions}>
        <button className={styles.secondaryButton} type="button" onClick={resetDraft}>Restablecer borrador</button>
        <button className={styles.primaryButton} type="submit">Guardar ajustes</button>
      </div>
    </form>
  </section>;
}
