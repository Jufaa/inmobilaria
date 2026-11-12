'use client';

import { defaultExplorerSettings, presentationZones, type ExplorerSettings } from '@/lib/presentation-explorer';
import { createPresentationArea } from '@/lib/workspace-aerial-presentation';
import { listingPreference } from '@/lib/presentation-listings';
import { defaultDemoConfig, zonesForConfig, type DemoConfig } from '@/lib/property-tour-config';
import type { AgencyPropertyRecord } from '@/lib/properties/agency-property-service';
import type { PresentationSettings, PresentationPoint } from '@/lib/agency-presentation';
import { PresentationZoneEditor } from './PresentationZoneEditor';
import styles from './agency-presentation-settings.module.css';
import { PanelColorPicker } from './PanelColorPicker';

export function PresentationExplorerSettings({ settings, onChange, config = defaultDemoConfig, mode = 'simple', onPointsChange, realProperties }: {
  realProperties?: AgencyPropertyRecord[];
  settings: PresentationSettings; onChange: (value: ExplorerSettings) => void; config?: DemoConfig; mode?: 'simple' | 'advanced' | 'map' | 'properties' | 'appearance'; onPointsChange?: (points: PresentationPoint[]) => void;
}) {
  const preferences = settings.explorer ?? defaultExplorerSettings;
  const fallback = realProperties ? [] : zonesForConfig(config);
  const zones = preferences.zones ?? fallback.map(area => ({ id: area.id, name: area.label, bounds: area.bounds, color: settings.map.accentColor, enabled: true, videoUrl: settings.zones[area.id]?.transitionEnabled ? settings.zones[area.id].videoUrl : '', duration: 4 as const }));
  const update = (change: Partial<ExplorerSettings>) => onChange({ ...structuredClone(preferences), ...change });
  const listings = realProperties ? [] : presentationZones(preferences, fallback).flatMap(zone => {
    const { west, east, south, north } = zone.bounds;
    return createPresentationArea({ id: zone.id, name: zone.label, geometry: { type: 'Polygon', coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] } }, config)?.properties ?? [];
  });
  if (mode === 'advanced' || mode === 'appearance') return <div className={styles.simpleSettings}>
    <details open><summary>Nombre, colores e información</summary><div className={styles.group}>
      <div className={styles.paletteGrid}>
        <PanelColorPicker label="Fondo de ventanas" value={preferences.popupColor} onChange={popupColor => update({ popupColor })} />
        <PanelColorPicker label="Texto de ventanas" value={preferences.popupTextColor} onChange={popupTextColor => update({ popupTextColor })} />
        {Object.entries(realProperties ? Object.fromEntries(['Casa','Departamento','Dúplex','PH','Lote','Local','Otro'].map(kind => [kind, preferences.kindColors[kind] ?? '#4c8067'])) : preferences.kindColors).map(([kind, color]) => <PanelColorPicker key={kind} label={`Color de ${kind}`} value={color} onChange={value => update({ kindColors: { ...preferences.kindColors, [kind]: value } })} />)}
      </div>
      {([['showLegend', 'Mostrar leyenda de colores'], ['showPrices', 'Mostrar precios sin seleccionar (las ofertas siempre se destacan)'], ['showDetails', 'Mostrar información ampliada inicialmente']] as const).map(([key, label]) => <label className={styles.toggle} key={key}><input type="checkbox" checked={preferences[key]} onChange={event => update({ [key]: event.target.checked })} />{label}</label>)}
    </div></details>
    <details><summary>Filtros disponibles para el visitante</summary><div className={styles.group}>
      {([['zone', 'Zona'], ['price', 'Precio y moneda'], ['kind', 'Tipo de propiedad'], ['bedrooms', 'Habitaciones'], ['garage', 'Cochera']] as const).map(([key, label]) => <label className={styles.toggle} key={key}><input type="checkbox" checked={preferences.filters[key]} onChange={event => update({ filters: { ...preferences.filters, [key]: event.target.checked } })} />{label}</label>)}
    </div></details>
    {!realProperties && <button className={styles.secondaryButton} type="button" onClick={() => update({ zones: null })}>Usar zonas de las plantillas</button>}
  </div>;
  const propertyPanel = <>
    <details open={mode === 'properties'}><summary>Propiedades</summary><div className={styles.group}>
      <p>Active Mostrar y Oferta en cada propiedad de ejemplo. El catálogo real no se modifica.</p>
      {listings.map(property => {
        const pref = preferences.listings[property.id] ?? listingPreference(property);
        const change = (value: Partial<typeof pref>) => update({ listings: { ...preferences.listings, [property.id]: { ...pref, ...value } } });
        return <details key={property.id}><summary>{property.title} · {property.tour.neighborhood}</summary><div className={styles.propertyQuick}>
          <label className={styles.toggle}><input type="checkbox" checked={pref.offer} onChange={event => change({ offer: event.target.checked })} />Destacar como oferta</label>
          <label className={styles.toggle}><input type="checkbox" checked={!pref.hidden} onChange={event => change({ hidden: !event.target.checked })} />Mostrar</label>
          <details><summary>Más opciones</summary><div className={styles.pointGrid}><label className={styles.field}>Tipo<select value={pref.kind} onChange={event => change({ kind: event.target.value })}>{Object.keys(preferences.kindColors).map(kind => <option key={kind}>{kind}</option>)}</select></label>
          <label className={styles.field}>Habitaciones<input type="number" min={0} max={50} value={pref.bedrooms} onChange={event => change({ bedrooms: event.target.value === '' ? NaN : Number(event.target.value) })} /></label>
          <label className={styles.field}>Cochera<select value={pref.garage === null ? '' : pref.garage ? 'yes' : 'no'} onChange={event => change({ garage: event.target.value === '' ? null : event.target.value === 'yes' })}><option value="">Sin informar</option><option value="yes">Con cochera</option><option value="no">Sin cochera</option></select></label>
        </div></details></div></details>;
      })}
    </div></details>
  </>;
  if (mode === 'properties' && realProperties) return <div className={styles.simpleSettings}>
    <p>Seleccione una propiedad para decidir cómo se muestra en el mapa. Los precios y fotos se administran en el catálogo.</p>
    {realProperties.map(property => {
      const previous = preferences.listings[property.id] ?? { hidden: false, offer: false, kind: property.type, bedrooms: property.bedrooms, garage: null };
      const change = (value: Partial<typeof previous>) => update({ listings: { ...preferences.listings, [property.id]: { ...previous, ...value } } });
      return <details key={property.id}><summary>{property.title}</summary><div className={styles.group}>
        <label className={styles.toggle}><input type="checkbox" checked={!previous.hidden} onChange={event => change({ hidden: !event.target.checked })} />Mostrar en el mapa</label>
        <label className={styles.toggle}><input type="checkbox" checked={previous.offer} onChange={event => change({ offer: event.target.checked })} />Destacar como oferta</label>
      </div></details>;
    })}
  </div>;
  if (mode === 'properties') return <div className={styles.simpleSettings}>{propertyPanel}</div>;
  return <div className={styles.simpleSettings}>
    <label className={styles.field}>Nombre visible del mapa<input maxLength={100} value={preferences.name} onChange={event => update({ name: event.target.value })} placeholder="Nombre de la inmobiliaria" /></label>
    <PresentationZoneEditor simple={!!realProperties} zones={zones} appearance={settings.map} points={realProperties ? [] : settings.points} onPointsChange={realProperties ? undefined : onPointsChange} onChange={value => update({ zones: value })} />
    {mode === 'simple' && propertyPanel}
  </div>;
}
