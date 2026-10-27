'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, MapPinned, SlidersHorizontal } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import { TourDemoEditor } from '@/components/TourDemoEditor';
import { defaultDemoConfig, mapPropertiesForConfig, readDemoConfig, saveDemoConfig, zonesForConfig, type DemoConfig } from '@/lib/property-tour-config';
import { tourIdForMapProperty } from '@/lib/property-tour-map';
import type { PresentationZone } from '@/lib/workspace-aerial-presentation';
import type { WorkspaceMapPoint, WorkspaceMapProperty, WorkspaceMapZone } from './WorkspacePropertyMap';
import { defaultPresentationSettings, presentationStorageKey, presentationUpdatedEvent, readPresentationSettings, type PresentationSettings, type PresentationPoint } from '@/lib/agency-presentation';
import { PresentationVideo } from './PresentationVideo';
import { AgencyPresentationSettings } from './AgencyPresentationSettings';
import { PresentationArtworkMap } from './PresentationArtworkMap';
import { WorkspaceAerialExperience } from './WorkspaceAerialExperience';
import experienceStyles from '../aerial-experience.module.css';
import styles from './agency-presentation-map.module.css';

const CityMap = dynamic(() => import('../CityMap'), {
  ssr: false,
  loading: () => <div className={styles.loading} role="status">Cargando el mapa 3D…</div>,
});

export function AgencyPresentationMap({ title, properties, zones, points, agencyId = 'local-presentation', agencySlug = agencyId, agencyName = 'Tu inmobiliaria', initialSettings, initialDemoConfig, persistSettings, persistDemoConfig, sharedCatalogue = false }: {
  sharedCatalogue?: boolean;
  agencyId?: string;
  agencySlug?: string;
  agencyName?: string;
  title: string;
  properties: WorkspaceMapProperty[];
  zones: WorkspaceMapZone[];
  points: WorkspaceMapPoint[];
  initialSettings?: PresentationSettings;
  initialDemoConfig?: DemoConfig;
  persistSettings?: (value: unknown) => Promise<{ settings: PresentationSettings | null; error: string | null }>;
  persistDemoConfig?: (value: unknown) => Promise<{ config: DemoConfig | null; error: string | null }>;
}) {
  const [config, setConfig] = useState(initialDemoConfig ?? defaultDemoConfig);
  const [persistedConfig, setPersistedConfig] = useState(initialDemoConfig);
  const [zoneRevision, setZoneRevision] = useState(1);
  const [activeZone, setActiveZone] = useState<PresentationZone | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [settings, setSettings] = useState<PresentationSettings | null>(initialSettings ?? null);
  const [mapEntered, setMapEntered] = useState(false);
  const [introDismissed, setIntroDismissed] = useState(false);
  const [transition, setTransition] = useState<{ zone: PresentationZone; token: number; src: string } | null>(null);
  const transitionToken = useRef(0);
  const editor = useRef<HTMLDialogElement>(null);
  const [selectedSharedId, setSelectedSharedId] = useState<string | null>(null);
  const [sharedFocusRevision, setSharedFocusRevision] = useState(0);
  // Negative marker IDs keep real catalogue records separate from demo tour IDs.
  const sharedMapProperties = useMemo(() => sharedCatalogue ? properties.flatMap((property, index) =>
    property.latitude === null || property.longitude === null ? [] : [{
      id: -(index + 1), address: `Propiedad real compartida: ${property.title}`,
      latitude: property.latitude, longitude: property.longitude,
      price: property.price, currency: property.currency,
    }],
  ) : [], [properties, sharedCatalogue]);
  const mapProperties = useMemo(() => [...mapPropertiesForConfig(config), ...sharedMapProperties], [config, sharedMapProperties]);
  const selectedSharedIndex = properties.findIndex(property => property.id === selectedSharedId);
  const selectedShared = sharedCatalogue ? properties[selectedSharedIndex] : undefined;
  const selectedSharedMarker = sharedMapProperties.find(property => property.id === -(selectedSharedIndex + 1)) ?? null;
  function selectShared(id: string) {
    setSelectedSharedId(id);
    setSharedFocusRevision(revision => revision + 1);
  }
  const areas = useMemo(() => zonesForConfig(config), [config]);

  const appearance = settings?.map ?? defaultPresentationSettings.map;
  const mapPoints = useMemo<PresentationPoint[]>(() => [
    ...points.map(point => ({ ...point, id: `catalogue-${point.id}`, color: appearance.accentColor })),
    ...(settings?.points ?? []),
    ...(appearance.mode === 'artwork' ? sharedMapProperties.map(property => ({
      id: `shared-${property.id}`, name: property.address, category: 'Propiedad compartida',
      latitude: property.latitude, longitude: property.longitude, color: appearance.accentColor,
    })) : []),
  ], [points, settings, appearance.accentColor, appearance.mode, sharedMapProperties]);
  const showingIntro = !!settings && !!settings.intro.videoUrl && !introDismissed;
  const blocked = !!activeZone || !!transition || editorOpen || showingIntro;

  useEffect(() => {
    function load(initial = false) {
      try {
        const loaded = initialSettings
          ? { settings: initialSettings, error: null }
          : readPresentationSettings(window.localStorage, agencyId);
        setSettings(loaded.settings);
        if (loaded.error) setNotice(loaded.error);
        if (initial) {
          const hasIntro = loaded.settings.intro.enabled && !!loaded.settings.intro.videoUrl;
          setIntroDismissed(!hasIntro); setMapEntered(!hasIntro);
        } else if (!loaded.settings.intro.enabled || !loaded.settings.intro.videoUrl) {
          setIntroDismissed(true); setMapEntered(true);
        }
      } catch { setSettings(defaultPresentationSettings); setNotice('No se pueden leer los ajustes locales. Puedes omitir los videos para continuar.'); }
    }
    load(true);
    const onStorage = (event: StorageEvent) => { if (!event.key || event.key === presentationStorageKey(agencyId)) load(); };
    const onUpdate = (event: Event) => { if ((event as CustomEvent<{ agencyId: string }>).detail?.agencyId === agencyId) load(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener(presentationUpdatedEvent, onUpdate);
    return () => { transitionToken.current++; window.removeEventListener('storage', onStorage); window.removeEventListener(presentationUpdatedEvent, onUpdate); };
  }, [agencyId, initialSettings]);

  function acceptConfig(next: DemoConfig) {
    if (JSON.stringify(next) === JSON.stringify(config)) return;
    setConfig(next);
    setZoneRevision(revision => revision + 1);
  }
  function reloadConfig() {
    if (persistedConfig) {
      acceptConfig(persistedConfig);
      return;
    }
    try {
      const loaded = readDemoConfig(window.localStorage);
      acceptConfig(loaded.config);
      setNotice(loaded.error ?? '');
    } catch {
      setNotice('El almacenamiento local no está disponible. La presentación sigue funcionando sin guardar cambios.');
    }
  }
  useEffect(() => {
    reloadConfig();
    // Browser settings are loaded on entry and explicitly refreshed on modal return.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistedConfig]);
  useEffect(() => {
    if (editorOpen && !editor.current?.open) editor.current?.showModal();
  }, [editorOpen]);

  function openZone(id: string) {
    const area = areas.find(item => item.id === id);
    if (!area) return;
    const { west, east, south, north } = area.bounds;
    const zone: PresentationZone = { id, name: area.label, geometry: { type: 'Polygon', coordinates: [
      [[west, south], [east, south], [east, north], [west, north], [west, south]],
    ] } };
    const token = ++transitionToken.current;
    const clip = settings?.zones[id];
    if (clip?.transitionEnabled && clip.videoUrl) setTransition({ zone, token, src: clip.videoUrl });
    else { setTransition(null); setActiveZone(zone); }
  }
  function finishTransition(gate: NonNullable<typeof transition>) {
    if (transitionToken.current !== gate.token) return;
    transitionToken.current++;
    setTransition(null); setActiveZone(gate.zone);
  }
  function finishIntro() { setIntroDismissed(true); setMapEntered(true); }
  function closeEditor() { editor.current?.close(); setEditorOpen(false); }
  function applyConfig(value: unknown): string | null | Promise<string | null> {
    if (persistDemoConfig) {
      return persistDemoConfig(value).then(saved => {
        if (!saved.config) return saved.error ?? 'No se pudo guardar la presentación.';
        setPersistedConfig(saved.config);
        acceptConfig(saved.config);
        setNotice('Presentación guardada para esta inmobiliaria. El catálogo real no se modificó.');
        closeEditor();
        return null;
      }).catch(() => 'No se pudo guardar la presentación. No se aplicaron los cambios.');
    }
    try {
      const saved = saveDemoConfig(window.localStorage, value);
      if (!saved.config) return saved.error;
      acceptConfig(saved.config);
      setNotice('Presentación guardada solo en este navegador. El catálogo real no se modificó.');
      closeEditor();
      return null;
    } catch { return 'No se pudo guardar la presentación. No se aplicaron los cambios.'; }
  }

  return <section className={`${styles.presentation} ${experienceStyles.experience}`} aria-label={title}>
    {mapEntered && <div className={styles.scene}>
      {appearance.mode === 'artwork' ? <PresentationArtworkMap appearance={appearance} areas={areas} pointsOfInterest={mapPoints} onAreaSelect={openZone} /> : <CityMap properties={mapProperties} selected={selectedSharedMarker?.id ?? null}
        onSelect={id => { if (sharedCatalogue && id < 0) { const property = properties[-id - 1]; if (property) selectShared(property.id); return; } setSelectedSharedId(null); const zoneId = tourIdForMapProperty(id); if (zoneId) openZone(zoneId); }}
        onAreaSelect={openZone} visible={!blocked} overview appearance={appearance} pointsOfInterest={mapPoints}
        controlsBlocked={blocked} focusProperty={selectedSharedMarker} focusRevision={sharedFocusRevision}
        areas={areas} zoneRevision={zoneRevision} onSearchArea={() => {}} />}
    </div>}
    {!settings && <p className={styles.loading} role="status">Cargando la presentación de la inmobiliaria…</p>}
    <header className={styles.intro}>
      <span className={styles.eyebrow}>PRESENTACIÓN INTERACTIVA · RÍO CUARTO</span>
      <h1>Una nueva forma de<br /><em>explorar propiedades.</em></h1>
      <p>Elige una zona del mapa para verla desde arriba. Descubre sus propiedades y entra a recorrerlas en video.</p>
      <div className={styles.steps}><span>01 · Elige una zona</span><span>02 · Explora desde arriba</span><span>03 · Entra a la propiedad</span></div>
      {settings?.intro.videoUrl && <button className={styles.replay} onClick={() => setIntroDismissed(false)}>Ver presentación de la inmobiliaria</button>}
      <button className={styles.edit} onClick={() => setEditorOpen(true)}><SlidersHorizontal size={15} /> Personalizar presentación</button>
    </header>
    {sharedCatalogue && !blocked && <aside className={styles.sharedCatalogue} aria-label="Propiedades reales compartidas">
      <details open>
        <summary>Propiedades reales compartidas ({properties.length})</summary>
        <p>Los recorridos de ejemplo son independientes de estas propiedades.</p>
        {properties.length === 0 ? <p>No hay propiedades reales compartidas en este vínculo.</p> : <ul>
          {properties.map(property => <li key={property.id}>
            <button type="button" aria-pressed={selectedSharedId === property.id} onClick={() => selectShared(property.id)}>
              <strong>{property.title}</strong>
              <span>{new Intl.NumberFormat('es-AR', { style: 'currency', currency: property.currency, maximumFractionDigits: 0 }).format(property.price)}</span>
              <small>{property.ownerAgency} · {property.neighborhood}</small>
              {(property.latitude === null || property.longitude === null) && <small>Sin ubicación en el mapa</small>}
            </button>
          </li>)}
        </ul>}
        {selectedShared && <div aria-live="polite">
          <strong>{selectedShared.title}</strong><p>Propiedad real · {selectedShared.status}</p>
          <p>Inmobiliaria: {selectedShared.ownerAgency}</p>
          <button type="button" onClick={() => setSelectedSharedId(null)}>Cerrar selección</button>
        </div>}
      </details>
    </aside>}
    <nav className={styles.zones} aria-label="Zonas de la presentación">
      <div className={styles.zoneHeading}><MapPinned size={18} /><span>¿Dónde quieres explorar?<small>Selecciona un cuadrado en el mapa o una zona aquí.</small></span></div>
      <div className={styles.zoneButtons}>{areas.map((area, index) => <button key={area.id} onClick={() => openZone(area.id)}>
        <span className={styles.number}>0{index + 1}</span><span><strong>{area.label}</strong><small>6 propiedades de ejemplo · Vista aérea</small></span><ArrowUpRight size={20} />
      </button>)}</div>
      <p className={styles.disclaimer}>{sharedCatalogue ? 'Las zonas y los recorridos ficticios son ejemplos; no representan las propiedades reales compartidas del catálogo.' : 'Propiedades ficticias y zonas ilustrativas. Los videos de muestra no representan los inmuebles del mapa.'} {persistSettings ? 'La personalización se guarda para esta inmobiliaria.' : 'La personalización se guarda localmente.'} Los registros reales no se modifican.</p>
    </nav>
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {showingIntro && <PresentationVideo key={`intro-${agencyId}-${settings.intro.videoUrl}`} src={settings.intro.videoUrl} title={`Bienvenidos a ${agencyName}`} continueLabel="Omitir y ver el mapa" onContinue={finishIntro} />}
    {transition && <PresentationVideo key={`zone-${transition.token}`} src={transition.src} title={`De Río Cuarto a ${transition.zone.name}`} continueLabel="Omitir y explorar la zona" onContinue={() => finishTransition(transition)} onBack={() => { transitionToken.current++; setTransition(null); }} />}
    {activeZone && <WorkspaceAerialExperience zone={activeZone} settings={settings ?? undefined} pointsOfInterest={mapPoints}
      initialConfig={persistedConfig ?? (persistDemoConfig ? config : undefined)} persistDemoConfig={persistDemoConfig}
      onConfigSaved={saved => { setPersistedConfig(saved); acceptConfig(saved); }}
      onClose={() => { setActiveZone(null); reloadConfig(); }} />}
    <dialog ref={editor} className={experienceStyles.editorDialog} aria-label="Personalizar la presentación"
      onCancel={event => { event.preventDefault(); closeEditor(); }} onClose={() => setEditorOpen(false)}>
      {editorOpen && <><button className={styles.closeSettings} onClick={closeEditor}>Cerrar personalización</button><AgencyPresentationSettings agencyId={agencyId} initialSettings={settings ?? initialSettings} onPersist={persistSettings} onSaved={setSettings} /><details className={styles.templates}><summary>Editar las plantillas de propiedades de ejemplo</summary><TourDemoEditor config={config} onSave={applyConfig} onClose={closeEditor} persisted={!!persistDemoConfig} /></details></>}
    </dialog>
    <span className={styles.catalogue}>Catálogo real sin cambios: {properties.length} propiedades · {zones.length} barrios · {points.length} puntos de interés</span>
  </section>;
}
