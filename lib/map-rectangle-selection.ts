import type { MapBounds } from './zones.ts';
import { validPresentationBounds } from './presentation-explorer.ts';

export type ScreenPoint = { x: number; y: number };
export type ScreenRectangle = { left: number; top: number; width: number; height: number };
type Viewport = { left: number; top: number; width: number; height: number };
type MapInteraction = { isEnabled: () => boolean; enable: () => void; disable: () => void };

export function clientPoint(viewport: Viewport, clientX: number, clientY: number, clamp = false): ScreenPoint | null {
  if (![viewport.left, viewport.top, viewport.width, viewport.height, clientX, clientY].every(Number.isFinite)
    || viewport.width <= 0 || viewport.height <= 0) return null;
  const x = clientX - viewport.left, y = clientY - viewport.top;
  if (!clamp && (x < 0 || y < 0 || x > viewport.width || y > viewport.height)) return null;
  return { x: Math.max(0, Math.min(viewport.width, x)), y: Math.max(0, Math.min(viewport.height, y)) };
}

export function screenRectangle(start: ScreenPoint, end: ScreenPoint, minimum = 6): ScreenRectangle | null {
  if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) return null;
  const width = Math.abs(end.x - start.x), height = Math.abs(end.y - start.y);
  if (width < minimum || height < minimum) return null;
  return { left: Math.min(start.x, end.x), top: Math.min(start.y, end.y), width, height };
}

export function geographicRectangle(rectangle: ScreenRectangle, unproject: (point: [number, number]) => { lng: number; lat: number }): MapBounds | null {
  const { left, top, width, height } = rectangle;
  const points = [[left, top], [left + width, top], [left + width, top + height], [left, top + height]].map(point => unproject(point as [number, number]));
  const bounds = { west: Math.min(...points.map(point => point.lng)), east: Math.max(...points.map(point => point.lng)), south: Math.min(...points.map(point => point.lat)), north: Math.max(...points.map(point => point.lat)) };
  return validPresentationBounds(bounds) ? bounds : null;
}

export function artworkRectangle(rectangle: ScreenRectangle, size: { width: number; height: number }, bounds: MapBounds): MapBounds | null {
  if (!validPresentationBounds(bounds) || size.width <= 0 || size.height <= 0) return null;
  return geographicRectangle(rectangle, ([x, y]) => ({ lng: bounds.west + x / size.width * (bounds.east - bounds.west), lat: bounds.north - y / size.height * (bounds.north - bounds.south) }));
}

export function bindRectangleSelection({ canvas, container = canvas.parentElement, interactions = [], isActive, unproject, onSelect, onCancel, color = '#2878d0' }: {
  canvas: HTMLCanvasElement; container?: HTMLElement | null; interactions?: MapInteraction[];
  isActive: () => boolean; unproject: (point: [number, number]) => { lng: number; lat: number };
  onSelect: (bounds: MapBounds) => void; onCancel?: () => void; color?: string;
}): () => void {
  const document = canvas.ownerDocument;
  const previousStyle = { cursor: canvas.style.cursor, touchAction: canvas.style.touchAction, userSelect: canvas.style.userSelect };
  const previousInteractions = interactions.map(handler => ({ handler, enabled: handler.isEnabled() }));
  previousInteractions.forEach(({ handler }) => handler.disable());
  canvas.style.cursor = 'crosshair'; canvas.style.touchAction = 'none'; canvas.style.userSelect = 'none';
  let active = true;
  let drag: { pointerId: number; start: ScreenPoint; viewport: Viewport } | null = null;
  let preview: HTMLDivElement | null = null;
  const live = () => active && isActive();
  function clear() {
    const pointerId = drag?.pointerId;
    drag = null;
    preview?.remove(); preview = null;
    if (pointerId !== undefined && canvas.hasPointerCapture?.(pointerId)) canvas.releasePointerCapture(pointerId);
  }
  function cancel() { clear(); if (live()) onCancel?.(); }
  const down = (event: PointerEvent) => {
    if (!live() || drag || event.button !== 0 || event.isPrimary === false) return;
    const viewport = canvas.getBoundingClientRect();
    const start = clientPoint(viewport, event.clientX, event.clientY);
    if (!start) return;
    event.preventDefault(); event.stopPropagation();
    drag = { pointerId: event.pointerId, start, viewport };
    canvas.setPointerCapture?.(event.pointerId);
    if (container) {
      preview = document.createElement('div');
      preview.setAttribute('data-map-crop-preview', ''); preview.setAttribute('aria-hidden', 'true');
      Object.assign(preview.style, { position: 'absolute', pointerEvents: 'none', zIndex: '5', border: `2px solid ${color}`, backgroundColor: `${color}30`, boxSizing: 'border-box' });
      container.append(preview);
      draw(start);
    }
  };
  function draw(end: ScreenPoint) {
    if (!drag || !preview || !container) return;
    const rectangle = screenRectangle(drag.start, end, 0)!;
    const parent = container.getBoundingClientRect();
    Object.assign(preview.style, { left: `${drag.viewport.left - parent.left + rectangle.left}px`, top: `${drag.viewport.top - parent.top + rectangle.top}px`, width: `${rectangle.width}px`, height: `${rectangle.height}px` });
  }
  const move = (event: PointerEvent) => {
    if (!live() || !drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const point = clientPoint(drag.viewport, event.clientX, event.clientY, true);
    if (point) draw(point);
  };
  const up = (event: PointerEvent) => {
    if (!live() || !drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    const saved = drag;
    const currentViewport = canvas.getBoundingClientRect();
    const sameViewport = ['left', 'top', 'width', 'height'].every(key => currentViewport[key as keyof Viewport] === saved.viewport[key as keyof Viewport]);
    const end = sameViewport ? clientPoint(saved.viewport, event.clientX, event.clientY) : null;
    const rectangle = end ? screenRectangle(saved.start, end) : null;
    clear();
    if (!rectangle || !live()) return;
    const bounds = geographicRectangle(rectangle, unproject);
    if (bounds && live()) onSelect(bounds);
  };
  const interrupt = (event: PointerEvent) => { if (drag && drag.pointerId === event.pointerId) cancel(); };
  const key = (event: KeyboardEvent) => {
    if (!live() || event.key !== 'Escape') return;
    event.preventDefault(); event.stopPropagation(); cancel();
  };
  canvas.addEventListener('pointerdown', down, true);
  canvas.addEventListener('pointermove', move, true);
  canvas.addEventListener('pointerup', up, true);
  canvas.addEventListener('pointercancel', interrupt, true);
  canvas.addEventListener('lostpointercapture', interrupt, true);
  document.addEventListener('keydown', key, true);
  return () => {
    if (!active) return;
    active = false; clear();
    canvas.removeEventListener('pointerdown', down, true);
    canvas.removeEventListener('pointermove', move, true);
    canvas.removeEventListener('pointerup', up, true);
    canvas.removeEventListener('pointercancel', interrupt, true);
    canvas.removeEventListener('lostpointercapture', interrupt, true);
    document.removeEventListener('keydown', key, true);
    Object.assign(canvas.style, previousStyle);
    if (isActive()) previousInteractions.forEach(({ handler, enabled }) => enabled ? handler.enable() : handler.disable());
  };
}
