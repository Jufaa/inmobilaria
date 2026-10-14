'use client';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import type { Property } from '@/lib/properties';
import { defaultAgencies, agencySeeds, agencyStorageKey, agencyFavoritesKey, agencyPublicPath, createAgencyRepository, type Agency } from '@/lib/agencies';
import {
  parseRepository,
  mergeDemoSeeds,
  selectPublicProperties,
  validateBrand,
  validateProperty,
  type Brand,
  type Lead,
  type Visit,
  type DemoRepository,
} from '@/lib/demo-repository';

type DemoContextValue = DemoRepository & {
  agency: Agency;
  publicPath: string;
  favoritesKey: string;
  publicProperties: Property[];
  ready: boolean;
  storageMessage: string;
  saveProperty: (property: Property) => string[];
  saveBrand: (brand: Brand) => string[];
  addLead: (lead: Omit<Lead, 'id' | 'createdAt' | 'stage' | 'note'>) => void;
  updateLead: (
    id: number,
    patch: Partial<Pick<Lead, 'stage' | 'note'>>,
  ) => void;
  addVisit: (visit: Omit<Visit, 'id'>) => void;
  reset: () => void;
};
const DemoContext = createContext<DemoContextValue | null>(null);
export function DemoProvider({ children, agency = defaultAgencies[0] }: { children: React.ReactNode; agency?: Agency }) {
  const STORAGE_KEY = agencyStorageKey(agency.id);
  const properties = agencySeeds(agency);
  const [repo, setRepo] = useState(() => createAgencyRepository(agency));
  const [ready, setReady] = useState(false);
  const [storageMessage, setStorageMessage] = useState('');
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const loaded = parseRepository(JSON.parse(raw));
        if (loaded) setRepo(mergeDemoSeeds(loaded, properties));
        else
          setStorageMessage(
            'Los datos guardados no eran válidos. Se cargó el catálogo de ejemplo.',
          );
      }
    } catch {
      setStorageMessage(
        'El navegador no permite guardar datos. La demo funciona durante esta sesión.',
      );
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(repo));
    } catch {
      setStorageMessage(
        'No se pudieron guardar los cambios. Se mantienen durante esta sesión.',
      );
    }
  }, [repo, ready]);
  const value: DemoContextValue = {
    ...repo,
    agency,
    publicPath: agencyPublicPath(agency.id),
    favoritesKey: agencyFavoritesKey(agency.id),
    ready,
    storageMessage,
    publicProperties: useMemo(
      () => selectPublicProperties(repo.catalog),
      [repo.catalog],
    ),
    saveProperty(property) {
      const errors = validateProperty(property);
      if (errors.length) return errors;
      setRepo((previous) => ({
        ...previous,
        catalog: previous.catalog.some((value) => value.id === property.id)
          ? previous.catalog.map((value) =>
              value.id === property.id ? property : value,
            )
          : [...previous.catalog, property],
      }));
      return [];
    },
    saveBrand(brand) {
      const errors = validateBrand(brand);
      if (errors.length) return errors;
      setRepo((previous) => ({ ...previous, brand }));
      return [];
    },
    addLead(lead) {
      setRepo((previous) => ({
        ...previous,
        leads: [
          {
            ...lead,
            id: Date.now(),
            createdAt: new Date().toISOString(),
            stage: 'new',
            note: '',
          },
          ...previous.leads,
        ],
      }));
    },
    updateLead(id, patch) {
      setRepo((previous) => ({
        ...previous,
        leads: previous.leads.map((lead) =>
          lead.id === id ? { ...lead, ...patch } : lead,
        ),
      }));
    },
    addVisit(visit) {
      setRepo((previous) => ({
        ...previous,
        visits: [{ ...visit, id: Date.now() }, ...previous.visits],
        leads: previous.leads.map((lead) =>
          lead.id === visit.leadId ? { ...lead, stage: 'visit' } : lead,
        ),
      }));
    },
    reset() {
      setRepo(createAgencyRepository(agency));
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(agencyFavoritesKey(agency.id));
      } catch {}
    },
  };
  const style = {
    '--accent': repo.brand.color,
    '--selection': repo.brand.color,
    '--accent-hover': repo.brand.color,
  } as CSSProperties;
  return (
    <DemoContext.Provider value={value}>
      <div className="brand-shell" style={style}>
        {children}
      </div>
    </DemoContext.Provider>
  );
}
export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error('DemoProvider is required.');
  return value;
}
