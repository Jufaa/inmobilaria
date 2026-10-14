import type { Property } from './properties';
export type Brand = { name: string; color: string; logo: string };
export type Lead = {
  id: number;
  propertyId: number;
  name: string;
  email: string;
  phone: string;
  message: string;
  stage: 'new' | 'contacted' | 'visit' | 'closed';
  createdAt: string;
  note: string;
};
export type Visit = {
  id: number;
  leadId: number;
  propertyId: number;
  date: string;
  note: string;
};
export type DemoRepository = {
  version: 1;
  seedIds?: number[];
  catalog: Property[];
  brand: Brand;
  leads: Lead[];
  visits: Visit[];
};
export const DEFAULT_BRAND: Brand = {
  name: 'Nombre de Empresa',
  color: '#0f766e',
  logo: '',
};
export const isSafeImageUrl = (value: string): boolean => {
  if (/^\/demo-assets\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/i.test(value))
    return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
};
export function whiteContrast(color: string): number {
  if (!/^#[a-f0-9]{6}$/i.test(color)) return 0;
  const values = color
    .slice(1)
    .match(/.{2}/g)!
    .map((value) => parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return (
    1.05 / (values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722 + 0.05)
  );
}
export function validateBrand(brand: Brand): string[] {
  const errors: string[] = [];
  if (!brand.name.trim() || brand.name.length > 60)
    errors.push('El nombre debe tener entre 1 y 60 caracteres.');
  if (whiteContrast(brand.color) < 4.5)
    errors.push(
      'Elegí un color más oscuro: el texto blanco debe tener contraste suficiente.',
    );
  if (brand.logo && !isSafeImageUrl(brand.logo))
    errors.push('El logo debe ser una URL HTTPS válida.');
  return errors;
}
export function validateProperty(property: Property): string[] {
  const errors: string[] = [];
  const published = property.status !== 'draft';
  if (!Number.isSafeInteger(property.id) || property.id < 1)
    errors.push('La propiedad necesita un identificador válido.');
  for (const [label, value] of [
    ['Título', property.title],
    ['Ubicación', property.address],
    ['Barrio', property.neighborhood],
    ['Descripción', property.description],
  ])
    if (
      typeof value !== 'string' ||
      (published && !value.trim()) ||
      value.length > 5000
    )
      errors.push(`${label}: completá un texto válido.`);
  if (
    !['Comprar', 'Alquilar'].includes(property.operation) ||
    !['Departamento', 'Casa', 'PH'].includes(property.type) ||
    !['Centro', 'Norte', 'Sur', 'Este', 'Oeste'].includes(property.region)
  )
    errors.push('Revisá la operación, el tipo y la zona.');
  if (!Number.isFinite(property.price) || property.price < (published ? 1 : 0))
    errors.push('Ingresá un precio mayor a cero para publicar.');
  if (!Number.isFinite(property.area) || property.area < (published ? 1 : 0))
    errors.push('Ingresá una superficie mayor a cero para publicar.');
  if (
    ![property.beds, property.baths].every(
      (value) => Number.isInteger(value) && value >= 0 && value <= 30,
    )
  )
    errors.push('Dormitorios y baños deben ser cantidades válidas.');
  if (
    !Number.isFinite(property.latitude) ||
    Math.abs(property.latitude) > 90 ||
    !Number.isFinite(property.longitude) ||
    Math.abs(property.longitude) > 180
  )
    errors.push('Revisá las coordenadas del mapa.');
  if (
    [
      property.currency,
      property.expensesCurrency,
      property.depositCurrency,
    ].some((value) => value !== undefined && !['ARS', 'USD'].includes(value))
  )
    errors.push('La moneda debe ser ARS o USD.');
  if (
    property.deposit !== undefined &&
    (!Number.isFinite(property.deposit) || property.deposit < 0)
  )
    errors.push('El depósito no puede ser negativo.');
  if (
    property.requirements !== undefined &&
    (!Array.isArray(property.requirements) ||
      property.requirements.some(
        (value) => typeof value !== 'string' || value.length > 1000,
      ))
  )
    errors.push('Revisá los requisitos.');
  if (typeof property.image !== 'string' || typeof property.tag !== 'string')
    errors.push('Foto y etiqueta deben ser textos válidos.');
  if (published && !isSafeImageUrl(property.image))
    errors.push('Agregá una foto con URL HTTPS válida.');
  if (
    property.gallery?.some((url) => !isSafeImageUrl(url)) ||
    (property.tourUrl && !isSafeImageUrl(property.tourUrl))
  )
    errors.push('Las fotos y el panorama deben usar URLs HTTPS válidas.');
  if (
    !Array.isArray(property.amenities) ||
    property.amenities.some(
      (value) => !['Balcón', 'Patio', 'Cochera'].includes(value),
    )
  )
    errors.push('Revisá los espacios seleccionados.');
  if (
    property.expenses !== undefined &&
    (!Number.isFinite(property.expenses) || property.expenses < 0)
  )
    errors.push('Las expensas no pueden ser negativas.');
  if (
    property.status &&
    !['draft', 'published', 'reserved', 'sold'].includes(property.status)
  )
    errors.push('El estado no es válido.');
  return errors;
}
export function selectPublicProperties(catalog: Property[]): Property[] {
  return catalog.filter(
    (property) =>
      !property.status ||
      property.status === 'published' ||
      property.status === 'reserved',
  );
}
export function createDefaultRepository(catalog: Property[]): DemoRepository {
  return {
    version: 1,
    seedIds: catalog.map((property) => property.id),
    catalog: catalog.map((property, index) => ({
      ...property,
      status: 'published',
      currency: property.currency ?? 'USD',
      expensesCurrency: property.expensesCurrency ?? property.currency ?? 'USD',
      expenses: property.expenses,
      gallery: property.gallery?.length
        ? property.gallery
        : index === 0
          ? [property.image, ...catalog.slice(1, 3).map((value) => value.image)]
          : [property.image],
    })),
    brand: { ...DEFAULT_BRAND },
    leads: [
      {
        id: 1,
        propertyId: 1,
        name: 'María · Ejemplo',
        email: 'maria@example.com',
        phone: '',
        message: 'Quisiera conocer el departamento y coordinar una visita.',
        stage: 'new',
        createdAt: '2026-10-12T10:00:00',
        note: '',
      },
      {
        id: 2,
        propertyId: 5,
        name: 'Carlos · Ejemplo',
        email: 'carlos@example.com',
        phone: '',
        message: '¿Cuáles son los requisitos para alquilar?',
        stage: 'contacted',
        createdAt: '2026-10-11T11:00:00',
        note: 'Consulta de demostración.',
      },
    ],
    visits: [],
  };
}
// Add only unseen seed records; never overwrite edits or re-add tracked removed examples.
export function mergeDemoSeeds(
  repository: DemoRepository,
  seeds: Property[],
): DemoRepository {
  const existingIds = new Set(
    repository.catalog.map((property) => property.id),
  );
  const seedIds = new Set(
    repository.seedIds ??
      repository.catalog
        .filter((property) => seeds.some((seed) => seed.id === property.id))
        .map((property) => property.id),
  );
  const additions = createDefaultRepository(seeds).catalog.filter(
    (property) => !existingIds.has(property.id) && !seedIds.has(property.id),
  );
  seeds.forEach((seed) => seedIds.add(seed.id));
  return {
    ...repository,
    brand:
      repository.brand.name === 'Territorio'
        ? { ...repository.brand, name: 'Nombre de Empresa' }
        : repository.brand,
    catalog: [
      ...repository.catalog.map((property) => ({
        ...property,
        currency: property.currency ?? 'USD',
        expensesCurrency:
          property.expensesCurrency ?? property.currency ?? 'USD',
        depositCurrency: property.depositCurrency ?? property.currency ?? 'USD',
      })),
      ...additions,
    ],
    seedIds: [...seedIds],
  };
}
export function parseRepository(input: unknown): DemoRepository | null {
  if (!input || typeof input !== 'object') return null;
  const repo = input as DemoRepository;
  if (
    repo.version !== 1 ||
    !Array.isArray(repo.catalog) ||
    repo.catalog.length > 1000 ||
    !repo.brand ||
    !Array.isArray(repo.leads) ||
    !Array.isArray(repo.visits)
  )
    return null;
  try {
    if (
      repo.seedIds !== undefined &&
      (!Array.isArray(repo.seedIds) ||
        repo.seedIds.some((id) => !Number.isSafeInteger(id) || id < 1))
    )
      return null;
    if (
      validateBrand(repo.brand).length ||
      repo.catalog.some((property) => validateProperty(property).length) ||
      new Set(repo.catalog.map((property) => property.id)).size !==
        repo.catalog.length
    )
      return null;
    if (
      new Set(repo.leads.map((lead) => lead.id)).size !== repo.leads.length ||
      new Set(repo.visits.map((visit) => visit.id)).size !== repo.visits.length
    )
      return null;
    if (
      repo.leads.some(
        (lead) =>
          !Number.isSafeInteger(lead.id) ||
          !repo.catalog.some((property) => property.id === lead.propertyId) ||
          typeof lead.name !== 'string' ||
          typeof lead.message !== 'string' ||
          typeof lead.email !== 'string' ||
          typeof lead.phone !== 'string' ||
          typeof lead.note !== 'string' ||
          !['new', 'contacted', 'visit', 'closed'].includes(lead.stage) ||
          !Number.isFinite(Date.parse(lead.createdAt)),
      )
    )
      return null;
    if (
      repo.visits.some(
        (visit) =>
          !Number.isSafeInteger(visit.id) ||
          !repo.leads.some(
            (lead) =>
              lead.id === visit.leadId && lead.propertyId === visit.propertyId,
          ) ||
          !repo.catalog.some((property) => property.id === visit.propertyId) ||
          !Number.isFinite(Date.parse(visit.date)) ||
          typeof visit.note !== 'string',
      )
    )
      return null;
    return repo;
  } catch {
    return null;
  }
}
