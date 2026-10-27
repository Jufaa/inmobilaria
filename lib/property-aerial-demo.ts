import { zonesForConfig, toursForConfig, type DemoConfig } from './property-tour-config.ts';
import type { TourProperty } from './property-tour-demo.ts';
import type { MapBounds, Zone } from './zones.ts';

export type AerialProperty = {
  id: string; title: string; kind: string; latitude: number; longitude: number;
  price: string; tour: TourProperty;
};
export type DemoArea = { id: string; label: string; zone: Zone; properties: AerialProperty[] };
const samples = [
  { title: '', kind: 'Departamento', lat: 0, lng: 0, area: 86, bedrooms: 2 },
  { title: 'Casa con patio', kind: 'Casa', lat: .0009, lng: -.0011, area: 140, bedrooms: 3 },
  { title: 'Terraza sobre la ciudad', kind: 'Departamento', lat: -.0008, lng: .0012, area: 105, bedrooms: 2 },
  { title: 'Casa de esquina', kind: 'Casa', lat: .0014, lng: .0013, area: 165, bedrooms: 3 },
  { title: 'Un espacio para empezar', kind: 'Departamento', lat: -.0013, lng: -.001, area: 58, bedrooms: 1 },
  { title: 'Dúplex entre árboles', kind: 'Dúplex', lat: .0003, lng: .0021, area: 120, bedrooms: 3 },
];

// Derived demo fixtures only: the two editable templates and their saved format stay intact.
export function buildDemoAreas(config: DemoConfig): DemoArea[] {
  const zones = zonesForConfig(config);
  const tours = toursForConfig(config);
  return config.properties.map((template, index) => ({
    id: template.id, label: template.neighborhood, zone: zones[index],
    properties: samples.map((sample, position) => {
      const id = `${template.id}-aerial-${position + 1}`;
      const title = position === 0 ? template.title : sample.title;
      return { id, title, kind: sample.kind,
        latitude: Math.max(-89.999, Math.min(89.999, template.latitude + sample.lat)),
        longitude: Math.max(-179.999, Math.min(179.999, template.longitude + sample.lng)),
        price: tours[index].price,
        tour: { ...tours[index], id, title, area: position === 0 ? tours[index].area : sample.area, bedrooms: position === 0 ? tours[index].bedrooms : sample.bedrooms } };
    }),
  }));
}

export type AreaState = { areaId: string | null; propertyId: string | null };
export const initialAreaState: AreaState = { areaId: null, propertyId: null };
export type AreaAction = { type: 'area' | 'property'; id: string } | { type: 'return' } | { type: 'close' };
export function updateAreaState(areas: DemoArea[], state: AreaState, action: AreaAction): AreaState {
  if (action.type === 'close') return initialAreaState;
  if (action.type === 'return') return { ...state, propertyId: null };
  if (action.type === 'area') return areas.some(a => a.id === action.id) ? { areaId: action.id, propertyId: null } : state;
  return areas.find(a => a.id === state.areaId)?.properties.some(p => p.id === action.id)
    ? { ...state, propertyId: action.id } : state;
}

// Keep an entire selected panel boundary visible rather than using a fixed neighborhood zoom.
export function aerialCameraForBounds(bounds: MapBounds) {
  const lat = (bounds.north + bounds.south) / 2;
  const lng = (bounds.east + bounds.west) / 2;
  const extent = Math.max((bounds.north - bounds.south) * 111320,
    (bounds.east - bounds.west) * 111320 * Math.cos(lat * Math.PI / 180));
  return { center: { lat, lng }, range: Math.max(1700, extent * 2.8), tilt: 0, heading: 0 };
}
