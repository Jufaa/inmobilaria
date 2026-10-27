'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import MobileHelp from './MobileHelp';
import { useDemo } from './DemoProvider';
import PropertyExtras from './PropertyExtras';
import InquiryForm from './InquiryForm';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bath,
  BedDouble,
  Check,
  ChevronDown,
  Heart,
  LayoutGrid,
  Map,
  MapPin,
  Maximize,
  Search,
  SlidersHorizontal,
  Square,
  X,
} from 'lucide-react';
import { formatPrice, type Property } from '@/lib/properties';
import {
  filterProperties,
  parseBudget,
  type SearchFilters,
} from '@/lib/search';
import {
  zones,
  resolveAreaQuery,
  getAreaSuggestions,
  type MapBounds,
} from '@/lib/zones';
const CityMap = dynamic(() => import('./CityMap'), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <span className="spinner" />
      Preparando la ciudad…
    </div>
  ),
});
const Panorama = dynamic(() => import('./Panorama'), { ssr: false });

export default function Explorer() {
  const { publicProperties: properties, brand, agency, publicPath, favoritesKey } = useDemo();
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [operation, setOperation] = useState('Comprar');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('USD');
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchNotice, setSearchNotice] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [areaDraft, setAreaDraft] = useState<string[]>([]);
  const [zoneRevision, setZoneRevision] = useState(0);
  const [zonesOpen, setZonesOpen] = useState(false);
  const [type, setType] = useState('Departamento');
  const [minBeds, setMinBeds] = useState('0');
  const [maxPrice, setMaxPrice] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const budgetCurrency = useRef(currency);
  useEffect(() => {
    if (budgetCurrency.current === currency) return;
    budgetCurrency.current = currency;
    setMinPrice('');
    setMaxPrice('');
    setSearchNotice('Cambiaste la moneda de búsqueda. Ingresá un nuevo presupuesto.');
  }, [currency]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [viewport, setViewport] = useState<MapBounds | null>(null);
  const [filters, setFilters] = useState(false);
  const [sort, setSort] = useState('featured');
  const [favorites, setFavorites] = useState<number[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [searchCollapsed, setSearchCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpKey = `territorio-help-v1-${agency.id}`;
  const closeHelp = useCallback(() => {
    setHelpOpen(false);
    try { localStorage.setItem(helpKey, 'seen'); } catch {}
  }, [helpKey]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const update = () => {
      setMobile(media.matches);
      if (media.matches) { setView('map'); setSearchCollapsed(true); }
      else setSearchCollapsed(false);
    };
    update();
    if(media.matches) { try { if(localStorage.getItem(helpKey) !== 'seen') setHelpOpen(true); } catch {} }
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [helpKey]);

  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<Property | null>(null);
  const [tour, setTour] = useState(false);
  const [contact, setContact] = useState(false);
  const [view, setView] = useState<'map' | 'catalog'>('map');
  const [focusRequest, setFocusRequest] = useState<{
    id: number;
    revision: number;
  } | null>(null);
  const focusSequence = useRef(0);
  const searchOverlay = useRef<HTMLDivElement>(null);
  const locationInput = useRef<HTMLInputElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const modal = useRef<HTMLDivElement>(null);
  const [savedReady, setSavedReady] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem(favoritesKey) || '[]',
      );
      if (Array.isArray(stored))
        setFavorites(stored.filter((v) => typeof v === 'number'));
    } catch {
      /* Storage is optional. */
    }
    setSavedReady(true);
  }, []);
  useEffect(() => {
    if (savedReady)
      try {
        localStorage.setItem(favoritesKey, JSON.stringify(favorites));
      } catch {
        /* Storage is optional. */
      }
  }, [favorites, savedReady]);
  useEffect(() => {
    if (!detail) return;
    previousFocus.current = document.activeElement as HTMLElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetail(null);
      if (event.key === 'Tab') {
        const nodes = modal.current?.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, textarea, [tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', handle);
      previousFocus.current?.focus();
    };
  }, [detail]);

  useEffect(() => {
    const openHash = () => {
      const match = window.location.hash.match(/^#propiedad=(\d+)$/);
      if (!match) return;
      const property = properties.find(
        (value) => value.id === Number(match[1]),
      );
      if (property) {
        setDetail(property);
        setSelected(property.id);
        setActivePhoto(null);
        setTour(false);
        setContact(false);
      }
    };
    openHash();
    window.addEventListener('hashchange', openHash);
    return () => window.removeEventListener('hashchange', openHash);
  }, [properties]);
  const activeAreas = useMemo(
    () => zones.filter((zone) => areaIds.includes(zone.id)),
    [areaIds],
  );
  useEffect(() => {
    if (!mobile || searchCollapsed) return;
    const previous = document.activeElement as HTMLElement;
    const panel = searchOverlay.current;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel?.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if(event.key === 'Escape') setSearchCollapsed(true);
      if(event.key !== 'Tab') return;
      const nodes = panel?.querySelectorAll<HTMLElement>('button:not([disabled]),input,select,a[href]');
      const items = nodes ? [...nodes].filter(node => node.getClientRects().length > 0) : [];
      if (!items.length) return;
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey && document.activeElement === first) {event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement === last){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',keydown);
    return () => { document.body.style.overflow=old;document.removeEventListener('keydown',keydown);previous?.focus(); };
  }, [mobile, searchCollapsed]);
  const suggestions = getAreaSuggestions(searchDraft);
  const searchFilters: SearchFilters = {
    operation,
    currency,
    search,
    type,
    minBeds: Number(minBeds),
    minPrice: parseBudget(minPrice),
    maxPrice: parseBudget(maxPrice),
    neighborhood: '',
    areaIds,
    amenities,
    onlyFavorites,
    favorites,
    viewport,
  };
  const results = useMemo(
    () =>
      filterProperties(properties, searchFilters).sort((a, b) =>
        (sort === 'low' || sort === 'high')
          ? (a.price - b.price) *
            (sort === 'high' ? -1 : 1)
          : a.id - b.id,
      ),
    [
      properties,
      operation,
      currency,
      search,
      type,
      minBeds,
      minPrice,
      maxPrice,
      areaIds,
      amenities,
      onlyFavorites,
      favorites,
      viewport,
      sort,
    ],
  );
  const applyAreas = (ids: string[], notice = '') => {
    setSearchNotice(notice);
    setAreaIds(ids);
    setAreaDraft(ids);
    setSearch('');
    setSearchDraft('');
    setViewport(null);
    setSelected(null);
    setFocusRequest(null);
    setZonesOpen(false);
    setSuggestionsOpen(false);
    if (ids.length) {
      setZoneRevision((revision) => revision + 1);
      setView('map');
    }
  };
  const submitSearch = () => {
    const ids = resolveAreaQuery(searchDraft);
    if (/\b(departamentos?|apartamentos?|deptos?)\b/i.test(searchDraft))
      setType('Departamento');
    if (ids.length) {
      applyAreas(
        ids,
        /^(zona\s+)?usr$/i.test(searchDraft.trim())
          ? 'Interpretamos “usr” como zona Sur.'
          : '',
      );
      return;
    }
    setSearchNotice('');
    setSearch(searchDraft.trim());
    setAreaIds([]);
    setAreaDraft([]);
    setViewport(null);
    setSuggestionsOpen(false);
    setSelected(null);
    setFocusRequest(null);
  };
  const searchViewport = (bounds: MapBounds) => {
    setViewport(bounds);
    setAreaIds([]);
    setAreaDraft([]);
    setSelected(null);
    setFocusRequest(null);
  };
  const toggleFavorite = (id: number) =>
    setFavorites((values) =>
      values.includes(id)
        ? values.filter((value) => value !== id)
        : [...values, id],
    );
  const showDetail = (property: Property) => {
    setActivePhoto(null);
    setDetail(property);
    setSelected(property.id);
    setTour(false);
    setContact(false);
  };
  const selectOnMap = (id: number, force = false) => {
    if (id === selected && !force) return;
    setSelected(id);
    focusSequence.current += 1;
    setFocusRequest({ id, revision: focusSequence.current });
  };
  const locateProperty = (property: Property) => {
    selectOnMap(property.id, true);
    setView('map');
  };
  const resetFilters = () => {
    setSearch('');
    setSearchDraft('');
    setSearchNotice('');
    setAreaIds([]);
    setAreaDraft([]);
    setViewport(null);
    setMinBeds('0');
    setMinPrice('');
    setMaxPrice('');
    setAmenities([]);
    setOnlyFavorites(false);
    setType('Departamento');
  };
  const changeView = (next: 'map' | 'catalog') => {
    setView(next);
    setFilters(false);
    setZonesOpen(false);
    setSuggestionsOpen(false);
  };
  const preview = results.find((property) => property.id === selected);
  const focusedProperty = focusRequest
    ? (properties.find((property) => property.id === focusRequest.id) ?? null)
    : null;
  const invalidBudget =
    !!minPrice && !!maxPrice && Number(minPrice) > Number(maxPrice);
  const activeChips: {
    id: string;
    label: string;
    clear: () => void;
    patch: Partial<SearchFilters>;
  }[] = [
    ...activeAreas.map((area) => ({
      id: area.id,
      label: area.label,
      clear: () => {
        setAreaIds((values) => values.filter((value) => value !== area.id));
        setAreaDraft((values) => values.filter((value) => value !== area.id));
      },
      patch: { areaIds: areaIds.filter((id) => id !== area.id) },
    })),
    ...(search
      ? [
          {
            id: 'search',
            label: `“${search}”`,
            clear: () => {
              setSearch('');
              setSearchDraft('');
            },
            patch: { search: '' },
          },
        ]
      : []),
    ...(viewport
      ? [
          {
            id: 'viewport',
            label: 'Área visible del mapa',
            clear: () => setViewport(null),
            patch: { viewport: null },
          },
        ]
      : []),
    ...(minBeds !== '0'
      ? [
          {
            id: 'beds',
            label: `${minBeds}+ dormitorios`,
            clear: () => setMinBeds('0'),
            patch: { minBeds: 0 },
          },
        ]
      : []),
    ...(maxPrice || minPrice
      ? [
          {
            id: 'budget',
            label: maxPrice
              ? `Hasta ${formatPrice(parseBudget(maxPrice) ?? 0, currency)}`
              : `Desde ${formatPrice(parseBudget(minPrice) ?? 0, currency)}`,
            clear: () => {
              setMinPrice('');
              setMaxPrice('');
            },
            patch: { minPrice: null, maxPrice: null },
          },
        ]
      : []),
    ...amenities.map((amenity) => ({
      id: amenity,
      label: amenity,
      clear: () =>
        setAmenities((values) => values.filter((value) => value !== amenity)),
      patch: { amenities: amenities.filter((value) => value !== amenity) },
    })),
    ...(onlyFavorites
      ? [
          {
            id: 'favorites',
            label: 'Favoritos',
            clear: () => setOnlyFavorites(false),
            patch: { onlyFavorites: false },
          },
        ]
      : []),
  ];
  const recoveryOptions =
    results.length === 0
      ? activeChips
          .map((chip) => ({
            ...chip,
            count: filterProperties(properties, {
              ...searchFilters,
              ...chip.patch,
            }).length,
          }))
          .filter((chip) => chip.count > 0)
          .slice(0, 2)
      : [];
  const renderRecovery = () => (
    <div className="search-recovery">
      {recoveryOptions.map((option) => (
        <button key={option.id} onClick={option.clear}>
          Quitar {option.label}
          <span>{option.count} opciones</span>
        </button>
      ))}
      {type === 'Departamento' &&
        filterProperties(properties, { ...searchFilters, type: 'Todas' })
          .length > 0 && (
          <button onClick={() => setType('Todas')}>
            Ver también casas y PH
            <ArrowUpRight size={17} />
          </button>
        )}
    </div>
  );
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFilters(false);
        setZonesOpen(false);
        setSuggestionsOpen(false);
      }
    };
    const outside = (event: PointerEvent) => {
      if (!searchOverlay.current?.contains(event.target as Node)) {
        setFilters(false);
        setZonesOpen(false);
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', outside);
    };
  }, []);
  const renderCard = (property: Property) => (
    <article className="property-card" key={property.id}>
      <div className="card-image">
        <button
          className="image-link"
          onClick={() => showDetail(property)}
          aria-label={`Ver ${property.title}`}
        >
          <img
            src={property.image}
            alt={`Interior de referencia para ${property.title}`}
            loading="lazy"
          />
        </button>
        <span className="property-tag">{property.tag}</span>
        <button
          className={`favorite-button ${favorites.includes(property.id) ? 'saved' : ''}`}
          onClick={() => toggleFavorite(property.id)}
          aria-label={`${favorites.includes(property.id) ? 'Quitar de' : 'Agregar a'} favoritos: ${property.address}`}
          aria-pressed={favorites.includes(property.id)}
        >
          <Heart
            size={17}
            fill={favorites.includes(property.id) ? 'currentColor' : 'none'}
          />
        </button>
        <button
          className="image-tour"
          onClick={() => {
            showDetail(property);
            setTour(true);
          }}
        >
          360° <Maximize size={13} />
        </button>
      </div>
      <div className="card-content">
        <div className="card-location">
          <MapPin size={13} />
          {property.neighborhood}
          <span>{property.type}</span>
        </div>
        <button className="card-title" onClick={() => showDetail(property)}>
          {property.title}
        </button>
        <p className="card-address">{property.address}</p>
        <div className="card-features">
          <span>
            <BedDouble size={15} />
            {property.beds} dorm.
          </span>
          <span>
            <Bath size={15} />
            {property.baths} baños
          </span>
          <span>
            <Square size={14} />
            {property.area} m²
          </span>
        </div>
        <div className="card-bottom">
          <strong>
            {formatPrice(property.price, property.currency ?? 'USD')}
            {property.operation === 'Alquilar' && <small> / mes</small>}
          </strong>
          <button
            onClick={() => showDetail(property)}
            aria-label={`Ver detalles de ${property.address}`}
          >
            <ArrowUpRight size={20} />
          </button>
        </div>
        <button
          className="card-locate"
          onClick={() => locateProperty(property)}
        >
          <MapPin size={13} /> Ver en el mapa <ArrowUpRight size={13} />
        </button>
      </div>
    </article>
  );
  return (
    <main className={`map-first-app easy-search-app ${mobile ? 'mobile-ready' : ''}`}>
      <header className="app-header">
        <a className="brand" href={publicPath} aria-label={`${brand.name}, inicio`}>
          <span className="brand-symbol">
            <i />
            <i />
            <i />
          </span>
          {brand.logo && (
            <img className="public-brand-logo" src={brand.logo} alt="" />
          )}
          {brand.name}
          <span className="brand-dot">.</span>
        </a>
        <span className="header-city">{agency.status === 'paused' ? 'Pausada · Vista previa' : 'Río Cuarto, Córdoba'}</span>
        <Link className="panel-access" href={`${publicPath}/panel`}>
          Panel inmobiliaria
        </Link>
        <div
          className="view-tabs"
          role="tablist"
          aria-label="Ver propiedades como mapa o listado"
        >
          {(
            [
              { id: 'map', label: 'Mapa', Icon: Map },
              { id: 'catalog', label: 'Listado', Icon: LayoutGrid },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              id={`tab-${id}`}
              role="tab"
              aria-selected={view === id}
              aria-controls={`panel-${id}`}
              tabIndex={view === id ? 0 : -1}
              className={view === id ? 'active' : ''}
              onClick={() => changeView(id)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                  event.preventDefault();
                  const next = view === 'map' ? 'catalog' : 'map';
                  changeView(next);
                  document.getElementById(`tab-${next}`)?.focus();
                }
              }}
            >
              <Icon size={21} />
              {label}
            </button>
          ))}
        </div>
        <button
          className={`header-favorites ${onlyFavorites ? 'active' : ''}`}
          onClick={() => setOnlyFavorites(!onlyFavorites)}
          aria-pressed={onlyFavorites}
        >
          <Heart size={21} fill={onlyFavorites ? 'currentColor' : 'none'} />
          Favoritos <b>{favorites.length}</b>
        </button>
      </header>
      {mobile && helpOpen && <MobileHelp onClose={closeHelp} />}
      <section
        className={`app-stage ${view === 'catalog' ? 'catalog-active' : ''} ${searchCollapsed ? 'search-collapsed' : ''}`}
        aria-label="Buscar propiedades en Río Cuarto"
      >
        <div className="mobile-map-toolbar">
          <button onClick={() => { setHelpOpen(false); setSearchCollapsed(false); }}><Search size={20}/>Buscar y filtrar</button>
          <button onClick={() => { setSearchCollapsed(true); setHelpOpen(true); }}>Ayuda</button>
          <p>{operation === 'Comprar' ? 'Venta' : 'Alquiler'} · {activeAreas.length ? activeAreas.map(area=>area.label).join(', ') : 'Toda la ciudad'} · <strong>{results.length} resultados</strong></p>
        </div>
        {mobile && !searchCollapsed && <button className="mobile-filter-backdrop" aria-label="Cerrar filtros" onClick={() => setSearchCollapsed(true)} tabIndex={-1} />}
        {searchCollapsed && (
          <button
            id="reopen-search"
            className="reopen-search"
            onClick={() => {
              setSearchCollapsed(false);
              requestAnimationFrame(() => locationInput.current?.focus());
            }}
          >
            <Search size={20} />
            Mostrar búsqueda · {results.length} resultados
          </button>
        )}
        <aside
          hidden={searchCollapsed}
          className="search-overlay easy-search-panel"
          ref={searchOverlay}
          aria-label="Opciones de búsqueda"
          role={mobile ? 'dialog' : undefined}
          aria-modal={mobile ? true : undefined}
        >
          <button
            className="collapse-search"
            onClick={() => {
              setSearchCollapsed(true);
              requestAnimationFrame(() =>
                document.getElementById('reopen-search')?.focus(),
              );
            }}
            aria-label="Ocultar búsqueda para explorar el mapa"
          >
            {mobile ? 'Cerrar filtros' : 'Ocultar búsqueda'} <X size={18} />
          </button>
          <div className="search-panel-intro">
            <h1>Encontrá tu departamento</h1>
            <p>Río Cuarto · Catálogo de ejemplo</p>
          </div>
          <div className="operation-tabs" aria-label="Comprar o alquilar">
            {['Comprar', 'Alquilar'].map((op) => (
              <button
                key={op}
                className={operation === op ? 'active' : ''}
                aria-pressed={operation === op}
                onClick={() => {
                  setOperation(op);
                  setCurrency(op === 'Alquilar' ? 'ARS' : 'USD');

                  setMinPrice('');
                  setMaxPrice('');
                }}
              >
                {op}
              </button>
            ))}
          </div>
          <form
            className="location-form"
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch();
            }}
          >
            <label htmlFor="location-search">¿Dónde querés vivir?</label>
            <div className="location-search-row">
              <input
                id="location-search"
                ref={locationInput}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={suggestionsOpen && suggestions.length > 0}
                aria-controls="location-suggestions"
                aria-activedescendant={
                  suggestionsOpen && suggestionIndex >= 0
                    ? `location-option-${suggestionIndex}`
                    : undefined
                }
                placeholder="Ej.: sur, centro o Banda Norte"
                value={searchDraft}
                onChange={(event) => {
                  setSearchDraft(event.target.value);
                  setSuggestionsOpen(true);
                  setSuggestionIndex(-1);
                }}
                onFocus={() => setSuggestionsOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' && suggestions.length) {
                    event.preventDefault();
                    setSuggestionsOpen(true);
                    setSuggestionIndex(
                      (index) => (index + 1) % suggestions.length,
                    );
                  } else if (event.key === 'ArrowUp' && suggestions.length) {
                    event.preventDefault();
                    setSuggestionsOpen(true);
                    setSuggestionIndex(
                      (index) =>
                        (index - 1 + suggestions.length) % suggestions.length,
                    );
                  } else if (
                    event.key === 'Enter' &&
                    suggestionsOpen &&
                    suggestionIndex >= 0 &&
                    suggestions[suggestionIndex]
                  ) {
                    event.preventDefault();
                    applyAreas(
                      [suggestions[suggestionIndex].id],
                      /^(zona\s+)?usr$/i.test(searchDraft.trim())
                        ? 'Interpretamos “usr” como zona Sur.'
                        : '',
                    );
                  } else if (event.key === 'Escape') {
                    setSuggestionsOpen(false);
                    setSuggestionIndex(-1);
                  }
                }}
              />
              <button type="submit" className="primary-button">
                <Search size={19} />
                Buscar
              </button>
            </div>
            {suggestionsOpen && suggestions.length > 0 && (
              <ul
                id="location-suggestions"
                className="location-suggestions"
                role="listbox"
                aria-label="Zonas sugeridas"
              >
                {suggestions.map((area, index) => (
                  <li
                    key={area.id}
                    id={`location-option-${index}`}
                    role="option"
                    aria-selected={suggestionIndex === index}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() =>
                      applyAreas(
                        [area.id],
                        /^(zona\s+)?usr$/i.test(searchDraft.trim())
                          ? 'Interpretamos “usr” como zona Sur.'
                          : '',
                      )
                    }
                  >
                    <MapPin size={19} />
                    <span>
                      {searchDraft.trim().toLowerCase() === 'usr'
                        ? `Sur — ¿quisiste decir “sur”?`
                        : area.label}
                      <small>
                        {area.kind === 'region'
                          ? 'Zona de la ciudad'
                          : 'Barrio'}
                      </small>
                    </span>
                    <ArrowUpRight size={19} />
                  </li>
                ))}
              </ul>
            )}
          </form>
          {searchNotice && (
            <p className="search-notice" role="status">
              {searchNotice}
            </p>
          )}
          <button
            className="choose-zones-button"
            onClick={() => {
              setAreaDraft(areaIds);
              setZonesOpen(!zonesOpen);
              setFilters(false);
              setSuggestionsOpen(false);
            }}
            aria-expanded={zonesOpen}
            aria-controls="zone-picker"
          >
            <MapPin size={19} />
            {areaIds.length
              ? 'Cambiar o sumar zonas'
              : 'Elegir una o varias zonas'}
            <ChevronDown size={18} />
          </button>
          {zonesOpen && (
            <div id="zone-picker" className="zone-panel">
              <div className="filter-heading">
                <strong>Podés elegir varias zonas</strong>
                <button
                  onClick={() => setZonesOpen(false)}
                  aria-label="Cerrar selección de zonas"
                >
                  <X size={20} />
                </button>
              </div>
              {['region', 'neighborhood'].map((kind) => (
                <fieldset key={kind} className="zone-group">
                  <legend>
                    {kind === 'region' ? 'Zonas de la ciudad' : 'Barrios'}
                  </legend>
                  {zones
                    .filter((area) => area.kind === kind)
                    .map((area) => (
                      <label key={area.id}>
                        <input
                          type="checkbox"
                          checked={areaDraft.includes(area.id)}
                          onChange={() =>
                            setAreaDraft((values) =>
                              values.includes(area.id)
                                ? values.filter((value) => value !== area.id)
                                : [...values, area.id],
                            )
                          }
                        />
                        <span>{area.label}</span>
                      </label>
                    ))}
                </fieldset>
              ))}
              <div className="zone-actions">
                <button onClick={() => applyAreas([])}>Toda la ciudad</button>
                <button
                  className="primary-button"
                  onClick={() => applyAreas(areaDraft)}
                >
                  Ver zonas elegidas
                </button>
              </div>
              <p className="zone-demo-note">
                Áreas orientativas de ejemplo. No son límites oficiales.
              </p>
            </div>
          )}
          <div className="currency-display-control">
            <label htmlFor="price-currency">Moneda del precio</label>
            <select
              id="price-currency"
              aria-describedby="price-currency-help"
              value={currency}
              onChange={(event) =>
                setCurrency(event.target.value as 'ARS' | 'USD')
              }
            >
              <option value="ARS">Pesos (ARS)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
            <small id="price-currency-help">
              Se muestran propiedades publicadas en esta moneda, sin conversión.
            </small>
          </div>
          <div className="simple-filters">
            <label>
              Precio máximo ({currency}){' '}
              {operation === 'Alquilar' ? 'por mes' : ''}
              <input
                type="text"
                inputMode="decimal"
                
                value={maxPrice}
                placeholder={
                  currency === 'ARS' ? 'Ej.: 800.000' : 'Ej.: 800'
                }
                onChange={(event) => setMaxPrice(event.target.value)}
              />
            </label>
            <label>
              Dormitorios
              <select
                value={minBeds}
                onChange={(event) => setMinBeds(event.target.value)}
              >
                <option value="0">Cualquiera</option>
                <option value="1">1 o más</option>
                <option value="2">2 o más</option>
                <option value="3">3 o más</option>
              </select>
            </label>
          </div>

          <div className="secondary-search">
            <label>
              Tipo de inmueble
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                <option>Departamento</option>
                <option value="Todas">Todos los inmuebles</option>
                <option>Casa</option>
                <option>PH</option>
              </select>
            </label>
            <button
              className="more-filters-button"
              onClick={() => {
                setFilters(!filters);
                setZonesOpen(false);
              }}
              aria-expanded={filters}
              aria-controls="property-filters"
            >
              <SlidersHorizontal size={19} />
              Más filtros
            </button>
          </div>
          {filters && (
            <div className="filter-panel" id="property-filters">
              <label>
                Precio mínimo ({currency})
                <input
                  type="text"
                  inputMode="decimal"
                  
                  value={minPrice}
                  placeholder="Sin mínimo"
                  onChange={(event) => setMinPrice(event.target.value)}
                />
              </label>
              <fieldset className="amenity-fields">
                <legend>Espacios que te importan</legend>
                {['Balcón', 'Patio', 'Cochera'].map((amenity) => (
                  <label key={amenity}>
                    <input
                      type="checkbox"
                      checked={amenities.includes(amenity)}
                      onChange={() =>
                        setAmenities((values) =>
                          values.includes(amenity)
                            ? values.filter((value) => value !== amenity)
                            : [...values, amenity],
                        )
                      }
                    />
                    {amenity}
                  </label>
                ))}
              </fieldset>
              <button
                className="primary-button"
                onClick={() => setFilters(false)}
                disabled={invalidBudget}
              >
                Listo
              </button>
            </div>
          )}
          {(Number.isNaN(parseBudget(minPrice)) ||
            Number.isNaN(parseBudget(maxPrice))) && (
            <p className="budget-error" role="alert">
              Revisá el monto. Ejemplo: 800000 o 800.000, sin símbolo de moneda.
            </p>
          )}
          {invalidBudget && (
            <p className="budget-error" role="alert">
              El precio mínimo no puede superar el máximo.
            </p>
          )}
          <div
            className="search-summary"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <strong>{results.length}</strong>{' '}
            {type === 'Departamento' ? 'departamentos' : 'inmuebles'}{' '}
            {operation === 'Comprar' ? 'en venta' : 'en alquiler'}
            {activeAreas.length > 0 && (
              <span>
                {' '}
                en {activeAreas.map((area) => area.label).join(' o ')}
              </span>
            )}
            {viewport && <span> en el área visible</span>}
          </div>
          {activeChips.length > 0 && (
            <div className="active-filter-chips" aria-label="Búsqueda actual">
              {activeChips.map((chip) => (
                <button
                  key={chip.id}
                  onClick={chip.clear}
                  aria-label={`Quitar ${chip.label}`}
                >
                  {chip.label}
                  <X size={17} />
                </button>
              ))}
              <button className="clear-all" onClick={resetFilters}>
                Limpiar búsqueda
              </button>
            </div>
          )}
          {!activeAreas.length && !search && !viewport && (
            <p className="search-default-note">Buscás en toda la ciudad.</p>
          )}
          <button className="mobile-favorites-filter" onClick={() => setOnlyFavorites(!onlyFavorites)} aria-pressed={onlyFavorites}><Heart size={18}/>{onlyFavorites ? 'Mostrando favoritos' : 'Solo favoritos'} · {favorites.length}</button>
          <button className="mobile-apply-filters primary-button" onClick={() => setSearchCollapsed(true)} disabled={invalidBudget}>Ver {results.length} propiedades</button>
        </aside>
        <div
          className="view-layer map-view"
          id="panel-map"
          role="tabpanel"
          aria-labelledby="tab-map"
          hidden={view !== 'map'}
        >
          <CityMap
            controlsBlocked={mobile && (!searchCollapsed || helpOpen)}
            properties={results}
            selected={preview?.id ?? null}
            onSelect={selectOnMap}
            visible={view === 'map'}
            focusProperty={focusedProperty}
            focusRevision={focusRequest?.revision ?? 0}
            areas={activeAreas}
            zoneRevision={zoneRevision}
            onSearchArea={searchViewport}
          />
          {results.length === 0 && (
            <div className="map-empty">
              <Search size={27} />
              <h2>No hay resultados con esta búsqueda.</h2>
              <p>Podés quitar una condición o buscar en toda la ciudad.</p>
              {renderRecovery()}
              <button onClick={resetFilters}>Limpiar búsqueda</button>
            </div>
          )}
          {preview && (
            <article
              className="map-preview"
              aria-label={`Propiedad seleccionada: ${preview.address}`}
            >
              <button
                className="preview-image"
                onClick={() => showDetail(preview)}
                aria-label="Abrir ficha de la propiedad"
              >
                <img
                  src={preview.image}
                  alt="Fotografía ilustrativa del departamento seleccionado"
                />
              </button>
              <div className="preview-content">
                <div className="preview-topline">
                  <span>
                    <MapPin size={16} />
                    {preview.neighborhood}
                  </span>
                  <button
                    onClick={() => setSelected(null)}
                    aria-label="Cerrar propiedad seleccionada"
                  >
                    <X size={20} />
                  </button>
                </div>
                <h2>{preview.title}</h2>
                <p>
                  {preview.area} m² · {preview.beds} dormitorios
                </p>
                <div className="preview-bottom">
                  <strong>
                    {formatPrice(preview.price, preview.currency ?? 'USD')}
                  </strong>
                  <button onClick={() => showDetail(preview)}>
                    Ver detalles <ArrowUpRight size={18} />
                  </button>
                </div>
              </div>
            </article>
          )}
        </div>
        <div
          className="view-layer catalog-view"
          id="panel-catalog"
          role="tabpanel"
          aria-labelledby="tab-catalog"
          hidden={view !== 'catalog'}
        >
          <div className="catalog-inner">
            <div className="results-heading">
              <div>
                <p className="eyebrow">Río Cuarto · Propiedades de ejemplo</p>
                <h1>
                  {onlyFavorites
                    ? 'Tus favoritos'
                    : type === 'Departamento'
                      ? 'Departamentos disponibles'
                      : 'Propiedades disponibles'}
                </h1>
                <p>{results.length} resultados</p>
              </div>
              <label className="sort-select">
                Ordenar por
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="featured">Destacadas</option>
                  <option value="low" >
                    Menor precio
                  </option>
                  <option value="high" >
                    Mayor precio
                  </option>
                </select>
              </label>
            </div>
            <div className="property-list">
              {results.length ? (
                results.map(renderCard)
              ) : (
                <div className="empty-state">
                  <Search size={30} />
                  <h2>No hay resultados con esta búsqueda.</h2>
                  <p>Probá quitar una condición.</p>
                  {renderRecovery()}
                  <button onClick={resetFilters}>Limpiar búsqueda</button>
                </div>
              )}
            </div>
            <footer className="catalog-footer">
              Catálogo de demostración · Fotos y ubicaciones ilustrativas
            </footer>
          </div>
        </div>
      </section>
      {detail && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetail(null);
          }}
        >
          <div
            className="property-modal"
            ref={modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
          >
            <div className="modal-top">
              <span>ATELIER / {detail.neighborhood.toUpperCase()}</span>
              <button
                ref={closeButton}
                className="icon-button"
                onClick={() => setDetail(null)}
                aria-label="Cerrar ficha"
              >
                <X size={22} />
              </button>
            </div>
            <div className="detail-visual">
              {tour ? (
                <Panorama url={detail.tourUrl} />
              ) : (
                <img
                  src={activePhoto ?? detail.image}
                  alt="Fotografía de referencia del interior"
                />
              )}
              <div className="visual-tabs">
                <button
                  className={!tour ? 'active' : ''}
                  onClick={() => setTour(false)}
                >
                  Fotografía
                </button>
                <button
                  className={tour ? 'active' : ''}
                  onClick={() => setTour(true)}
                >
                  Explorar 360° <Maximize size={13} />
                </button>
              </div>
            </div>
            <div className="detail-body">
              <div className="detail-location">
                <MapPin size={14} />
                {detail.address} · {detail.neighborhood}, Río Cuarto, Córdoba
              </div>
              <div className="detail-heading">
                <h2 id="detail-title">{detail.title}</h2>
                <button
                  className="icon-button"
                  onClick={() => toggleFavorite(detail.id)}
                  aria-label="Guardar propiedad"
                  aria-pressed={favorites.includes(detail.id)}
                >
                  <Heart
                    fill={
                      favorites.includes(detail.id) ? 'currentColor' : 'none'
                    }
                  />
                </button>
              </div>
              <div className="detail-facts">
                <span>
                  <BedDouble />
                  {detail.beds} dormitorios
                </span>
                <span>
                  <Bath />
                  {detail.baths} baños
                </span>
                <span>
                  <Square />
                  {detail.area} m² totales
                </span>
              </div>
              <p className="detail-description">{detail.description}</p>
              <PropertyExtras
                key={detail.id}
                property={detail}
                onPhotoSelect={(url) => {
                  setActivePhoto(url);
                  setTour(false);
                }}
              />
              <p className="demo-note">
                Publicación de ejemplo. Fotos ilustrativas y panorama 360° de
                demostración.
              </p>
              <div className="detail-bottom">
                <div>
                  <span>
                    {detail.operation === 'Comprar'
                      ? 'PRECIO DE VENTA'
                      : 'ALQUILER MENSUAL'}
                  </span>
                  <strong>
                    {formatPrice(detail.price, detail.currency ?? 'USD')}
                  </strong>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setContact(!contact)}
                >
                  {contact ? 'Cerrar consulta' : 'Me interesa esta propiedad'}
                  <ArrowUpRight size={18} />
                </button>
              </div>
              {contact && <InquiryForm key={detail.id} property={detail} />}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
