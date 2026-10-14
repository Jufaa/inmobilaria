// Illustrative search rectangles, not official neighborhood boundaries.
export type MapBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};
export type Zone = {
  id: string;
  label: string;
  kind: 'region' | 'neighborhood';
  bounds: MapBounds;
};
export const zones: Zone[] = [
  {
    id: 'centro',
    label: 'Centro',
    kind: 'region',
    bounds: { west: -64.359, south: -33.135, east: -64.337, north: -33.114 },
  },
  {
    id: 'banda-norte',
    label: 'Banda Norte',
    kind: 'neighborhood',
    bounds: { west: -64.371, south: -33.112, east: -64.333, north: -33.08 },
  },
  {
    id: 'alberdi',
    label: 'Alberdi',
    kind: 'neighborhood',
    bounds: { west: -64.339, south: -33.141, east: -64.314, north: -33.114 },
  },
  {
    id: 'villa-dalcar',
    label: 'Villa Dalcar',
    kind: 'neighborhood',
    bounds: { west: -64.397, south: -33.133, east: -64.364, north: -33.109 },
  },
  {
    id: 'norte',
    label: 'Norte',
    kind: 'region',
    bounds: { west: -64.382, south: -33.112, east: -64.32, north: -33.075 },
  },
  {
    id: 'sur',
    label: 'Sur',
    kind: 'region',
    bounds: { west: -64.379, south: -33.18, east: -64.32, north: -33.138 },
  },
  {
    id: 'este',
    label: 'Este',
    kind: 'region',
    bounds: { west: -64.337, south: -33.153, east: -64.305, north: -33.106 },
  },
  {
    id: 'oeste',
    label: 'Oeste',
    kind: 'region',
    bounds: { west: -64.4, south: -33.151, east: -64.362, north: -33.108 },
  },
  {
    id: 'bimaco',
    label: 'Bimaco',
    kind: 'neighborhood',
    bounds: { west: -64.375, south: -33.165, east: -64.355, north: -33.142 },
  },
];

// Exact aliases only: no arbitrary fuzzy matching or camera movement while typing.
const normalizeArea = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
export function resolveAreaQuery(query: string): string[] {
  const parts = normalizeArea(query)
    .replace(/\b(departamentos?|apartamentos?|deptos?)\b/g, '')
    .trim()
    .split(/,|\s+y\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const ids = parts.map((part) => {
    const normalized = part
      .replace(/^(zona|barrio|sector) /, '')
      .replace(/ (de )?rio cuarto$/, '');
    if (normalized === 'usr') return 'sur';
    return zones.find((zone) => normalizeArea(zone.label) === normalized)?.id;
  });
  return ids.length && ids.every(Boolean) ? [...new Set(ids as string[])] : [];
}
export function getAreaSuggestions(query: string): Zone[] {
  const text = normalizeArea(query).replace(/^(zona|barrio|sector) /, '');
  if (!text) return [];
  if (text === 'usr') return zones.filter((zone) => zone.id === 'sur');
  return zones
    .filter((zone) => normalizeArea(zone.label).includes(text))
    .slice(0, 5);
}
