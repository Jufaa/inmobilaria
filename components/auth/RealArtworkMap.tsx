'use client';

import { useState } from 'react';
import type { MapBounds, Zone } from '@/lib/zones';
import type { PresentationMapStyle, PresentationPoint } from '@/lib/agency-presentation';
import { clientPoint } from '@/lib/map-rectangle-selection';
import styles from './real-agency-map.module.css';

type Marker = { id: number; latitude: number; longitude: number; address: string; price: number; currency: string; showPrice: boolean; markerColor?: string };
export function artworkPosition(bounds: MapBounds, viewport: { left: number; top: number; width: number; height: number }, clientX: number, clientY: number): [number, number] | null {
  const point = clientPoint(viewport, clientX, clientY);
  return point ? [bounds.west + point.x / viewport.width * (bounds.east - bounds.west), bounds.north - point.y / viewport.height * (bounds.north - bounds.south)] : null;
}
export function RealArtworkMap({ appearance, areas, areaColors, points, markers, onSelect, onAreaSelect, onMapPick }: {
  appearance: PresentationMapStyle; areas: Zone[]; areaColors: Record<string, string>; points: PresentationPoint[]; markers: Marker[];
  onSelect: (id: number) => void; onAreaSelect: (id: string) => void; onMapPick?: (position: [number, number]) => void;
}) {
  const [failed, setFailed] = useState(false);
  const bounds = appearance.bounds;
  const x = (longitude: number) => (longitude - bounds.west) / (bounds.east - bounds.west) * 100;
  const y = (latitude: number) => (bounds.north - latitude) / (bounds.north - bounds.south) * 100;
  const inside = (point: { longitude: number; latitude: number }) => point.longitude >= bounds.west && point.longitude <= bounds.east && point.latitude >= bounds.south && point.latitude <= bounds.north;
  if (failed) return <p role="alert">No se pudo cargar el plano. Revise la imagen en Personalización.</p>;
  return <div className={styles.artworkFrame}>
    <div className={styles.artworkSurface} tabIndex={onMapPick ? 0 : undefined} role="group" aria-label="Plano de propiedades. Enter coloca la propiedad en el centro."
      onClick={event => {
        if (!onMapPick) return;
        const image = event.currentTarget.querySelector('img');
        const point = image?.naturalWidth ? artworkPosition(bounds, image.getBoundingClientRect(), event.clientX, event.clientY) : null;
        if (point) onMapPick(point);
      }} onKeyDown={event => {
        if (onMapPick && event.target === event.currentTarget && event.key === 'Enter') { event.preventDefault(); onMapPick([(bounds.west + bounds.east) / 2, (bounds.north + bounds.south) / 2]); }
      }}>
      <img src={appearance.artworkUrl} alt="Plano personalizado" draggable={false} onError={() => setFailed(true)} />
      {areas.map(area => <button type="button" key={area.id} className={styles.artworkZone} disabled={!!onMapPick} style={{ left:`${x(area.bounds.west)}%`, top:`${y(area.bounds.north)}%`, width:`${x(area.bounds.east)-x(area.bounds.west)}%`, height:`${y(area.bounds.south)-y(area.bounds.north)}%`, borderColor:areaColors[area.id], background:`${areaColors[area.id]}25` }} onClick={event => {event.stopPropagation(); onAreaSelect(area.id);}}>{area.label}</button>)}
      {points.filter(inside).map(point => <span key={point.id} className={styles.artworkPin} title={point.name} style={{left:`${x(point.longitude)}%`,top:`${y(point.latitude)}%`,color:point.color}}>●</span>)}
      {markers.filter(inside).map(marker => <button key={marker.id} type="button" className={styles.artworkPin} disabled={!!onMapPick} aria-label={`Ver ${marker.address}`} style={{left:`${x(marker.longitude)}%`,top:`${y(marker.latitude)}%`,borderColor:marker.markerColor}} onClick={event => {event.stopPropagation();onSelect(marker.id);}}>{marker.showPrice ? `${marker.currency} ${new Intl.NumberFormat('es-AR').format(marker.price)}` : '●'}</button>)}
    </div>
  </div>;
}
