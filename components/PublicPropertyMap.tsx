'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { PublicPointOfInterest, PublicProperty, PublicZone } from '@/lib/properties/public-property-service';
import { trackPublicAnalytics } from './PublicAnalyticsEvent';
import styles from './public-property-discovery.module.css';

type Props = { properties: PublicProperty[]; zones: PublicZone[]; pointsOfInterest: PublicPointOfInterest[]; selectedZoneId: string; presentingAgencySlug?: string };
type MapStatus = 'missing' | 'loading' | 'ready' | 'error' | 'unsupported';

const publicToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
const hasToken = !!publicToken?.startsWith('pk.');

function getFeatureZoneId(feature: unknown): string | null {
  if (typeof feature !== 'object' || feature === null || !('properties' in feature)) return null;
  const properties = (feature as { properties?: unknown }).properties;
  if (typeof properties !== 'object' || properties === null || !('zoneId' in properties)) return null;
  const zoneId = (properties as { zoneId?: unknown }).zoneId;
  return typeof zoneId === 'string' ? zoneId : null;
}

function formatMarkerPrice(property: PublicProperty) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: property.currency,
    maximumFractionDigits: 0,
  }).format(property.price);
}

function showPropertyPreview(
  mapboxgl: typeof import('mapbox-gl'),
  map: import('mapbox-gl').Map,
  property: PublicProperty,
  presentingAgencySlug?: string,
): import('mapbox-gl').Popup {
  const content = document.createElement('article');
  content.className = styles.popup;

  const label = document.createElement('span');
  label.className = styles.popupEyebrow;
  label.textContent = property.operation === 'SALE' ? 'En venta' : 'En alquiler';

  const price = document.createElement('strong');
  price.className = styles.popupPrice;
  price.textContent = formatMarkerPrice(property);

  const title = document.createElement('h3');
  title.className = styles.popupTitle;
  title.textContent = property.title;

  const location = document.createElement('p');
  location.className = styles.popupLocation;
  location.textContent = `${property.neighborhood} · ${property.area} m² · ${property.bedrooms} dorm.`;

  const agency = document.createElement('p');
  agency.className = styles.popupAgency;
  agency.textContent = property.presentedByName
    ? `Presenta ${property.presentedByName} · ${property.agencyName}`
    : property.agencyName;

  const link = document.createElement('a');
  link.className = styles.popupLink;
  const query = presentingAgencySlug ? `?inmobiliaria=${encodeURIComponent(presentingAgencySlug)}` : '';
  link.href = `/explorar-propiedades/${encodeURIComponent(property.id)}${query}`;
  link.textContent = 'Ver propiedad';

  content.append(label, price, title, location, agency, link);
  return new mapboxgl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '300px', offset: 18 })
    .setLngLat([property.longitude!, property.latitude!])
    .setDOMContent(content)
    .addTo(map);
}

export default function PublicPropertyMap({ properties, zones, pointsOfInterest, selectedZoneId, presentingAgencySlug }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<import('mapbox-gl').Map | null>(null);
  const markers = useRef<import('mapbox-gl').Marker[]>([]);
  const propertyPopup = useRef<import('mapbox-gl').Popup | null>(null);
  const [status, setStatus] = useState<MapStatus>(hasToken ? 'loading' : 'missing');
  const locatedProperties = useMemo(
    () => properties.filter(
      (property) => property.latitude !== null && property.longitude !== null,
    ),
    [properties],
  );
  const mappedZones = useMemo(() => zones.filter((zone) => zone.geometry && typeof zone.geometry === 'object'), [zones]);

  function selectZone(zoneId: string) {
    trackPublicAnalytics({ type: 'ZONE_SELECTION', zoneId, ...(presentingAgencySlug ? { presentingAgencySlug } : {}) });
    const params = new URLSearchParams(window.location.search);
    params.set('zona', zoneId);
    params.delete('pagina');
    window.location.assign(`/explorar-propiedades?${params.toString()}`);
  }

  useEffect(() => {
    if (!host.current || !hasToken) return;
    let disposed = false;
    let instance: import('mapbox-gl').Map | undefined;

    async function initialize() {
      const mapboxgl = await import('mapbox-gl');
      if (disposed || !host.current) return;
      if (!mapboxgl.default.supported()) {
        setStatus('unsupported');
        return;
      }

      try {
        instance = new mapboxgl.Map({
          container: host.current,
          accessToken: publicToken,
          style: 'mapbox://styles/mapbox/standard',
          center: [-64.35, -33.12],
          zoom: 12,
          minZoom: 10,
          maxZoom: 18,
          attributionControl: false,
          config: {
            basemap: {
              theme: 'default',
              lightPreset: 'day',
              show3dBuildings: true,
              showPointOfInterestLabels: false,
              colorBuildings: '#d4cbc0',
              colorLand: '#f2ede4',
              colorWater: '#a9cddd',
              colorRoads: '#ffffff',
              colorGreenspace: '#bed3b7',
            },
          },
        });
      } catch {
        setStatus('error');
        return;
      }

      map.current = instance;
      instance.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
      instance.on('load', () => {
        if (mappedZones.length > 0) {
          const data = {
            type: 'FeatureCollection',
            features: mappedZones.map((zone) => ({
              type: 'Feature',
              id: zone.id,
              properties: { zoneId: zone.id, name: zone.name, selected: zone.id === selectedZoneId },
              geometry: zone.geometry,
            })),
          } as never;
          instance?.addSource('real-estate-zones', { type: 'geojson', data });
          instance?.addLayer({
            id: 'real-estate-zone-fill', type: 'fill', source: 'real-estate-zones',
            paint: { 'fill-color': '#4f806c', 'fill-opacity': ['case', ['get', 'selected'], 0.38, 0.16] },
          });
          instance?.addLayer({
            id: 'real-estate-zone-line', type: 'line', source: 'real-estate-zones',
            paint: { 'line-color': '#315d4c', 'line-width': ['case', ['get', 'selected'], 3, 1.5] },
          });
          instance?.on('click', 'real-estate-zone-fill', (event) => {
            const zoneId = getFeatureZoneId(event.features?.[0]);
            if (zoneId) selectZone(zoneId);
          });
          instance?.on('mouseenter', 'real-estate-zone-fill', () => { if (instance) instance.getCanvas().style.cursor = 'pointer'; });
          instance?.on('mouseleave', 'real-estate-zone-fill', () => { if (instance) instance.getCanvas().style.cursor = ''; });
        }
        if (!disposed) setStatus('ready');
      });
      instance.on('error', () => {
        if (!disposed) setStatus('error');
      });
      const observer = new ResizeObserver(() => instance?.resize());
      observer.observe(host.current);
      instance.once('remove', () => observer.disconnect());
    }

    void initialize().catch(() => setStatus('error'));
    return () => {
      disposed = true;
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      propertyPopup.current?.remove();
      propertyPopup.current = null;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (status !== 'ready' || !map.current) return;
    let active = true;
    void import('mapbox-gl').then((mapboxgl) => {
      if (!active || !map.current) return;
      markers.current.forEach((marker) => marker.remove());
      const propertyMarkers = locatedProperties.map((property) => {
        const node = document.createElement('button');
        node.type = 'button';
        node.className = styles.mapPin;
        node.textContent = formatMarkerPrice(property);
        node.setAttribute('aria-label', `${formatMarkerPrice(property)}: ${property.title}, ${property.neighborhood}`);
        node.addEventListener('click', () => {
          if (map.current) {
            propertyPopup.current?.remove();
            propertyPopup.current = showPropertyPreview(mapboxgl, map.current, property, presentingAgencySlug);
          }
        });
        return new mapboxgl.Marker({ element: node, anchor: 'bottom' })
          .setLngLat([property.longitude!, property.latitude!])
          .addTo(map.current!);
      });

      const zoneMarkers = zones.filter((zone) => zone.latitude !== null && zone.longitude !== null).map((zone) => {
        const node = document.createElement('button');
        node.type = 'button';
        node.className = styles.zonePin;
        node.textContent = zone.name;
        node.setAttribute('aria-label', `Explorar barrio ${zone.name}`);
        node.setAttribute('aria-pressed', String(zone.id === selectedZoneId));
        node.addEventListener('click', () => selectZone(zone.id));
        return new mapboxgl.Marker({ element: node, anchor: 'bottom' })
          .setLngLat([zone.longitude!, zone.latitude!])
          .addTo(map.current!);
      });
      const pointMarkers = pointsOfInterest.map((point) => {
        const node = document.createElement('span');
        node.className = styles.poiPin;
        node.title = `${point.name}${point.zoneName ? ` · ${point.zoneName}` : ''}`;
        node.setAttribute('aria-label', node.title);
        return new mapboxgl.Marker({ element: node, anchor: 'center' })
          .setLngLat([point.longitude, point.latitude])
          .addTo(map.current!);
      });
      markers.current = [...propertyMarkers, ...zoneMarkers, ...pointMarkers];

      if (locatedProperties.length === 1) {
        map.current.easeTo({
          center: [locatedProperties[0].longitude!, locatedProperties[0].latitude!],
          zoom: 14.5,
          duration: 450,
        });
      } else if (locatedProperties.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        locatedProperties.forEach((property) =>
          bounds.extend([property.longitude!, property.latitude!]),
        );
        map.current.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 650 });
      }
    }).catch(() => setStatus('error'));
    return () => {
      active = false;
    };
  }, [properties, locatedProperties, zones, pointsOfInterest, selectedZoneId, status]);

  function fitToResults() {
    if (!map.current) return;
    void import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (!map.current) return;
      const bounds = new mapboxgl.LngLatBounds();
      let hasCoordinates = false;
      locatedProperties.forEach((property) => {
        bounds.extend([property.longitude!, property.latitude!]);
        hasCoordinates = true;
      });
      if (!hasCoordinates) {
        zones.filter((zone) => zone.latitude !== null && zone.longitude !== null).forEach((zone) => {
          bounds.extend([zone.longitude!, zone.latitude!]);
          hasCoordinates = true;
        });
      }
      if (!hasCoordinates) {
        pointsOfInterest.forEach((point) => {
          bounds.extend([point.longitude, point.latitude]);
          hasCoordinates = true;
        });
      }
      if (hasCoordinates) map.current.fitBounds(bounds, { padding: 90, maxZoom: 14, duration: 700 });
      else map.current.easeTo({ center: [-64.35, -33.12], zoom: 12, duration: 700 });
    });
  }

  if (status === 'missing') {
    return <div className={styles.mapMessage}>El mapa interactivo estará disponible al configurar el token público de Mapbox.</div>;
  }
  if (status === 'unsupported') {
    return <div className={styles.mapMessage}>Este navegador no permite mostrar el mapa interactivo.</div>;
  }
  if (status === 'error') {
    return <div className={styles.mapMessage}>No se pudo cargar el mapa. Las propiedades siguen disponibles en el listado.</div>;
  }

  return (
    <div className={styles.mapFrame}>
      <div className={styles.mapHost} ref={host} aria-label="Mapa aproximado de propiedades" />
      <div className={styles.mapHeading} aria-live="polite">
        <span className={styles.mapHeadingMark} aria-hidden="true">T</span>
        <span><strong>Explorá el mapa</strong><small>{locatedProperties.length} {locatedProperties.length === 1 ? 'propiedad ubicada' : 'propiedades ubicadas'} · ubicación aproximada</small></span>
      </div>
      {status === 'ready' && <div className={styles.mapActions} aria-label="Controles del mapa">
        <button type="button" onClick={() => map.current?.zoomIn({ duration: 250 })} aria-label="Acercar mapa">+</button>
        <button type="button" onClick={() => map.current?.zoomOut({ duration: 250 })} aria-label="Alejar mapa">−</button>
        <button className={styles.fitButton} type="button" onClick={fitToResults} aria-label="Enfocar propiedades y zonas">⌖ <span>Ver resultados</span></button>
      </div>}
      {status === 'loading' && <div className={styles.mapOverlay}>Cargando mapa…</div>}
      {status === 'ready' && locatedProperties.length === 0 && zones.every((zone) => zone.latitude === null && !zone.geometry) && pointsOfInterest.length === 0 && (
        <div className={styles.mapOverlay}>No hay coordenadas ni límites cargados. Podés explorar las zonas desde el filtro.</div>
      )}
    </div>
  );
}
