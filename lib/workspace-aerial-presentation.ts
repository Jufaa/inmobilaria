import { buildDemoAreas, type DemoArea } from './property-aerial-demo.ts';
import type { DemoConfig } from './property-tour-config.ts';

type Position = [number, number];
type Polygon = Position[][];
type Polygons = Polygon[];
export type PresentationZone = { id: string; name: string; geometry?: unknown; latitude?: number | null; longitude?: number | null };
const coordinate = (value: unknown): value is Position => Array.isArray(value) && value.length >= 2
  && typeof value[0] === 'number' && Number.isFinite(value[0]) && Math.abs(value[0]) <= 180
  && typeof value[1] === 'number' && Number.isFinite(value[1]) && Math.abs(value[1]) <= 90;

function polygonsOf(value: unknown): Polygons | null {
  if (!value || typeof value !== 'object') return null;
  const geometry = value as { type?: string; geometry?: unknown; coordinates?: unknown };
  if (geometry.type === 'Feature') return polygonsOf(geometry.geometry);
  const raw = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : null;
  if (!Array.isArray(raw) || !raw.length) return null;
  const polygons: Polygons = [];
  for (const polygon of raw) {
    if (!Array.isArray(polygon) || !polygon.length) return null;
    const rings: Polygon = [];
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 3 || !ring.every(coordinate)) return null;
      rings.push(ring.map(point => [point[0], point[1]]));
    }
    polygons.push(rings);
  }
  return polygons;
}
function inRing([x, y]: Position, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inPolygons = (point: Position, polygons: Polygons) => polygons.some(rings => inRing(point, rings[0]) && !rings.slice(1).some(hole => inRing(point, hole)));
export function pointInPresentationGeometry(point: Position, geometry: unknown): boolean {
  const polygons = polygonsOf(geometry);
  return !!polygons && inPolygons(point, polygons);
}

export function createPresentationArea(zone: PresentationZone, config: DemoConfig): DemoArea | null {
  let polygons = polygonsOf(zone.geometry);
  if (!polygons && typeof zone.latitude === 'number' && Number.isFinite(zone.latitude) && Math.abs(zone.latitude) < 89.99
    && typeof zone.longitude === 'number' && Number.isFinite(zone.longitude) && Math.abs(zone.longitude) < 179.99) {
    const [x, y] = [zone.longitude, zone.latitude];
    polygons = [[[[x - .004, y - .004], [x + .004, y - .004], [x + .004, y + .004], [x - .004, y + .004]]]];
  }
  if (!polygons) return null;
  const bounds = { west: Infinity, east: -Infinity, south: Infinity, north: -Infinity };
  for (const polygon of polygons) for (const [x,y] of polygon[0]) {
    bounds.west = Math.min(bounds.west,x); bounds.east = Math.max(bounds.east,x);
    bounds.south = Math.min(bounds.south,y); bounds.north = Math.max(bounds.north,y);
  }
  if (bounds.east <= bounds.west || bounds.north <= bounds.south) return null;
  const center: Position = [(bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2];
  const candidates: Position[] = [];
  for (let row = 0; row < 25; row++) for (let column = 0; column < 25; column++) {
    const point: Position = [bounds.west + (column + .5) / 25 * (bounds.east - bounds.west), bounds.south + (row + .5) / 25 * (bounds.north - bounds.south)];
    if (inPolygons(point,polygons)) candidates.push(point);
  }
  if (candidates.length < 6) return null;
  const distance = (a: Position,b: Position) => (a[0]-b[0])**2 + (a[1]-b[1])**2;
  candidates.sort((a,b) => distance(a,center)-distance(b,center));
  const chosen = [candidates[0]];
  while (chosen.length < 6) {
    let next = candidates[0], best = -1;
    for (const candidate of candidates) {
      const score = Math.min(...chosen.map(point => distance(candidate,point)));
      if (score > best) { next = candidate; best = score; }
    }
    chosen.push(next);
  }
  const templates = buildDemoAreas(config);
  const templateIndex = Array.from(zone.id).reduce((total,char) => total + char.codePointAt(0)!,0) % templates.length;
  const template = templates.find(item => item.id === zone.id) ?? templates[templateIndex];
  const id = `presentation-${zone.id}`;
  return { id, label: zone.name, zone: { id, label: zone.name, kind: 'neighborhood', bounds },
    properties: template.properties.map((property,index) => {
      const propertyId = `${id}-${index + 1}`;
      return { ...property, id: propertyId, longitude: chosen[index][0], latitude: chosen[index][1],
        tour: { ...property.tour, id: propertyId, neighborhood: zone.name } };
    }) };
}
