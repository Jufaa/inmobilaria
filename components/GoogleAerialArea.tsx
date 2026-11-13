'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, MapPin, Minus, Plus, RotateCw, Settings2 } from 'lucide-react';
import { loadGoogleMaps3D, type Google3DMap } from '@/lib/google-maps-3d';
import { aerialCameraForBounds, type DemoArea } from '@/lib/property-aerial-demo';
import type { PresentationMapStyle, PresentationPoint } from '@/lib/agency-presentation';
import styles from './aerial-experience.module.css';
import { normalizeHexColor, panelBrandStyles } from '@/lib/panel-colors';
import type { ExplorerSettings } from '@/lib/presentation-explorer';
import type { ReactNode } from 'react';

const demoKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? '';
const emptyPresentationPoints: PresentationPoint[] = [];
export type AerialCatalogueProperty = {
  id: string; title: string; latitude: number; longitude: number;
  price: number; currency: 'ARS' | 'USD'; color?: string; showPrice?: boolean;
};
const emptyCatalogueProperties: AerialCatalogueProperty[] = [];
type MarkerRegistration = { marker: HTMLElement; onClick: (event: Event) => void; onKeyDown?: (event: Event) => void };
const validPosition = (latitude: unknown, longitude: unknown): latitude is number => typeof latitude === 'number' && Number.isFinite(latitude) && Math.abs(latitude) <= 90
  && typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
const cataloguePrice = (property: AerialCatalogueProperty) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: property.currency, maximumFractionDigits: 0 }).format(property.price);


function colorMarker(marker: HTMLElement, library: Awaited<ReturnType<typeof loadGoogleMaps3D>>, color: unknown) {
  const background = normalizeHexColor(color) ?? '#245b49';
  marker.style.color = background;
  if (library.PinElement) {
    const foreground = panelBrandStyles(background)['--panel-button-text'];
    // Google 3D markers render PinElement through their default slot, not CSS text color.
    marker.append(new library.PinElement({ background, borderColor: foreground, glyphColor: foreground }));
  }
}

function updatePointAccessibility(marker: HTMLElement, point: PresentationPoint, interactive: boolean) {
  marker.setAttribute('aria-label', interactive ? `Editar punto de interés: ${point.name}` : `Punto de interés, sin acción: ${point.name}`);
  marker.setAttribute('tabindex', interactive ? '0' : '-1');
  if (interactive) marker.setAttribute('role', 'button');
  else marker.removeAttribute?.('role');
}

export function GoogleAerialArea({ area, onSelect, onClose, onEdit, appearance, pointsOfInterest = emptyPresentationPoints, clean = false, preferences, filterControls, onMapPick, onPointSelect, editablePointIds, catalogueProperties = emptyCatalogueProperties, onCatalogueSelect, managementControls, managementPanel, zoneNavigation, floatingContent, searchControls, searchResults }: {
  searchControls?: ReactNode; searchResults?: ReactNode;
  clean?: boolean; preferences?: ExplorerSettings; filterControls?: ReactNode;
  onMapPick?: (position: [number, number]) => void;
  onPointSelect?: (id: string) => void;
  editablePointIds?: string[];
  catalogueProperties?: AerialCatalogueProperty[];
  onCatalogueSelect?: (id: string) => void;
  floatingContent?: ReactNode; managementControls?: ReactNode; managementPanel?: ReactNode; zoneNavigation?: ReactNode;
  area: DemoArea; onSelect: (id: string) => void; onClose: () => void; onEdit?: () => void;
  appearance?: PresentationMapStyle; pointsOfInterest?: PresentationPoint[];
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<Google3DMap | null>(null);
  const libraryRef = useRef<Awaited<ReturnType<typeof loadGoogleMaps3D>> | null>(null);
  const pointMarkers = useRef(new Map<string, MarkerRegistration>());
  const callbacks = useRef({ onMapPick, onPointSelect, onCatalogueSelect, editablePointIds });
  callbacks.current = { onMapPick, onPointSelect, onCatalogueSelect, editablePointIds };
  const canEditPoint = (id: string) => !!callbacks.current.onPointSelect && (callbacks.current.editablePointIds === undefined || callbacks.current.editablePointIds.includes(id));
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [topDown, setTopDown] = useState(true);
  const [mapRevision, setMapRevision] = useState(0);
  const camera = aerialCameraForBounds(area.zone.bounds);
  const areaPoints = useMemo(() => pointsOfInterest.filter(point => point.longitude >= area.zone.bounds.west && point.longitude <= area.zone.bounds.east
    && point.latitude >= area.zone.bounds.south && point.latitude <= area.zone.bounds.north), [pointsOfInterest, area.zone.bounds]);

  const realProperties = useMemo(() => {
    const seen = new Set<string>();
    return catalogueProperties.filter(property => {
      if (seen.has(property.id) || !validPosition(property.latitude, property.longitude)) return false;
      seen.add(property.id); return true;
    });
  }, [catalogueProperties]);

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
          description: `Vista aérea de ${area.label}`,
        });
        libraryRef.current = library;
        map.current = element;
        element.style.width = '100%'; element.style.height = '100%';
        const fail = () => { if (!cancelled) { clearTimeout(timeout); setState('error'); } };
        const steady = (event: Event) => {
          if (!cancelled && (event as Event & { isSteady?: boolean }).isSteady) { clearTimeout(timeout); setState('ready'); }
        };
        const pick = (event: Event) => {
          if (cancelled || map.current !== element || !callbacks.current.onMapPick) return;
          const position = (event as Event & { position?: { lat?: unknown; lng?: unknown } }).position;
          if (position && validPosition(position.lat, position.lng)) { event.preventDefault(); callbacks.current.onMapPick([position.lng as number, position.lat]); }
        };
        element.addEventListener('gmp-click', pick);
        listeners.push(() => element?.removeEventListener('gmp-click', pick));
        element.addEventListener('gmp-error', fail);
        element.addEventListener('gmp-steadychange', steady);
        listeners.push(() => { element?.removeEventListener('gmp-error', fail); element?.removeEventListener('gmp-steadychange', steady); });
        area.properties.forEach((property, index) => {
          const marker = new library.Marker3DInteractiveElement({
            position: { lat: property.latitude, lng: property.longitude, altitude: 12 },
            altitudeMode: 'RELATIVE_TO_MESH', extruded: true,
            label: `${String(index + 1).padStart(2, '0')} · ${property.title}${clean && property.offer ? ` · Oferta · ${property.price}` : ''}`,
          });
          colorMarker(marker, library, preferences?.kindColors[property.kind] ?? appearance?.accentColor ?? '#4c8067');
          const choose = (event: Event) => {
            event.stopPropagation();
            if (cancelled || map.current !== element) return;
            if (callbacks.current.onMapPick) callbacks.current.onMapPick([property.longitude, property.latitude]);
            else onSelectRef.current(property.id);
          };
          marker.addEventListener('gmp-click', choose);
          listeners.push(() => marker.removeEventListener('gmp-click', choose));
          element!.append(marker);
        });
        container.append(element);
        setMapRevision(value => value + 1);
        timeout = setTimeout(fail, 35000);
      } catch { if (!cancelled) setState('error'); }
    }).catch(() => { if (!cancelled) setState('error'); });
    return () => {
      cancelled = true; clearTimeout(timeout); listeners.forEach(remove => remove());
      if (map.current === element) { map.current = null; libraryRef.current = null; }
      element?.replaceChildren(); element?.remove();
    };
  }, [area, attempt, clean, preferences?.kindColors, appearance?.accentColor]);

  useEffect(() => {
    const currentMap = map.current, library = libraryRef.current;
    if (!currentMap || !library) return;
    let active = true;
    const registered = new Map<string, MarkerRegistration>();
    const seen = new Set<string>();
    for (const point of areaPoints) {
      if (seen.has(point.id) || !validPosition(point.latitude, point.longitude)) continue;
      seen.add(point.id);
      const marker = new library.Marker3DInteractiveElement({
        position: { lat: point.latitude, lng: point.longitude, altitude: 12 },
        altitudeMode: 'RELATIVE_TO_MESH', label: `PUNTO DE INTERÉS · ${point.name}`, drawsWhenOccluded: true,
      });
      marker.style.color = point.color;
      updatePointAccessibility(marker, point, canEditPoint(point.id) || !!callbacks.current.onMapPick);
      const choose = (event: Event) => {
        event.preventDefault(); event.stopPropagation();
        if (!active || map.current !== currentMap) return;
        if (callbacks.current.onMapPick) callbacks.current.onMapPick([point.longitude, point.latitude]);
        else if (canEditPoint(point.id)) callbacks.current.onPointSelect?.(point.id);
      };
      const key = (event: Event) => {
        if (['Enter', ' '].includes((event as KeyboardEvent).key) && (canEditPoint(point.id) || callbacks.current.onMapPick)) choose(event);
      };
      marker.addEventListener('gmp-click', choose); marker.addEventListener('keydown', key);
      currentMap.append(marker);
      const registration = { marker, onClick: choose, onKeyDown: key };
      registered.set(point.id, registration); pointMarkers.current.set(point.id, registration);
    }
    return () => {
      active = false;
      registered.forEach((registration, id) => {
        const { marker, onClick, onKeyDown } = registration;
        marker.removeEventListener('gmp-click', onClick);
        if (onKeyDown) marker.removeEventListener('keydown', onKeyDown);
        marker.remove();
        if (pointMarkers.current.get(id) === registration) pointMarkers.current.delete(id);
      });
    };
  }, [areaPoints, mapRevision, attempt]);

  useEffect(() => {
    for (const point of areaPoints) {
      const marker = pointMarkers.current.get(point.id)?.marker;
      if (!marker) continue;
      const interactive = canEditPoint(point.id) || !!onMapPick;
      updatePointAccessibility(marker, point, interactive);
    }
  }, [areaPoints, mapRevision, onPointSelect, onMapPick, editablePointIds]);

  useEffect(() => {
    const currentMap = map.current, library = libraryRef.current;
    if (!currentMap || !library) return;
    let active = true;
    const markers: MarkerRegistration[] = [];
    for (const property of realProperties) {
      const price = property.showPrice && Number.isFinite(property.price) ? ` · ${cataloguePrice(property)}` : '';
      const marker = new library.Marker3DInteractiveElement({
        position: { lat: property.latitude, lng: property.longitude, altitude: 12 },
        altitudeMode: 'RELATIVE_TO_MESH', extruded: true, label: `${property.title}${price}`,
      });
      colorMarker(marker, library, property.color ?? appearance?.accentColor ?? '#245b49');
      marker.setAttribute('role', 'button'); marker.setAttribute('tabindex', '0'); marker.setAttribute('aria-label', `Ver inmueble: ${property.title}`);
      const choose = (event: Event) => {
        event.preventDefault(); event.stopPropagation();
        if (!active || map.current !== currentMap) return;
        if (callbacks.current.onMapPick) callbacks.current.onMapPick([property.longitude, property.latitude]);
        else callbacks.current.onCatalogueSelect?.(property.id);
      };
      const key = (event: Event) => { if (['Enter', ' '].includes((event as KeyboardEvent).key)) choose(event); };
      marker.addEventListener('gmp-click', choose); marker.addEventListener('keydown', key);
      currentMap.append(marker); markers.push({ marker, onClick: choose, onKeyDown: key });
    }
    return () => {
      active = false;
      markers.forEach(({ marker, onClick, onKeyDown }) => {
        marker.removeEventListener('gmp-click', onClick);
        if (onKeyDown) marker.removeEventListener('keydown', onKeyDown);
        marker.remove();
      });
    };
  }, [realProperties, mapRevision, appearance?.accentColor]);

  function selectCatalogue(property: AerialCatalogueProperty) {
    if (callbacks.current.onMapPick) callbacks.current.onMapPick([property.longitude, property.latitude]);
    else callbacks.current.onCatalogueSelect?.(property.id);
  }

  return <section className={`${styles.aerialExperience} ${clean ? styles.cleanAerial : ''}`} aria-label={`Vista aérea y propiedades de ${area.label}`}>
    <div ref={host} className={styles.aerialCanvas} />
    <header className={styles.aerialHeader}>
      <button onClick={onClose}><ArrowLeft size={16} /> Volver al mapa</button>
      <div>{!clean && <span>PRESENTACIÓN · PROPIEDADES DE EJEMPLO</span>}<h1>{area.label}</h1></div>{zoneNavigation}{filterControls}{managementControls && <div className={styles.aerialManagementControls}>{managementControls}</div>}
      {onEdit && <button onClick={onEdit}><Settings2 size={16} /> Personalizar</button>}
    </header>
    {onMapPick && !managementControls && <p role="status" style={{ position: 'absolute', zIndex: 3, top: 96, left: 20, maxWidth: 'calc(100% - 40px)', margin: 0, padding: '10px 14px', borderRadius: 10, background: 'var(--panel-surface, #ffffff)', color: 'var(--panel-text, #18372a)', pointerEvents: 'none' }}>Toque el mapa para elegir la ubicación.</p>}
    {searchControls&&<aside className={styles.aerialSearchControls} aria-label="Buscar propiedades">{searchControls}</aside>}
    {searchResults&&<div className={styles.aerialSearchResults}>{searchResults}</div>}
    {floatingContent && <div className={styles.aerialOffers}>{floatingContent}</div>}
    {managementPanel && <aside className={styles.aerialManagementPanel} aria-label="Administrar elementos de la zona">{managementPanel}</aside>}
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
      <details open={!clean || preferences?.showDetails}><summary hidden={!clean}>{area.properties.length + realProperties.length} propiedades · Ver opciones</summary>
      <div className={styles.aerialLegend}><span><MapPin size={13} /> {area.properties.length ? `${area.properties.length} propiedades ficticias en esta zona` : `${realProperties.length} inmuebles en esta zona`}</span><p>Toca un punto sobre el mapa o una opción de abajo para ver su video de entrada.</p></div>
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
          <span style={clean ? { borderColor: preferences?.kindColors[property.kind], color: preferences?.kindColors[property.kind] } : undefined} className={styles.aerialNumber}>{String(index + 1).padStart(2, '0')}</span>
          <span><small>{property.kind}</small><strong>{property.title}</strong>{(!clean || preferences?.showPrices || property.offer) && <small>{property.offer ? 'Oferta · ' : ''}{property.price}</small>}</span><ArrowRight size={15} />
        </button>)}
      </nav>
      {realProperties.length > 0 && <nav className={styles.aerialListings} aria-label={`Inmuebles en ${area.label}`}>{realProperties.map(property => <button key={property.id} type="button" onClick={() => selectCatalogue(property)}><span><strong>{property.title}</strong>{property.showPrice && Number.isFinite(property.price) && <small>{cataloguePrice(property)}</small>}</span><ArrowRight size={15} /></button>)}</nav>}
      {area.properties.length === 0 && realProperties.length === 0 && <p role="status">No hay propiedades que coincidan con los filtros.</p>}
      </details>
      <details open={!clean}><summary hidden={!clean}>Acerca de esta vista</summary><p className={styles.aerialDisclaimer}>Imágenes de Google; el detalle 3D depende de su cobertura. {area.properties.length ? 'Las propiedades y ubicaciones son ficticias. Los videos de muestra se reutilizan y no representan los edificios señalados.' : 'Las fichas corresponden al catálogo de la inmobiliaria.'}</p></details>
    </footer>
  </section>;
}
