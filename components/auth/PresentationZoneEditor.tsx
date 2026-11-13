'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { validPresentationBounds, type ExplorerZone } from '@/lib/presentation-explorer';
import { artworkRectangle, clientPoint, screenRectangle, type ScreenPoint, type ScreenRectangle } from '@/lib/map-rectangle-selection';
import type { MapBounds } from '@/lib/zones';
import type { PresentationMapStyle, PresentationPoint } from '@/lib/agency-presentation';
import styles from './agency-presentation-settings.module.css';

const CityMap = dynamic(() => import('../CityMap'), { ssr: false });
type ArtworkDrag = { pointerId: number; start: ScreenPoint; image: DOMRect; surface: HTMLDivElement };

export function PresentationZoneEditor({ zones, appearance, onChange, points = [], onPointsChange, simple = false }: {
  zones: ExplorerZone[]; appearance: PresentationMapStyle; onChange: (zones: ExplorerZone[]) => void;
  simple?: boolean;
  points?: PresentationPoint[]; onPointsChange?: (points: PresentationPoint[]) => void;
}) {
  const [selected, setSelected] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [redrawId, setRedrawId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [picking, setPicking] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState('');
  const [keyboardPosition, setKeyboardPosition] = useState<[number, number]>([.5, .5]);
  const [preview, setPreview] = useState<ScreenRectangle | null>(null);
  const artworkDrag = useRef<ArtworkDrag | null>(null);
  const active = useRef(true);
  const current = zones.find(zone => zone.id === selected);
  const pin = points.find(point => point.id === selectedPoint);
  const bounds = appearance.bounds;
  const artwork = appearance.mode === 'artwork' && !!appearance.artworkUrl;
  const x = (longitude: number) => (longitude - bounds.west) / (bounds.east - bounds.west) * 100;
  const y = (latitude: number) => (bounds.north - latitude) / (bounds.north - bounds.south) * 100;
  function releaseArtworkDrag() {
    const drag = artworkDrag.current;
    artworkDrag.current = null;
    if (drag?.surface.hasPointerCapture?.(drag.pointerId)) drag.surface.releasePointerCapture(drag.pointerId);
  }
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; releaseArtworkDrag(); };
  }, []);
  function update(change: Partial<ExplorerZone>) {
    onChange(zones.map(zone => zone.id === selected ? { ...zone, ...change } : zone));
  }
  function updatePin(change: Partial<PresentationPoint>) {
    onPointsChange?.(points.map(point => point.id === selectedPoint ? { ...point, ...change } : point));
  }
  function chooseZone(id: string) { setSelected(id); setSelectedPoint(''); }
  function choosePin(id: string) { setSelectedPoint(id); setSelected(''); }
  function cancel() { releaseArtworkDrag(); setPreview(null); setDrawing(false); setPicking(false); setRedrawId(null); setMessage(''); }
  function finishRectangle(next: MapBounds) {
    if (!active.current || !drawing || !validPresentationBounds(next)) return;
    let id = redrawId;
    if (id) {
      if (!zones.some(zone => zone.id === id)) { cancel(); return; }
      onChange(zones.map(zone => zone.id === id ? { ...zone, bounds: next } : zone));
    } else {
      if (zones.length >= 50) { cancel(); return; }
      id = `zone-${crypto.randomUUID()}`;
      onChange([...zones, { id, name: `Zona ${zones.length + 1}`, color: appearance.accentColor, bounds: next, enabled: true, videoUrl: '', duration: 4 }]);
    }
    chooseZone(id); setDrawing(false); setRedrawId(null); setPreview(null);
    setMessage(redrawId ? 'Límites actualizados.' : 'Zona creada. Puede cambiar su nombre o guardar.');
  }
  function place(position: [number, number]) {
    if (!active.current || !picking || !onPointsChange || !position.every(Number.isFinite) || Math.abs(position[0]) > 180 || Math.abs(position[1]) > 90) return;
    if (points.length >= 50) { cancel(); return; }
    const point: PresentationPoint = { id: `pin-${crypto.randomUUID()}`, name: `Chincheta ${points.length + 1}`, longitude: position[0], latitude: position[1], color: appearance.accentColor };
    onPointsChange([...points, point]); choosePin(point.id); setPicking(false);
    setMessage('Chincheta agregada. Puede cambiar su nombre o guardar.');
  }
  function imageViewport(surface: HTMLDivElement) {
    const image = surface.querySelector('img');
    return image && image.naturalWidth !== 0 && image.naturalHeight !== 0 ? image.getBoundingClientRect() : null;
  }
  function mark(event: React.MouseEvent<HTMLDivElement>) {
    if (!picking || !artwork) return;
    const image = imageViewport(event.currentTarget);
    const point = image ? clientPoint(image, event.clientX, event.clientY) : null;
    if (point && image) place([bounds.west + point.x / image.width * (bounds.east - bounds.west), bounds.north - point.y / image.height * (bounds.north - bounds.south)]);
  }
  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!artwork || !drawing || artworkDrag.current || event.button !== 0 || event.isPrimary === false) return;
    const image = imageViewport(event.currentTarget);
    const start = image ? clientPoint(image, event.clientX, event.clientY) : null;
    if (!start || !image) return;
    event.preventDefault(); event.stopPropagation();
    artworkDrag.current = { pointerId: event.pointerId, start, image, surface: event.currentTarget };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    movePreview(start);
  }
  function movePreview(point: ScreenPoint) {
    const drag = artworkDrag.current;
    if (!drag) return;
    const rectangle = screenRectangle(drag.start, point, 0)!;
    const surface = drag.surface.getBoundingClientRect();
    setPreview({ ...rectangle, left: drag.image.left - surface.left + rectangle.left, top: drag.image.top - surface.top + rectangle.top });
  }
  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = artworkDrag.current;
    if (!drawing || !drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const point = clientPoint(drag.image, event.clientX, event.clientY, true);
    if (point) movePreview(point);
  }
  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = artworkDrag.current;
    if (!active.current || !drawing || !drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    const currentImage = imageViewport(event.currentTarget);
    const unchanged = currentImage && (['left', 'top', 'width', 'height'] as const).every(key => currentImage[key] === drag.image[key]);
    const end = unchanged ? clientPoint(drag.image, event.clientX, event.clientY) : null;
    const rectangle = end ? screenRectangle(drag.start, end) : null;
    releaseArtworkDrag(); setPreview(null);
    const next = rectangle ? artworkRectangle(rectangle, drag.image, bounds) : null;
    if (next) finishRectangle(next);
  }
  function interruptDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (artworkDrag.current?.pointerId === event.pointerId) cancel();
  }
  function keyboardMark(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!picking && !drawing) return;
    if (event.key === 'Escape') { event.preventDefault(); cancel(); return; }
    if (event.target !== event.currentTarget) return;
    if (drawing) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setMessage('Arrastre sobre el mapa para marcar la zona. Escape cancela.'); }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (artwork) place([bounds.west + keyboardPosition[0] * (bounds.east - bounds.west), bounds.north - keyboardPosition[1] * (bounds.north - bounds.south)]);
      else event.currentTarget.querySelector('canvas')?.focus();
    } else if (artwork && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      setKeyboardPosition([Math.max(0, Math.min(1, keyboardPosition[0] + (event.key === 'ArrowRight' ? .02 : event.key === 'ArrowLeft' ? -.02 : 0))), Math.max(0, Math.min(1, keyboardPosition[1] + (event.key === 'ArrowDown' ? .02 : event.key === 'ArrowUp' ? -.02 : 0)))]);
    }
  }
  return <div className={styles.zoneEditor}>
    <div className={styles.mapToolbar}>
      {onPointsChange && <button type="button" className={styles.secondaryButton} aria-pressed={picking} disabled={points.length >= 50} onClick={() => { releaseArtworkDrag(); setPreview(null); setPicking(true); setDrawing(false); setRedrawId(null); setKeyboardPosition([.5, .5]); setMessage('Toque el mapa para colocar la chincheta. Con teclado: enfoque el mapa y pulse Enter.'); }}>Agregar chincheta</button>}
      <button type="button" className={styles.secondaryButton} disabled={zones.length >= 50} onClick={() => {
        releaseArtworkDrag(); setPreview(null); setRedrawId(null); setSelected(''); setSelectedPoint(''); setDrawing(true); setPicking(false); setMessage('Arrastre sobre el mapa y suelte para crear la zona. Escape cancela.');
      }}>Agregar zona</button>
      {(drawing || picking) && <button type="button" className={styles.secondaryButton} onClick={cancel}>Cancelar</button>}
    </div>
    <p role="status">{message || 'Toque una zona o una chincheta para editarla.'}</p>
    <div className={styles.drawMap} onClick={artwork ? mark : undefined} onPointerDown={artwork ? startDrag : undefined} onPointerMove={artwork ? moveDrag : undefined} onPointerUp={artwork ? endDrag : undefined} onPointerCancel={artwork ? interruptDrag : undefined} onLostPointerCapture={artwork ? interruptDrag : undefined} data-drawing={drawing} data-picking={picking} tabIndex={0} role="group" aria-label="Mapa de edición" onKeyDown={keyboardMark}>
      {artwork ? <>
        <img src={appearance.artworkUrl} alt="Plano base para editar zonas y chinchetas" draggable={false} />
        {zones.map(zone => <button key={zone.id} type="button" aria-label={`Seleccionar zona ${zone.name}`} aria-pressed={selected === zone.id} onClick={event => { if (drawing || picking) return; event.stopPropagation(); chooseZone(zone.id); }} style={{ left: `${x(zone.bounds.west)}%`, top: `${y(zone.bounds.north)}%`, width: `${x(zone.bounds.east) - x(zone.bounds.west)}%`, height: `${y(zone.bounds.south) - y(zone.bounds.north)}%`, borderColor: zone.color, background: `${zone.color}25` }}>{zone.name}</button>)}
        {points.map(point => <button key={point.id} type="button" className={styles.editPin} aria-label={`Editar chincheta ${point.name}`} aria-pressed={selectedPoint === point.id} onClick={event => { if (drawing || picking) return; event.stopPropagation(); choosePin(point.id); }} style={{ left: `${x(point.longitude)}%`, top: `${y(point.latitude)}%`, backgroundColor: point.color }}>●<span>{point.name}</span></button>)}
      </> : <div className={styles.interactiveEditor}><CityMap properties={[]} selected={null} onSelect={() => {}} visible overview compact editing appearance={appearance} focusProperty={null} focusRevision={0} onSearchArea={() => {}} zoneRevision={1}
        areas={zones.map(zone => ({ id: zone.id, label: zone.name, kind: 'neighborhood', bounds: zone.bounds }))} areaColors={Object.fromEntries(zones.map(zone => [zone.id, zone.color]))}
        pointsOfInterest={points} onAreaSelect={chooseZone} onPointSelect={drawing || picking ? undefined : choosePin} onMapPick={picking ? place : undefined} onRectangleSelect={drawing ? finishRectangle : undefined} onRectangleCancel={cancel} /></div>}
      {preview && <span className={styles.cropPreview} aria-hidden="true" style={{ left: preview.left, top: preview.top, width: preview.width, height: preview.height }} />}
      {picking && artwork && <span className={styles.keyboardCursor} aria-hidden="true" style={{ left: `${keyboardPosition[0] * 100}%`, top: `${keyboardPosition[1] * 100}%` }}>+</span>}
      {pin && !drawing && !picking && <section className={styles.selectionPanel} role="region" aria-label="Editar chincheta seleccionada" onClick={event => event.stopPropagation()}>
      <header><strong>Chincheta</strong><button type="button" onClick={() => setSelectedPoint('')}>Listo</button></header>
      <div className={styles.inlineEditor}>
      <label className={styles.field}>Nombre<input aria-label="Nombre de chincheta" maxLength={100} value={pin.name} onChange={event => updatePin({ name: event.target.value })} /></label>
      <label className={styles.field}>Color<input aria-label="Color de chincheta" type="color" value={pin.color} onChange={event => updatePin({ color: event.target.value })} /></label>
      <button className={styles.removeButton} type="button" onClick={() => { onPointsChange?.(points.filter(point => point.id !== selectedPoint)); setSelectedPoint(''); }}>Quitar chincheta</button>
      </div></section>}
      {current && !drawing && !picking && <section className={styles.selectionPanel} role="region" aria-label="Editar zona seleccionada" onClick={event => event.stopPropagation()}>
      <header><strong>Zona seleccionada</strong><button type="button" onClick={() => setSelected('')}>Listo</button></header>
      <div className={styles.point}>
      <div className={styles.inlineEditor}>
        <label className={styles.field}>Nombre de zona<input maxLength={100} value={current.name} onChange={event => update({ name: event.target.value })} /></label>
        <label className={styles.field}>Color de zona<input type="color" value={current.color} onChange={event => update({ color: event.target.value })} /></label>
        <label className={styles.toggle}><input type="checkbox" checked={current.enabled} onChange={event => update({ enabled: event.target.checked })} /> Mostrar zona</label>
      </div>
      <label className={styles.field}>Video de la zona<select value={current.videoUrl} onChange={event => update({ videoUrl: event.target.value })}>
        <option value="">Sin video</option>{!simple && <><option value="/demo-assets/tours/location-01.mp4">Video de ejemplo 1</option><option value="/demo-assets/tours/location-02.mp4">Video de ejemplo 2</option></>}
        {current.videoUrl && (simple || !['/demo-assets/tours/location-01.mp4', '/demo-assets/tours/location-02.mp4'].includes(current.videoUrl)) && <option value={current.videoUrl}>Video personalizado</option>}
      </select></label>
      <button className={styles.secondaryButton} type="button" onClick={() => { releaseArtworkDrag(); setPreview(null); setRedrawId(current.id); setDrawing(true); setPicking(false); setMessage('Arrastre sobre el mapa para cambiar los límites. Escape conserva la zona original.'); }}>Marcar límites sobre el plano</button>
      <details><summary>{simple ? 'Video personalizado' : 'Avanzado: video y coordenadas'}</summary>
        <label className={styles.field}>Enlace del video (MP4)<input value={current.videoUrl} onChange={event => update({ videoUrl: event.target.value })} /></label>
        <label className={styles.field}>Duración<select value={current.duration} onChange={event => update({ duration: Number(event.target.value) as 3 | 4 })}><option value={3}>3 segundos</option><option value={4}>4 segundos</option></select></label>
        {!simple && <div className={styles.coordinateGrid}>{(['west', 'east', 'south', 'north'] as const).map(key => <label key={key} className={styles.field}>{({ west: 'Oeste', east: 'Este', south: 'Sur', north: 'Norte' })[key]}<input type="number" step="any" value={Number.isFinite(current.bounds[key]) ? current.bounds[key] : ''} onChange={event => update({ bounds: { ...current.bounds, [key]: event.target.value === '' ? NaN : Number(event.target.value) } })} /></label>)}</div>}
      </details>
      <button className={styles.removeButton} type="button" onClick={() => { onChange(zones.filter(zone => zone.id !== selected)); setSelected(''); cancel(); }}>Quitar zona del borrador</button>
      </div></section>}
    </div>
  </div>;
}
