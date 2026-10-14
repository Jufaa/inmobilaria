import { properties } from './properties.ts';
import { createDefaultRepository, validateBrand, type DemoRepository } from './demo-repository.ts';
export type Agency = { id: string; name: string; color: string; logo: string; status: 'active' | 'paused'; sample: number };
export const AGENCY_REGISTRY_KEY = 'territorio-agencies-v1';
export const defaultAgencies: Agency[] = [
  { id: 'principal', name: 'Nombre de Empresa', color: '#0f766e', logo: '', status: 'active', sample: 0 },
  { id: 'rio-inmuebles', name: 'Río Inmuebles', color: '#1e40af', logo: '', status: 'active', sample: 1 },
  { id: 'sur-propiedades', name: 'Sur Propiedades', color: '#7e2248', logo: '', status: 'paused', sample: 2 },
];
export const agencyStorageKey = (id: string) => id === 'principal' ? 'territorio-demo-v1' : `territorio-agency-${id}-v1`;
export const agencyFavoritesKey = (id: string) => id === 'principal' ? 'territorio-favorites' : `territorio-favorites-${id}`;
export const agencyPublicPath = (id: string) => `/inmobiliaria/${encodeURIComponent(id)}`;
export const agencyPropertyPath = (id: string, propertyId: number) => `${agencyPublicPath(id)}#propiedad=${propertyId}`;
export function parseAgencies(raw: unknown): Agency[] | null {
  if (!Array.isArray(raw) || !raw.length || raw.length > 100) return null;
  const ids = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !/^[a-z0-9-]{1,60}$/.test(item.id) || ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 80 || !/^#[0-9a-f]{6}$/i.test(item.color) || typeof item.logo !== 'string' || !['active','paused'].includes(item.status) || ![0,1,2,3].includes(item.sample)) return null;
    if (validateBrand({name:item.name,color:item.color,logo:item.logo}).length) return null;
    ids.add(item.id);
  }
  if (!ids.has('principal')) return null;
  return raw as Agency[];
}
export function agencySeeds(agency: Agency) {
  if (agency.sample === 0) return properties;
  if (agency.sample === 3) return [];
  const selected = [...properties.filter(p => p.operation === 'Comprar').slice(0,4), ...properties.filter(p => p.operation === 'Alquilar').slice(agency.sample === 1 ? 0 : 6, agency.sample === 1 ? 6 : 12)];
  return selected.map((p, i) => ({...p, id: agency.sample * 10000 + i + 1, title: `${p.title} · ${agency.sample === 1 ? 'Río' : 'Sur'}`, price: Math.round(p.price * (agency.sample === 1 ? 1.03 : .97)), status: 'published' as const}));
}
export function createAgencyRepository(agency: Agency): DemoRepository {
  const repo = createDefaultRepository(agencySeeds(agency));
  if (agency.id === 'principal') return repo;
  return {...repo, brand: {name: agency.name, color: agency.color, logo: agency.logo}, leads: [], visits: []};
}
