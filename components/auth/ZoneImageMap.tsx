'use client';

import { useRef, useState } from 'react';
import { pinKey, zonePinPosition, type ZoneMap, type ZoneMapTarget } from '@/lib/zone-map';
import styles from './zone-image-map.module.css';

type Point = { x: number; y: number };
const clamp = (value: number) => Math.max(0, Math.min(1, value));
export function ZoneImageMap({ map, targets, onSelect, onPlace, onMove }: {
  map: ZoneMap; targets: ZoneMapTarget[]; onSelect: (target: ZoneMapTarget) => void;
  onPlace?: (point: Point) => void; onMove?: (target: ZoneMapTarget, point: Point) => void;
}) {
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState<{ key: string; point: Point } | null>(null);
  const drag = useRef<{ pointerId: number; key: string; point: Point } | null>(null);
  function position(event: React.PointerEvent<HTMLButtonElement>): Point | null {
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    return rect?.width && rect.height ? { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) } : null;
  }
  function end(event: React.PointerEvent<HTMLButtonElement>, target: ZoneMapTarget, save: boolean) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId || current.key !== pinKey(target)) return;
    drag.current = null; setPreview(null);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (save) onMove?.(target, position(event) ?? current.point);
  }
  if (failed) return <p role="alert">No se pudo cargar el plano. Revise la imagen en Personalización.</p>;
  return <div className={styles.surface} data-zone-image-surface tabIndex={onPlace ? 0 : undefined} role="group" aria-label="Mapa de la zona"
    onClick={event => {
      if (!onPlace) return;
      const image = event.currentTarget.querySelector('img');
      const rect = image?.getBoundingClientRect();
      if (!image?.naturalWidth || !rect?.width || !rect.height) return;
      const x = (event.clientX - rect.left) / rect.width, y = (event.clientY - rect.top) / rect.height;
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) onPlace({ x, y });
    }} onKeyDown={event => {
      if (onPlace && event.target === event.currentTarget && event.key === 'Enter') { event.preventDefault(); onPlace({ x: .5, y: .5 }); }
    }}>
    <img src={map.imageUrl} alt="Mapa personalizado de la zona" draggable={false} onError={() => setFailed(true)} />
    {targets.map(target => {
      const key = pinKey(target), point = preview?.key === key ? preview.point : zonePinPosition(map, target);
      return point ? <button key={key} type="button" className={styles.pin} style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%`, touchAction: onMove ? 'none' : undefined }}
        aria-label={`${target.source === 'example' ? 'Ejemplo' : 'Propiedad'}: ${target.title}`} title={target.title}
        onClick={event => { event.stopPropagation(); onSelect(target); }}
        onPointerDown={event => {
          if (!onMove || event.button !== 0) return;
          event.preventDefault(); event.stopPropagation();
          drag.current = { key, pointerId: event.pointerId, point };
          event.currentTarget.setPointerCapture(event.pointerId);
        }} onPointerMove={event => {
          if (drag.current?.key !== key || drag.current.pointerId !== event.pointerId) return;
          const next = position(event);
          if (next) { drag.current.point = next; setPreview({ key, point: next }); }
        }} onPointerUp={event => end(event, target, true)} onPointerCancel={event => end(event, target, false)}
        onLostPointerCapture={event => end(event, target, false)}
        onKeyDown={event => {
          if (!onMove) return;
          if (event.key === 'Escape' && drag.current) {
            const pointerId = drag.current.pointerId;
            drag.current = null; setPreview(null);
            if (event.currentTarget.hasPointerCapture?.(pointerId)) event.currentTarget.releasePointerCapture(pointerId);
            event.preventDefault(); event.stopPropagation(); return;
          }
          const delta = { ArrowLeft: [-.01, 0], ArrowRight: [.01, 0], ArrowUp: [0, -.01], ArrowDown: [0, .01] }[event.key];
          if (delta) { event.preventDefault(); event.stopPropagation(); onMove(target, { x: clamp(point.x + delta[0]), y: clamp(point.y + delta[1]) }); }
        }}>●<span>{target.title}</span></button> : null;
    })}
  </div>;
}
