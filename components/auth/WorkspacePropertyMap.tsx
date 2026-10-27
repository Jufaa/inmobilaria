'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import styles from './workspace-property-map.module.css';
import { WorkspaceAerialExperience } from './WorkspaceAerialExperience';
import type { PresentationZone } from '@/lib/workspace-aerial-presentation';

export type WorkspaceMapProperty = {
  id: string;
  title: string;
  status: string;
  price: number;
  currency: 'ARS' | 'USD';
  neighborhood: string;
  latitude: number | null;
  longitude: number | null;
  zoneId?: string | null;
  ownerAgency?: string;
};

export type WorkspaceMapZone = {
  id: string;
  name: string;
  city: string;
  geometry: unknown;
  latitude: number | null;
  longitude: number | null;
};

export type WorkspaceMapPoint = {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
};

const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
const hasToken = !!token?.startsWith('pk.');
const imageBounds = {
  west: -64.4255,
  east: -64.236,
  north: -33.063,
  south: -33.192,
};
type MapPosition = [number, number, number?];
type BoundaryGeometry =
  | { type: 'Polygon'; coordinates: MapPosition[][] }
  | { type: 'MultiPolygon'; coordinates: MapPosition[][][] };
type BoundaryFeature = { type: 'Feature'; id: string; properties: { name: string }; geometry: BoundaryGeometry };
type BoundaryFeatureCollection = { type: 'FeatureCollection'; features: BoundaryFeature[] };

function formatPrice(value: number, currency: string) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function belongsToZone(property: WorkspaceMapProperty, zone: WorkspaceMapZone) {
  if (property.zoneId) return property.zoneId === zone.id;
  return property.neighborhood.trim().toLocaleLowerCase('es-AR') === zone.name.trim().toLocaleLowerCase('es-AR');
}

export default function WorkspacePropertyMap({
  title,
  properties,
  zones = [],
  points = [],
  enableAerialPresentation = false,
}: {
  title: string;
  properties: WorkspaceMapProperty[];
  zones?: WorkspaceMapZone[];
  points?: WorkspaceMapPoint[];
  enableAerialPresentation?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<import('mapbox-gl').Map | null>(null);
  const markers = useRef<import('mapbox-gl').Marker[]>([]);
  const hoveredFeature = useRef<string | number | null>(null);
  const selectedFeature = useRef<string | number | null>(null);
  const referenceZones = useRef(new Map<string, BoundaryFeature>());
  const [presentationZone, setPresentationZone] = useState<PresentationZone | null>(null);
  const [status, setStatus] = useState<'missing' | 'loading' | 'ready' | 'error' | 'unsupported'>(hasToken ? 'loading' : 'missing');
  const [boundaryStatus, setBoundaryStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const located = useMemo(() => properties.filter((property) => property.latitude !== null && property.longitude !== null), [properties]);
  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) ?? null;

  useEffect(() => {
    if (!host.current || !hasToken) return;
    let disposed = false;
    let instance: import('mapbox-gl').Map | null = null;
    let observer: ResizeObserver | undefined;

    void import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (disposed || !host.current) return;
      if (!mapboxgl.supported()) { setStatus('unsupported'); return; }
      instance = new mapboxgl.Map({
        container: host.current,
        accessToken: token,
        style: {
          version: 8,
          sources: {},
          layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#243029' } }],
        },
        center: [-64.331, -33.127],
        zoom: 11.4,
        projection: 'mercator',
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      });
      map.current = instance;
      instance.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      instance.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
      instance.on('load', () => {
        const mapInstance = instance;
        if (disposed || !mapInstance) return;
        mapInstance.addSource('rioiv-base', {
          type: 'image',
          url: '/maps/rio-cuarto/reference-map.webp',
          coordinates: [
            [imageBounds.west, imageBounds.north],
            [imageBounds.east, imageBounds.north],
            [imageBounds.east, imageBounds.south],
            [imageBounds.west, imageBounds.south],
          ],
        });
        mapInstance.addLayer({ id: 'rioiv-base-raster', type: 'raster', source: 'rioiv-base', paint: { 'raster-opacity': 1 } });
        mapInstance.fitBounds([[imageBounds.west, imageBounds.south], [imageBounds.east, imageBounds.north]], { padding: 0, duration: 0 });
        setStatus('ready');

        void fetch('/maps/rio-cuarto/reference-zones.geojson').then(async (response) => {
          if (!response.ok) throw new Error('No se pudieron cargar las zonas del mapa.');
          return await response.json() as BoundaryFeatureCollection;
        }).then((data) => {
          if (disposed) return;
          referenceZones.current = new Map(data.features.map(feature => [String(feature.id),feature]));
          mapInstance.addSource('reference-zones', { type: 'geojson', data: data as never });
          mapInstance.addLayer({
            id: 'reference-zones-fill',
            type: 'fill',
            source: 'reference-zones',
            paint: {
              'fill-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#1745ff', ['boolean', ['feature-state', 'hover'], false], '#1745ff', '#1745ff'],
              'fill-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.22, ['boolean', ['feature-state', 'hover'], false], 0.3, 0.001],
            },
          });
          setBoundaryStatus('ready');

          mapInstance.on('mousemove', 'reference-zones-fill', (event) => {
            const feature = event.features?.[0] as { id?: string | number; properties?: { name?: unknown } } | undefined;
            if (feature?.id === undefined) return;
            if (hoveredFeature.current !== null && hoveredFeature.current !== feature.id) {
              mapInstance.setFeatureState({ source: 'reference-zones', id: hoveredFeature.current }, { hover: false });
            }
            hoveredFeature.current = feature.id;
            mapInstance.getCanvas().style.cursor = 'pointer';
            mapInstance.setFeatureState({ source: 'reference-zones', id: feature.id }, { hover: true });
            setHoveredName(typeof feature.properties?.name === 'string' ? feature.properties.name : 'Zona');
          });
          mapInstance.on('mouseleave', 'reference-zones-fill', () => {
            mapInstance.getCanvas().style.cursor = '';
            if (hoveredFeature.current !== null) mapInstance.setFeatureState({ source: 'reference-zones', id: hoveredFeature.current }, { hover: false });
            hoveredFeature.current = null;
            setHoveredName(null);
          });
          mapInstance.on('click', 'reference-zones-fill', (event) => {
            const feature = event.features?.[0] as { id?: string | number } | undefined;
            if (feature?.id === undefined) return;
            if (selectedFeature.current !== null) {
              mapInstance.setFeatureState({ source: 'reference-zones', id: selectedFeature.current }, { selected: false });
            }
            selectedFeature.current = selectedFeature.current === feature.id ? null : feature.id;
            if (selectedFeature.current !== null) mapInstance.setFeatureState({ source: 'reference-zones', id: feature.id }, { selected: true });
            if (enableAerialPresentation) {
              const selected = referenceZones.current.get(String(feature.id));
              if (selected) setPresentationZone({ id: String(selected.id), name: selected.properties.name, geometry: selected.geometry });
            }
          });
        }).catch(() => { if (!disposed) setBoundaryStatus('error'); });
      });
      instance.on('error', () => { if (!disposed) setStatus('error'); });
      observer = new ResizeObserver(() => instance?.resize());
      observer.observe(host.current);
    }).catch(() => { if (!disposed) setStatus('error'); });

    return () => {
      disposed = true;
      observer?.disconnect();
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      map.current?.remove();
      map.current = null;
    };
  }, [enableAerialPresentation]);

  useEffect(() => {
    const instance = map.current;
    if (status !== 'ready' || !instance) return;
    let active = true;
    void import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (!active || !map.current) return;
      markers.current.forEach((marker) => marker.remove());
      const visibleProperties = selectedZone ? located.filter((property) => belongsToZone(property, selectedZone)) : located;
      const propertyMarkers = visibleProperties.map((property) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = styles.propertyPin;
        button.dataset.status = property.status.toLowerCase();
        button.textContent = formatPrice(property.price, property.currency);
        button.setAttribute('aria-label', `${property.title} · ${property.status} · ${formatPrice(property.price, property.currency)}`);
        button.addEventListener('click', () => {
          const card = document.createElement('article');
          card.className = styles.popup;
          const heading = document.createElement('h3');
          heading.textContent = property.title;
          const line = document.createElement('p');
          line.textContent = `${formatPrice(property.price, property.currency)} · ${property.neighborhood}`;
          const state = document.createElement('span');
          state.textContent = property.status;
          card.append(heading, line, state);
          if (property.ownerAgency) {
            const owner = document.createElement('p');
            owner.textContent = `Inmobiliaria: ${property.ownerAgency}`;
            card.append(owner);
          }
          new mapboxgl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '300px', offset: 16 })
            .setLngLat([property.longitude!, property.latitude!])
            .setDOMContent(card)
            .addTo(instance);
        });
        return new mapboxgl.Marker({ element: button, anchor: 'bottom' }).setLngLat([property.longitude!, property.latitude!]).addTo(instance);
      });
      const zoneMarkers = zones.filter((zone) => zone.latitude !== null && zone.longitude !== null).map((zone) => {
        const node = document.createElement('span');
        node.className = styles.zonePin;
        node.textContent = zone.name;
        node.title = `${zone.name} · ${zone.city}`;
        return new mapboxgl.Marker({ element: node, anchor: 'bottom' }).setLngLat([zone.longitude!, zone.latitude!]).addTo(instance);
      });
      const pointMarkers = points.map((point) => {
        const node = document.createElement('span');
        node.className = styles.pointPin;
        node.title = `${point.name} · ${point.category}`;
        node.setAttribute('aria-label', node.title);
        return new mapboxgl.Marker({ element: node, anchor: 'center' }).setLngLat([point.longitude, point.latitude]).addTo(instance);
      });
      markers.current = [...propertyMarkers, ...zoneMarkers, ...pointMarkers];

      if (selectedZone?.longitude !== null && selectedZone?.longitude !== undefined && selectedZone.latitude !== null) {
        instance.easeTo({ center: [selectedZone.longitude, selectedZone.latitude], zoom: 14, duration: 450 });
      } else if (selectedZone === null) {
        instance.fitBounds([[imageBounds.west, imageBounds.south], [imageBounds.east, imageBounds.north]], { padding: 28, maxZoom: 12, duration: 400 });
      }
    }).catch(() => setStatus('error'));
    return () => { active = false; };
  }, [located, zones, points, status, selectedZone]);

  if (!presentationZone && status === 'missing') return <div className={styles.message}>Configurá NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN para ver el mapa interactivo.</div>;
  if (!presentationZone && status === 'unsupported') return <div className={styles.message}>Este navegador no permite mostrar el mapa interactivo.</div>;
  if (!presentationZone && status === 'error') return <div className={styles.message}>No se pudo cargar el mapa. Revisá el token y la conexión.</div>;

  return (
    <section className={styles.frame} aria-label={title}>
      <header className={styles.mapHeader}>
        <div className={styles.mapTitle}>
          <span className={styles.eyebrow}>{enableAerialPresentation ? 'Vista de presentación · Propiedades de ejemplo' : 'Vista general'}</span>
          <h1>{title}</h1>
          <p>{enableAerialPresentation ? 'Selecciona un cuadrado para explorar la zona desde arriba y entrar a sus propiedades de ejemplo. Los registros reales no se modifican.' : 'Pasá por un barrio para resaltarlo. Seleccionalo para dejarlo marcado.'}</p>
        </div>
        <div className={styles.propertyCount} aria-live="polite">
          <strong>{located.length}</strong>
          <span>{located.length === 1 ? 'propiedad ubicada' : 'propiedades ubicadas'}</span>
        </div>
      </header>
      {zones.length > 0 && <nav className={styles.zoneChooser} aria-label="Barrios de la inmobiliaria">
        <strong>Explorá por barrio</strong>
        <div className={styles.zoneOptions}>
          {zones.map((zone) => <button key={zone.id} type="button" className={styles.zoneOption} data-active={selectedZoneId === zone.id} aria-pressed={selectedZoneId === zone.id} onClick={() => { setSelectedZoneId((current) => current === zone.id ? null : zone.id); if (enableAerialPresentation) setPresentationZone(zone); }}>{zone.name}</button>)}
          <button type="button" className={styles.zoneOption} data-active={selectedZoneId === null} aria-pressed={selectedZoneId === null} onClick={() => setSelectedZoneId(null)}>Todos</button>
        </div>
      </nav>}
      {enableAerialPresentation && boundaryStatus === 'ready' && <nav className={styles.zoneChooser} aria-label="Zonas disponibles para la presentación">
        <strong>Abrir vista aérea</strong><div className={styles.zoneOptions}>
          {Array.from(referenceZones.current.values()).map(zone => <button key={zone.id} className={styles.zoneOption} aria-haspopup="dialog" onClick={() => setPresentationZone({ id: String(zone.id), name: zone.properties.name, geometry: zone.geometry })}>{zone.properties.name}</button>)}
        </div>
      </nav>}
      <div className={styles.mapViewport}>
        <div className={styles.map} ref={host} aria-label={title} />
        <a className={styles.sourceLink} href="https://rioiv.netlify.app/" target="_blank" rel="noreferrer">Base del mapa · Río IV</a>
        {status === 'loading' && <div className={styles.overlay}>Cargando mapa…</div>}
        {status === 'ready' && boundaryStatus === 'loading' && <div className={styles.boundaryNotice}>Cargando límites de barrios…</div>}
        {status === 'ready' && boundaryStatus === 'error' && <div className={styles.boundaryNotice}>No se pudieron cargar los límites vecinales.</div>}
        {hoveredName && <div className={styles.areaTooltip} role="status">{hoveredName}</div>}
        {status === 'ready' && located.length === 0 && zones.length === 0 && points.length === 0 && <div className={styles.overlay}>Todavía no hay propiedades con coordenadas para mostrar.</div>}
      </div>
      {enableAerialPresentation && presentationZone && <WorkspaceAerialExperience key={presentationZone.id} zone={presentationZone} onClose={() => setPresentationZone(null)} />}
    </section>
  );
}
