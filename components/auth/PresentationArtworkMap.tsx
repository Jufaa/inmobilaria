'use client';

import { useState } from 'react';
import type { MapBounds, Zone } from '@/lib/zones';
import type { PresentationMapStyle, PresentationPoint } from '@/lib/agency-presentation';
import styles from './presentation-artwork-map.module.css';

type Props = {
  appearance: PresentationMapStyle;
  areas: Zone[];
  pointsOfInterest: PresentationPoint[];
  onAreaSelect: (id: string) => void;
};

const visibleInBounds = (bounds: MapBounds, area: MapBounds) =>
  area.east > bounds.west && area.west < bounds.east && area.north > bounds.south && area.south < bounds.north;

const pointInBounds = (point: PresentationPoint, bounds: MapBounds) =>
  point.longitude >= bounds.west && point.longitude <= bounds.east && point.latitude >= bounds.south && point.latitude <= bounds.north;

const x = (longitude: number, bounds: MapBounds) => (longitude - bounds.west) / (bounds.east - bounds.west) * 100;
const y = (latitude: number, bounds: MapBounds) => (bounds.north - latitude) / (bounds.north - bounds.south) * 100;

export function PresentationArtworkMap({ appearance, areas, pointsOfInterest, onAreaSelect }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ url: string; width: number; height: number } | null>(null);
  const bounds = appearance.bounds;
  const middleLatitude = (bounds.north + bounds.south) / 2 * Math.PI / 180;
  const aspectRatio = ((bounds.east - bounds.west) * Math.cos(middleLatitude)) / (bounds.north - bounds.south);
  const imageAvailable = !!appearance.artworkUrl && failedUrl !== appearance.artworkUrl;
  const sourceRatio = imageSize?.url === appearance.artworkUrl ? imageSize.width / imageSize.height : aspectRatio;
  const imageWidth = sourceRatio > aspectRatio ? 1 : sourceRatio / aspectRatio;
  const imageHeight = sourceRatio < aspectRatio ? 1 : aspectRatio / sourceRatio;
  const imageX = (longitude: number) => (1 - imageWidth) / 2 * 100 + x(longitude, bounds) * imageWidth;
  const imageY = (latitude: number) => (1 - imageHeight) / 2 * 100 + y(latitude, bounds) * imageHeight;

  return <section className={styles.artworkMap} aria-label="Plano georreferenciado de la presentación">
    <p className={styles.notice}>El plano se prepara externamente (incluida IA si se utilizó); esta pantalla no genera imágenes con IA. La alineación depende de que el plano coincida con estos límites geográficos; las zonas son referencias orientativas.</p>
    <div className={styles.viewport} style={{ aspectRatio }}>
      {imageAvailable ? <img className={styles.artwork} src={appearance.artworkUrl} alt="Plano personalizado de Río Cuarto" onLoad={event => setImageSize({ url: appearance.artworkUrl, width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={() => setFailedUrl(appearance.artworkUrl)} /> : <div className={styles.emptyArtwork} role="status">
        <strong>{appearance.artworkUrl ? 'No se pudo cargar el plano personalizado.' : 'No hay un plano personalizado disponible.'}</strong>
        <span>Usa los accesos a zonas para continuar con la presentación.</span>
      </div>}
      {areas.filter(area => visibleInBounds(bounds, area.bounds)).map(area => <button
        key={area.id}
        className={styles.zone}
        type="button"
        aria-label={`Abrir zona ${area.label}`}
        onClick={() => onAreaSelect(area.id)}
        style={{
          left: `${imageX(area.bounds.west)}%`, top: `${imageY(area.bounds.north)}%`,
          width: `${imageX(area.bounds.east) - imageX(area.bounds.west)}%`,
          height: `${imageY(area.bounds.south) - imageY(area.bounds.north)}%`,
          borderColor: appearance.accentColor, backgroundColor: `${appearance.accentColor}24`,
        }}
      >{area.label}</button>)}
      {pointsOfInterest.filter(point => pointInBounds(point, bounds)).map(point => <span
        key={point.id}
        className={styles.point}
        role="img"
        aria-label={`Punto de interés: ${point.name}`}
        style={{ left: `${imageX(point.longitude)}%`, top: `${imageY(point.latitude)}%`, backgroundColor: point.color }}
      ><span>{point.name}</span></span>)}
    </div>
    <ul className={styles.legend} aria-label="Leyenda del plano">
      {areas.filter(area => visibleInBounds(bounds, area.bounds)).map(area => <li key={`area-${area.id}`}><span aria-hidden="true" style={{ backgroundColor: appearance.accentColor }} />{area.label}</li>)}
      {pointsOfInterest.filter(point => pointInBounds(point, bounds)).map(point => <li key={`point-${point.id}`}><span aria-hidden="true" style={{ backgroundColor: point.color }} />{point.name}</li>)}
    </ul>
    <small className={styles.disclosure}>Imagen de referencia del cliente; no se generan ni verifican hechos sobre edificios o propiedades a partir de IA.</small>
  </section>;
}
