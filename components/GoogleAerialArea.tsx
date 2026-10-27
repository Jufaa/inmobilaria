'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, MapPin, Minus, Plus, RotateCw, Settings2 } from 'lucide-react';
import { loadGoogleMaps3D, type Google3DMap } from '@/lib/google-maps-3d';
import { aerialCameraForBounds, type DemoArea } from '@/lib/property-aerial-demo';
import type { PresentationMapStyle, PresentationPoint } from '@/lib/agency-presentation';
import styles from './aerial-experience.module.css';

const demoKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? '';
const emptyPresentationPoints: PresentationPoint[] = [];

export function GoogleAerialArea({ area, onSelect, onClose, onEdit, appearance, pointsOfInterest = emptyPresentationPoints }: {
  area: DemoArea; onSelect: (id: string) => void; onClose: () => void; onEdit: () => void;
  appearance?: PresentationMapStyle; pointsOfInterest?: PresentationPoint[];
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<Google3DMap | null>(null);
  const libraryRef = useRef<Awaited<ReturnType<typeof loadGoogleMaps3D>> | null>(null);
  const pointMarkers = useRef(new Map<string, { marker: HTMLElement; onClick: (event: Event) => void }>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [topDown, setTopDown] = useState(true);
  const camera = aerialCameraForBounds(area.zone.bounds);
  const areaPoints = useMemo(() => pointsOfInterest.filter(point => point.longitude >= area.zone.bounds.west && point.longitude <= area.zone.bounds.east
    && point.latitude >= area.zone.bounds.south && point.latitude <= area.zone.bounds.north), [pointsOfInterest, area.zone.bounds]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let cancelled = false;
    let element: Google3DMap | null = null;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const listeners: Array<() => void> = [];
    setState('loading'); setTopDown(true);
    loadGoogleMaps3D(demoKey).then((library) => {
      if (cancelled) return;
      try {
        element = new library.Map3DElement({
          ...aerialCameraForBounds(area.zone.bounds), mode: 'SATELLITE', minAltitude: 100, maxTilt: 70,
          description: `Vista aérea de ${area.label}, con seis propiedades ficticias señaladas`,
        });
        libraryRef.current = library;
        map.current = element;
        element.style.width = '100%'; element.style.height = '100%';
        const fail = () => { if (!cancelled) { clearTimeout(timeout); setState('error'); } };
        const steady = (event: Event) => {
          if (!cancelled && (event as Event & { isSteady?: boolean }).isSteady) { clearTimeout(timeout); setState('ready'); }
        };
        element.addEventListener('gmp-error', fail);
        element.addEventListener('gmp-steadychange', steady);
        listeners.push(() => { element?.removeEventListener('gmp-error', fail); element?.removeEventListener('gmp-steadychange', steady); });
        area.properties.forEach((property, index) => {
          const marker = new library.Marker3DInteractiveElement({
            position: { lat: property.latitude, lng: property.longitude, altitude: 12 },
            altitudeMode: 'RELATIVE_TO_MESH', extruded: true,
            label: `${String(index + 1).padStart(2, '0')} · ${property.title}`,
          });
          const choose = (event: Event) => { event.stopPropagation(); onSelectRef.current(property.id); };
          marker.addEventListener('gmp-click', choose);
          listeners.push(() => marker.removeEventListener('gmp-click', choose));
          element!.append(marker);
        });
        container.append(element);
        timeout = setTimeout(fail, 35000);
      } catch { if (!cancelled) setState('error'); }
    }).catch(() => { if (!cancelled) setState('error'); });
    return () => {
      cancelled = true; clearTimeout(timeout); listeners.forEach(remove => remove());
      element?.replaceChildren(); element?.remove();
      pointMarkers.current.forEach(({ marker, onClick }) => { marker.removeEventListener('gmp-click', onClick); marker.remove(); });
      pointMarkers.current.clear(); libraryRef.current = null;
      if (map.current === element) map.current = null;
    };
  }, [area, attempt]);

  useEffect(() => {
    const currentMap = map.current, library = libraryRef.current;
    if (!currentMap || !library) return;
    pointMarkers.current.forEach(({ marker, onClick }) => { marker.removeEventListener('gmp-click', onClick); marker.remove(); });
    pointMarkers.current.clear();
    const seen = new Set<string>();
    for (const point of areaPoints) {
      if (seen.has(point.id) || !Number.isFinite(point.latitude) || Math.abs(point.latitude) > 90 || !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180) continue;
      seen.add(point.id);
      const marker = new library.Marker3DInteractiveElement({
        position: { lat: point.latitude, lng: point.longitude, altitude: 12 },
        altitudeMode: 'RELATIVE_TO_MESH',
        label: `PUNTO DE INTERÉS · ${point.name}`,
        drawsWhenOccluded: true,
      });
      marker.style.color = point.color;
      marker.setAttribute('aria-label', `Punto de interés, sin acción: ${point.name}`);
      marker.setAttribute('tabindex', '-1');
      // This marker is informational; property selection remains exclusive to property pins.
      const ignoreClick = (event: Event) => { event.preventDefault(); event.stopPropagation(); };
      marker.addEventListener('gmp-click', ignoreClick);
      currentMap.append(marker);
      pointMarkers.current.set(point.id, { marker, onClick: ignoreClick });
    }
    return () => {
      pointMarkers.current.forEach(({ marker, onClick }) => { marker.removeEventListener('gmp-click', onClick); marker.remove(); });
      pointMarkers.current.clear();
    };
  }, [areaPoints, state, attempt]);

  return <section className={styles.aerialExperience} aria-label={`Vista aérea y propiedades de ${area.label}`}>
    <div ref={host} className={styles.aerialCanvas} />
    <header className={styles.aerialHeader}>
      <button onClick={onClose}><ArrowLeft size={16} /> Volver al mapa</button>
      <div><span>PRESENTACIÓN · PROPIEDADES DE EJEMPLO</span><h1>{area.label}</h1></div>
      <button onClick={onEdit}><Settings2 size={16} /> Personalizar</button>
    </header>
    {state === 'loading' && <div className={styles.aerialLoading} role="status">Cargando la vista aérea de Google…</div>}
    {state === 'error' && <div className={styles.aerialError} role="alert">
      <h2>No se pudo mostrar la vista aérea.</h2>
      <p>{demoKey ? 'Revisa la conexión, la autorización de la clave de demostración o su cuota diaria. También puede faltar soporte 3D en este navegador.' : 'Configura NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en .env.local y reinicia el servidor.'}</p>
      <button onClick={() => setAttempt(value => value + 1)}>Reintentar Google 3D</button>
      <small>Las fichas de abajo permiten probar los recorridos aunque la vista aérea no esté disponible. No se activa facturación desde esta demo.</small>
    </div>}
    <div className={styles.aerialControls} aria-label="Controles de la vista aérea">
      <button onClick={() => { if (map.current) map.current.range = Math.max(350, map.current.range * .75); }} aria-label="Acercar vista aérea"><Plus size={17} /></button>
      <button onClick={() => { if (map.current) map.current.range = Math.min(Math.max(5000, camera.range * 3), map.current.range * 1.3); }} aria-label="Alejar vista aérea"><Minus size={17} /></button>
      <button onClick={() => { if (map.current) map.current.heading = (map.current.heading + 30) % 360; }} aria-label="Rotar vista aérea"><RotateCw size={17} /></button>
      <button aria-pressed={topDown} onClick={() => { if (map.current) { const next = !topDown; map.current.tilt = next ? 0 : 45; setTopDown(next); } }}>Vista {topDown ? '3D' : 'cenital'}</button>
      <button onClick={() => { if (map.current) { map.current.center = camera.center; map.current.range = camera.range; map.current.tilt = 0; map.current.heading = 0; setTopDown(true); } }}>Centrar zona</button>
    </div>
    <footer className={styles.aerialFooter}>
      <div className={styles.aerialLegend}><span><MapPin size={13} /> {area.properties.length} propiedades ficticias en esta zona</span><p>Toca un punto sobre el mapa o una opción de abajo para ver su video de entrada.</p></div>
      {!!areaPoints.length && <section aria-label="Puntos de interés" aria-live="polite" style={{ borderInlineStart: `3px solid ${appearance?.accentColor ?? '#be6345'}`, paddingInlineStart: 12, maxHeight: '4.5rem', overflowY: 'auto', fontSize: '0.75rem' }}>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '0.8rem' }}>Puntos de interés</h2>
        <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem 0.75rem', margin: 0, padding: 0, listStyle: 'none' }}>{areaPoints.map(point => <li key={point.id}>
          <span aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: point.color, marginRight: 8 }} />
          {point.name}
        </li>)}</ul>
        <small>Son referencias informativas y no abren recorridos de propiedades.</small>
      </section>}
      <nav className={styles.aerialListings} aria-label={`Propiedades disponibles en ${area.label}`}>
        {area.properties.map((property, index) => <button key={property.id} onClick={() => onSelect(property.id)} aria-label={`Entrar a ${property.title}`}>
          <span className={styles.aerialNumber}>{String(index + 1).padStart(2, '0')}</span>
          <span><small>{property.kind}</small><strong>{property.title}</strong><small>{property.price}</small></span><ArrowRight size={15} />
        </button>)}
      </nav>
      <p className={styles.aerialDisclaimer}>Imágenes de Google; el detalle 3D depende de su cobertura. Las propiedades y ubicaciones son ficticias. Los videos de muestra se reutilizan y no representan los edificios señalados.</p>
    </footer>
  </section>;
}
