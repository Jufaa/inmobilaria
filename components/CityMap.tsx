'use client';

import { useEffect, useRef, useState } from 'react';
import { formatPrice } from '@/lib/properties';
import {
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Scan,
  Search,
} from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import type { Property } from '@/lib/properties';
import type { MapBounds, Zone } from '@/lib/zones';

type Props = {
  properties: Property[];
  selected: number | null;
  onSelect: (id: number) => void;
  visible: boolean;
  focusProperty: Property | null;
  focusRevision: number;
  areas: Zone[];
  zoneRevision: number;
  onSearchArea: (bounds: MapBounds) => void;
};
type MapState = 'missing' | 'loading' | 'ready' | 'error' | 'unsupported';
const initialView = {
  center: [-64.3488, -33.1231] as [number, number],
  zoom: 15.4,
  pitch: 45,
  bearing: 0,
};
const publicToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
const hasPublicToken = !!publicToken?.startsWith('pk.');

export default function CityMap({
  properties,
  selected,
  onSelect,
  visible,
  focusProperty,
  focusRevision,
  areas,
  zoneRevision,
  onSearchArea,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markers = useRef(new Map<string, mapboxgl.Marker>());
  const lastSourceProperties = useRef<Property[] | null>(null);
  const handledFocusRevision = useRef(0);
  const handledZoneRevision = useRef(0);
  const [areaDirty, setAreaDirty] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [state, setState] = useState<MapState>(
    hasPublicToken ? 'loading' : 'missing',
  );
  const [message, setMessage] = useState('');
  const [flat, setFlat] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [mapGeneration, setMapGeneration] = useState(0);

  useEffect(() => {
    if (!host.current || !hasPublicToken) return;
    if (!mapboxgl.supported()) {
      setState('unsupported');
      return;
    }
    setState('loading');
    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: host.current,
        accessToken: publicToken,
        style: 'mapbox://styles/mapbox/standard',
        ...initialView,
        minZoom: 10,
        maxZoom: 20,
        maxPitch: 70,
        attributionControl: false,
        logoPosition: 'bottom-left',
        config: {
          basemap: {
            theme: 'default',
            lightPreset: 'day',
            show3dBuildings: true,
            show3dTrees: false,
            show3dLandmarks: false,
            show3dFacades: false,
            showPointOfInterestLabels: false,
            showTransitLabels: false,
            colorBuildings: '#d4cbc0',
            colorLand: '#f2ede4',
            colorWater: '#a9cddd',
            colorRoads: '#ffffff',
            colorGreenspace: '#bed3b7',
          },
        },
      });
    } catch {
      setState('error');
      setMessage(
        'No pudimos iniciar el mapa. Revisá tu conexión y la configuración de Mapbox.',
      );
      return;
    }
    mapRef.current = map;
    handledFocusRevision.current = 0;
    handledZoneRevision.current = 0;
    setMapGeneration((generation) => generation + 1);
    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      'bottom-right',
    );
    map.addControl(
      new mapboxgl.ScaleControl({ maxWidth: 75, unit: 'metric' }),
      'bottom-right',
    );
    map.on('load', () => setState('ready'));
    map.on('pitchend', () => setFlat(map.getPitch() < 5));
    map.on('moveend', () => setAreaDirty(true));
    map.on('error', (event) => {
      // Never expose provider error strings: request URLs can contain the token.
      const status = (event.error as Error & { status?: number }).status;
      setState('error');
      setMessage(
        status === 401 || status === 403
          ? 'Mapbox no autorizó la conexión. Revisá el token público y los dominios permitidos en tu cuenta.'
          : 'No pudimos cargar el mapa. Revisá tu conexión o la configuración de Mapbox.',
      );
    });
    const observer = new ResizeObserver(() => {
      if (
        host.current &&
        host.current.clientWidth > 0 &&
        host.current.clientHeight > 0
      )
        map.resize();
    });
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      markers.current.forEach((marker) => marker.remove());
      markers.current.clear();
      mapRef.current = null;
      map.remove();
    };
  }, [attempt]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || state !== 'ready') return;
    const sourceId = 'property-catalog';
    const data = {
      type: 'FeatureCollection' as const,
      features: properties.map((property) => ({
        type: 'Feature' as const,
        properties: { propertyId: property.id },
        geometry: {
          type: 'Point' as const,
          coordinates: [property.longitude, property.latitude],
        },
      })),
    };
    let source = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
    if (!source) {
      map.addSource(sourceId, {
        type: 'geojson',
        data,
        cluster: true,
        clusterRadius: 55,
        clusterMaxZoom: 15,
      });
      map.addLayer({
        id: 'property-source-loader',
        type: 'circle',
        source: sourceId,
        slot: 'top',
        paint: { 'circle-radius': 1, 'circle-opacity': 0 },
      });
      source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
      lastSourceProperties.current = properties;
    } else if (lastSourceProperties.current !== properties) {
      source.setData(data);
      lastSourceProperties.current = properties;
    }
    const lookup = new Map(
      properties.map((property) => [property.id, property]),
    );
    let frame = 0;
    const updateMarkers = () => {
      frame = 0;
      if (!visible || !map.isSourceLoaded(sourceId)) return;
      const width = map.getCanvas().clientWidth,
        height = map.getCanvas().clientHeight;
      const wanted = new Set<string>();
      for (const sourceFeature of map.querySourceFeatures(sourceId)) {
        const feature = sourceFeature.toJSON() as {
          geometry: { type: string; coordinates: [number, number] };
          properties: Record<string, unknown> | null;
        };
        if (feature.geometry.type !== 'Point') continue;
        const coordinates = feature.geometry.coordinates as [number, number];
        const point = map.project(coordinates);
        if (point.x < 0 || point.y < 0 || point.x > width || point.y > height)
          continue;
        const cluster = !!feature.properties?.cluster;
        const id = Number(
          cluster
            ? feature.properties?.cluster_id
            : feature.properties?.propertyId,
        );
        const property = lookup.get(id);
        if (!cluster && !property) continue;
        const key = `${cluster ? 'cluster' : 'property'}-${id}`;
        if (wanted.has(key)) continue;
        wanted.add(key);
        let marker = markers.current.get(key);
        if (!marker) {
          const root = document.createElement('div');
          root.className = 'property-map-marker';
          const button = document.createElement('button');
          button.type = 'button';
          button.className = cluster ? 'map-cluster' : 'map-pin geo-pin';
          root.append(button);
          button.addEventListener('click', () => {
            if (!cluster) {
              onSelectRef.current(id);
              return;
            }
            const current = map.getSource(sourceId) as
              | mapboxgl.GeoJSONSource
              | undefined;
            current?.getClusterExpansionZoom(id, (error, zoom) => {
              if (
                error ||
                zoom === null ||
                zoom === undefined ||
                mapRef.current !== map
              )
                return;
              map.easeTo({
                center: [
                  Number(button.dataset.longitude),
                  Number(button.dataset.latitude),
                ],
                zoom,
                duration: window.matchMedia('(prefers-reduced-motion: reduce)')
                  .matches
                  ? 0
                  : 450,
              });
            });
          });
          marker = new mapboxgl.Marker({
            element: root,
            anchor: cluster ? 'center' : 'bottom',
          })
            .setLngLat(coordinates)
            .addTo(map);
          markers.current.set(key, marker);
        }
        const position = marker.getLngLat();
        if (position.lng !== coordinates[0] || position.lat !== coordinates[1])
          marker.setLngLat(coordinates);
        const button = marker.getElement().querySelector('button')!;
        button.dataset.longitude = String(coordinates[0]);
        button.dataset.latitude = String(coordinates[1]);
        if (cluster) {
          const count = Number(feature.properties?.point_count);
          button.textContent = String(count);
          button.setAttribute(
            'aria-label',
            `Acercar grupo de ${count} propiedades`,
          );
        } else if (property) {
          button.textContent = `${selected === id ? '✓ ' : ''}${formatPrice(property.price, property.currency ?? 'USD')}`;
          button.append(document.createElement('span'));
          button.classList.toggle('active', selected === id);
          button.setAttribute(
            'aria-label',
            `Ver ${property.address}, ${formatPrice(property.price, property.currency ?? 'USD')}`,
          );
          button.setAttribute('aria-pressed', String(selected === id));
        }
        marker.getElement().style.zIndex =
          !cluster && selected === id ? '3' : '2';
      }
      markers.current.forEach((marker, key) => {
        if (!wanted.has(key)) {
          marker.remove();
          markers.current.delete(key);
        }
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(updateMarkers);
    };
    const onSource = (event: mapboxgl.MapSourceDataEvent) => {
      if (event.sourceId === sourceId) schedule();
    };
    map.on('moveend', schedule);
    map.on('sourcedata', onSource);
    map.on('idle', schedule);
    schedule();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      map.off('moveend', schedule);
      map.off('sourcedata', onSource);
      map.off('idle', schedule);
    };
  }, [properties, selected, mapGeneration, state, visible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    const frame = requestAnimationFrame(() => {
      map.resize();
      if (focusProperty && focusRevision > handledFocusRevision.current) {
        handledFocusRevision.current = focusRevision;
        map.flyTo({
          center: [focusProperty.longitude, focusProperty.latitude],
          zoom: 16.2,
          pitch: 45,
          bearing: 0,
          duration: window.matchMedia('(prefers-reduced-motion: reduce)')
            .matches
            ? 0
            : 550,
        });
      }
    });
    return () => cancelAnimationFrame(frame);
    // Camera changes follow explicit selections and view switches, never filter edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRevision, visible, mapGeneration]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || state !== 'ready') return;
    const features = areas.map((area) => {
      const bounds = area.bounds;
      return {
        type: 'Feature' as const,
        properties: { label: `${area.label} · Área orientativa` },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [
            [
              [bounds.west, bounds.south],
              [bounds.east, bounds.south],
              [bounds.east, bounds.north],
              [bounds.west, bounds.north],
              [bounds.west, bounds.south],
            ],
          ],
        },
      };
    });
    const data = { type: 'FeatureCollection' as const, features };
    const source = map.getSource('search-zone') as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (source) source.setData(data);
    else {
      map.addSource('search-zone', { type: 'geojson', data });
      map.addLayer({
        id: 'search-zone-fill',
        type: 'fill',
        source: 'search-zone',
        slot: 'middle',
        paint: { 'fill-color': '#0f766e', 'fill-opacity': 0.045 },
      });
      map.addLayer({
        id: 'search-zone-outline',
        type: 'line',
        source: 'search-zone',
        slot: 'middle',
        paint: {
          'line-color': '#0f766e',
          'line-width': 2,
          'line-dasharray': [3, 2],
          'line-opacity': 0.8,
        },
      });
      map.addLayer({
        id: 'search-zone-label',
        type: 'symbol',
        source: 'search-zone',
        slot: 'top',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 13,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        },
        paint: {
          'text-color': '#115e59',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
      });
    }
    if (areas.length && visible && zoneRevision > handledZoneRevision.current) {
      handledZoneRevision.current = zoneRevision;
      const bounds = new mapboxgl.LngLatBounds();
      areas.forEach((area) => {
        bounds.extend([area.bounds.west, area.bounds.south]);
        bounds.extend([area.bounds.east, area.bounds.north]);
      });
      const mobile = (host.current?.clientWidth ?? 1200) < 900;
      const height = host.current?.clientHeight ?? 700;
      map.fitBounds(bounds, {
        padding: mobile
          ? {
              top: Math.min(320, height * 0.4),
              right: 30,
              bottom: Math.min(175, height * 0.25),
              left: 30,
            }
          : { top: 50, right: 120, bottom: 180, left: 450 },
        maxZoom: 15.5,
        pitch: 45,
        bearing: 0,
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 0
          : 650,
      });
    }
  }, [areas, zoneRevision, mapGeneration, visible, state]);

  const searchArea = () => {
    const bounds = mapRef.current?.getBounds();
    if (!bounds) return;
    onSearchArea({
      west: bounds.getWest(),
      east: bounds.getEast(),
      south: bounds.getSouth(),
      north: bounds.getNorth(),
    });
    setAreaDirty(false);
  };

  const fitResults = () => {
    const map = mapRef.current;
    if (!map || !properties.length) return;
    const bounds = new mapboxgl.LngLatBounds();
    properties.forEach((property) =>
      bounds.extend([property.longitude, property.latitude]),
    );
    const mobile = (host.current?.clientWidth ?? 1000) < 900;
    const height = host.current?.clientHeight ?? 700;
    map.fitBounds(bounds, {
      padding: {
        top: mobile ? Math.min(320, height * 0.45) : 70,
        right: mobile ? 35 : 130,
        bottom: mobile ? Math.min(180, height * 0.25) : 190,
        left: mobile ? 35 : 450,
      },
      maxZoom: 16,
      pitch: 50,
      bearing: 0,
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 0
        : 900,
    });
  };

  const reducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reset = () =>
    mapRef.current?.easeTo({
      ...initialView,
      duration: reducedMotion() ? 0 : 700,
    });
  const toggle = () => {
    const map = mapRef.current;
    if (map)
      map.easeTo({
        pitch: flat ? initialView.pitch : 0,
        duration: reducedMotion() ? 0 : 650,
      });
  };
  const rotate = (degrees: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      bearing: map.getBearing() + degrees,
      duration: reducedMotion() ? 0 : 350,
    });
  };
  const available = state === 'ready';
  const showFallback =
    state === 'missing' || state === 'error' || state === 'unsupported';
  return (
    <div
      className="map-stage geographic-map"
      role="region"
      aria-label="Mapa de propiedades en Río Cuarto"
    >
      <div className="mapbox-host" ref={host} />
      <div className="map-top">
        <span className="map-location">
          <span className="live-dot" /> Río Cuarto{' '}
          <span className="map-location-sub">Córdoba, Argentina</span>
        </span>
        <button
          className="map-dimension"
          onClick={toggle}
          disabled={!available}
          aria-label={
            flat ? 'Activar vista tridimensional' : 'Activar vista plana'
          }
        >
          {flat ? '3D' : '2D'}
          <span>{flat ? 'Ver en 3D' : 'Vista plana'}</span>
        </button>
      </div>
      {state === 'ready' && (
        <button
          className={`search-area-button ${areaDirty ? 'area-dirty' : ''}`}
          onClick={searchArea}
        >
          <Search size={15} /> Buscar en esta zona
        </button>
      )}
      {state === 'loading' && (
        <div className="map-loading-overlay" role="status">
          <span className="spinner" /> Cargando Río Cuarto…
        </div>
      )}
      {showFallback && (
        <div className="map-activation" role="status">
          <div className="map-activation-icon">
            <MapPin size={26} strokeWidth={1} />
          </div>
          <p className="eyebrow">RÍO CUARTO · MAPBOX</p>
          <h3>
            {state === 'missing'
              ? 'La ciudad, en otra dimensión.'
              : state === 'unsupported'
                ? 'Tu navegador necesita otra perspectiva.'
                : 'El mapa está tomando una pausa.'}
          </h3>
          <p>
            {state === 'missing'
              ? 'El mapa real en 3D está integrado. Falta conectar el token público de Mapbox para recorrer la ciudad.'
              : state === 'unsupported'
                ? 'Este navegador no tiene WebGL disponible para mostrar el mapa. Podés seguir explorando las propiedades en el listado.'
                : message}
          </p>
          {state === 'missing' ? (
            <span className="activation-note">
              Configuración pendiente · El catálogo ya está disponible
            </span>
          ) : state === 'error' ? (
            <button
              className="activation-retry"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Reintentar conexión <RotateCcw size={14} />
            </button>
          ) : null}
        </div>
      )}
      <div className="map-tools">
        <button
          onClick={() =>
            mapRef.current?.zoomIn({ duration: reducedMotion() ? 0 : 300 })
          }
          disabled={!available}
          aria-label="Acercar mapa"
        >
          <Plus size={19} />
          <small>Acercar</small>
        </button>
        <button
          onClick={() =>
            mapRef.current?.zoomOut({ duration: reducedMotion() ? 0 : 300 })
          }
          disabled={!available}
          aria-label="Alejar mapa"
        >
          <Minus size={19} />
          <small>Alejar</small>
        </button>
        <button
          onClick={() => rotate(-30)}
          disabled={!available}
          aria-label="Girar a la izquierda"
        >
          <RotateCcw size={19} />
          <small>Girar izquierda</small>
        </button>
        <button
          onClick={() => rotate(30)}
          disabled={!available}
          aria-label="Girar a la derecha"
        >
          <RotateCw size={19} />
          <small>Girar derecha</small>
        </button>
        <button
          onClick={fitResults}
          disabled={!available || !properties.length}
          aria-label="Mostrar todas las propiedades filtradas"
        >
          <Scan size={18} />
          <small>Ver propiedades</small>
        </button>
        <button
          onClick={reset}
          disabled={!available}
          aria-label="Restablecer mapa"
        >
          <RotateCcw size={17} />
          <small>Restablecer mapa</small>
        </button>
      </div>
      <div className="geographic-map-note">
        {available
          ? 'Arrastrá para moverte · Ctrl + arrastrar para inclinar y girar'
          : 'Un lugar para tu próxima historia'}
        <span>Propiedades de ejemplo · Ubicaciones aproximadas</span>
      </div>
    </div>
  );
}
