'use client';

import type { ExplorerSettings } from '@/lib/presentation-explorer';
import type { PropertySearchFilters } from '@/lib/property-search';
import type { Zone } from '@/lib/zones';
import styles from './agency-presentation-map.module.css';

export function PresentationFilters({ value, onChange, settings, zones, expanded = false, advanced = false, bare = false }: {
  expanded?: boolean; advanced?: boolean; bare?: boolean;
  value: PropertySearchFilters; onChange: (value: PropertySearchFilters) => void; settings: ExplorerSettings; zones: Zone[];
}) {
  const change = (key: keyof PropertySearchFilters, next: string) => onChange({ ...value, [key]: next });
  const fields=<div className={styles.filterFields}>
    {advanced&&<small>Todos los campos son opcionales. Deje en blanco lo que no quiera filtrar.</small>}
    {advanced&&<label>Operación<select value={value.operation??''} onChange={event=>change('operation',event.target.value)}><option value="">Venta y alquiler</option><option value="SALE">Venta</option><option value="RENT">Alquiler</option></select></label>}
    {settings.filters.zone && <label>Zona<select value={value.zone ?? ''} onChange={event => change('zone', event.target.value)}><option value="">Todas las zonas</option>{zones.map(zone => <option key={zone.id} value={zone.id}>{zone.label}</option>)}</select></label>}
    {settings.filters.price && <><label>Moneda<select value={value.currency ?? (advanced ? '' : 'USD')} onChange={event => change('currency', event.target.value)}><>{advanced&&<option value="">Todas las monedas</option>}<option>USD</option><option>ARS</option></></select></label><label>Precio mínimo<input type="number" min={0} value={value.min ?? ''} onChange={event => change('min', event.target.value)} /></label><label>Precio máximo<input type="number" min={0} value={value.max ?? ''} onChange={event => change('max', event.target.value)} /></label></>}
    {settings.filters.kind && <label>Tipo<select value={value.kind ?? ''} onChange={event => change('kind', event.target.value)}><option value="">Todos</option>{Object.keys(settings.kindColors).map(kind => <option key={kind}>{kind}</option>)}</select></label>}
    {settings.filters.bedrooms && !advanced && <label>Habitaciones<select value={value.bedrooms ?? ''} onChange={event => change('bedrooms', event.target.value)}><option value="">Cualquiera</option>{Array.from({ length: 51 }, (_, index) => <option key={index} value={index}>{index}</option>)}</select></label>}
    {settings.filters.garage && <label>Cochera<select value={value.garage ?? ''} onChange={event => change('garage', event.target.value)}><option value="">Cualquiera</option><option value="yes">Con cochera</option><option value="no">Sin cochera</option></select></label>}
    {advanced&&<>
      {settings.filters.bedrooms&&<><label>Dormitorios desde<input type="number" min={0} max={50} step={1} value={value.minBedrooms??''} onChange={event=>change('minBedrooms',event.target.value)}/></label><label>Dormitorios hasta<input type="number" min={0} max={50} step={1} value={value.maxBedrooms??''} onChange={event=>change('maxBedrooms',event.target.value)}/></label></>}
      <details><summary>Más características</summary><div className={styles.filterFields}>
        <label>Superficie mínima (m²)<input type="number" min={0} value={value.minArea??''} onChange={event=>change('minArea',event.target.value)}/></label>
        <label>Superficie máxima (m²)<input type="number" min={0} value={value.maxArea??''} onChange={event=>change('maxArea',event.target.value)}/></label>
        <label>Baños desde<input type="number" min={0} max={50} step={1} value={value.bathrooms??''} onChange={event=>change('bathrooms',event.target.value)}/></label>
        <label>Características<input type="search" placeholder="Patio, pileta, balcón…" value={value.features??''} onChange={event=>change('features',event.target.value)}/><small>Separe con comas las características que necesita.</small></label>
        <label>Estado<select value={value.status??''} onChange={event=>change('status',event.target.value)}><option value="">Todos</option><option value="PUBLISHED">Publicada</option><option value="RESERVED">Reservada</option><option value="DRAFT">Borrador</option><option value="SOLD">Vendida</option><option value="UNAVAILABLE">No disponible</option></select></label>
        <label>Ofertas<select value={value.offersOnly??''} onChange={event=>change('offersOnly',event.target.value)}><option value="">Todas las propiedades</option><option value="yes">Solo ofertas</option></select></label>
      </div></details>
      {[[value.min,value.max],[value.minArea,value.maxArea],[value.minBedrooms,value.maxBedrooms]].some(([min,max])=>min&&max&&Number(min)>Number(max))&&<p role="alert">El mínimo no puede ser mayor que el máximo.</p>}
    </>}
    <button type="button" onClick={() => onChange({})}>Limpiar filtros</button>
    {(value.min || value.max) && <small>Los importes se comparan solo en su moneda original; no se convierten.</small>}
  </div>;
  return bare?fields:<details className={styles.filterPanel} open={expanded || undefined}><summary>Filtros</summary>{fields}</details>;
}
