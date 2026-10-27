export type TourMode = 'video' | 'panorama' | 'plan' | 'photo';
export type TourPhase = 'building' | 'entering' | 'inside';
export type TourScene = {
  id: string;
  name: string;
  description: string;
  image: string;
  position: string;
  x: number;
  y: number;
};
export type TourProperty = {
  id: string;
  title: string;
  neighborhood: string;
  price: string;
  area: number;
  bedrooms: number;
  bathrooms: number;
  panorama: string;
  buildingPoster: string;
  entranceVideo: string;
  entranceEnabled?: boolean;
  interiorVideo: string;
  interiorPoster: string;
  scenes: TourScene[];
};
const living = '/demo-assets/fictional-rio-cuarto-living.png';
const kitchen = '/demo-assets/fictional-rio-cuarto-kitchen.png';
const panorama = '/demo-assets/fictional-rio-cuarto-panorama.png';

// Both fictional listings deliberately share illustrative media, not actual surveys.
export const tourProperties: TourProperty[] = [
  {
    id: 'centro', title: 'Luz en cada rincón', neighborhood: 'Centro · Río Cuarto',
    price: 'USD 185.000', area: 86, bedrooms: 2, bathrooms: 2, panorama,
    buildingPoster: '/demo-assets/tours/building.jpg',
    entranceVideo: '/demo-assets/tours/entrance-01.mp4',
    interiorVideo: '/demo-assets/tours/interior-01.mp4',
    interiorPoster: '/demo-assets/tours/interior-01.jpg',
    scenes: [
      { id: 'living', name: 'Living y comedor', description: 'Un espacio para compartir. La luz natural es protagonista.', image: living, position: 'center', x: 36, y: 39 },
      { id: 'kitchen', name: 'Cocina integrada', description: 'Materiales cálidos y un ambiente conectado con el resto del hogar.', image: kitchen, position: 'center', x: 31, y: 76 },
      { id: 'balcony', name: 'Una pausa al aire libre', description: 'Una mirada al balcón desde el interior del departamento.', image: living, position: '52% 35%', x: 36, y: 12 },
    ],
  },
  {
    id: 'banda-norte', title: 'Espacio para tu próxima etapa', neighborhood: 'Banda Norte · Río Cuarto',
    price: 'USD 240.000', area: 112, bedrooms: 3, bathrooms: 2, panorama,
    buildingPoster: '/demo-assets/tours/building.jpg',
    entranceVideo: '/demo-assets/tours/entrance-02.mp4',
    interiorVideo: '/demo-assets/tours/interior-02.mp4',
    interiorPoster: '/demo-assets/tours/interior-02.jpg',
    scenes: [
      { id: 'kitchen', name: 'El corazón de la casa', description: 'Una cocina abierta que invita a encontrarse todos los días.', image: kitchen, position: 'center', x: 31, y: 76 },
      { id: 'living', name: 'Un living para quedarse', description: 'Texturas naturales, tonos suaves y espacio para disfrutar.', image: living, position: 'right center', x: 36, y: 39 },
      { id: 'balcony', name: 'Abierto a la ciudad', description: 'El balcón, visto desde el living: un respiro en la rutina.', image: living, position: '52% 35%', x: 36, y: 12 },
    ],
  },
];
export type TourState = { propertyId: string; phase: TourPhase; sceneIndex: number; mode: TourMode };
export const initialTourState: TourState = { propertyId: tourProperties[0].id, phase: 'building', sceneIndex: 0, mode: 'video' };
export type TourAction =
  | { type: 'property'; id: string }
  | { type: 'entered'; id: string }
  | { type: 'return' }
  | { type: 'scene'; index: number }
  | { type: 'mode'; mode: TourMode }
  | { type: 'next' | 'previous' };

export function updateTourState(state: TourState, action: TourAction, properties: TourProperty[] = tourProperties): TourState {
  if (action.type === 'property') {
    const property = properties.find((item) => item.id === action.id);
    return property
      ? { propertyId: action.id, phase: property.entranceEnabled === false ? 'inside' : 'entering', sceneIndex: 0, mode: 'video' } : state;
  }
  if (action.type === 'entered') {
    return state.phase === 'entering' && action.id === state.propertyId ? { ...state, phase: 'inside' } : state;
  }
  if (action.type === 'return') return { ...state, phase: 'building' };
  // Interior controls cannot bypass the entrance sequence.
  if (state.phase !== 'inside') return state;
  const property = properties.find((item) => item.id === state.propertyId);
  if (!property) return state;
  switch (action.type) {
    case 'scene': return Number.isInteger(action.index) && property.scenes[action.index]
      ? { ...state, sceneIndex: action.index, mode: 'photo' } : state;
    case 'mode': return { ...state, mode: action.mode };
    case 'next': return { ...state, sceneIndex: (state.sceneIndex + 1) % property.scenes.length };
    case 'previous': return { ...state, sceneIndex: (state.sceneIndex + property.scenes.length - 1) % property.scenes.length };
  }
}

export function createTourState(propertyId?: string, properties: TourProperty[] = tourProperties): TourState {
  const initial = { ...initialTourState, propertyId: properties[0]?.id ?? initialTourState.propertyId };
  return propertyId ? updateTourState(initial, { type: 'property', id: propertyId }, properties) : initial;
}
