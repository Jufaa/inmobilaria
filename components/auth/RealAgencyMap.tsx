'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { AgencyPropertyRecord } from '@/lib/properties/agency-property-service';
import { zonesForConfig, type DemoConfig } from '@/lib/property-tour-config';
import type { PresentationZone } from '@/lib/workspace-aerial-presentation';
import { AgencyIntro } from './AgencyIntro';
import { MapSearchControls } from './MapSearchControls';
import { MapSidebarControls } from './MapWorkspaceLayout';
import { buildPropertySearchResults, normalizePropertySearch, propertyZoneId, type PropertySearchFilters, type PropertySearchResult } from '@/lib/property-search';
import { PropertySearchResults } from './PropertySearchResults';
import { PropertyOffersPopup } from './PropertyOffersPopup';
import { agencyOfferTargets } from '@/lib/agency-offer-targets';
import type { OfferTarget, PropertySummaryFields } from '@/lib/property-offers';
import { WorkspaceAerialExperience } from './WorkspaceAerialExperience';
import type { PresentationPoint, PresentationSettings } from '@/lib/agency-presentation';
import { defaultExplorerSettings, effectivePropertyKindColors, presentationZones } from '@/lib/presentation-explorer';
import { RealMapPropertyForm, type MapPropertyResult } from './RealMapPropertyForm';
import { RealArtworkMap } from './RealArtworkMap';
import { RealPropertyDetail } from './RealPropertyDetail';
import { PresentationFilters } from './PresentationFilters';
import { PresentationVideo } from './PresentationVideo';
import styles from './real-agency-map.module.css';

const CityMap = dynamic(() => import('../CityMap'), { ssr: false });
const names: Record<string, string> = { HOUSE:'Casa', APARTMENT:'Departamento', PH:'PH', LAND:'Lote', COMMERCIAL:'Local', OTHER:'Otro' };
export function RealAgencyMap({ agencySlug, agencyId, agencyName, properties, settings: initialSettings, photosEnabled, onCreate, onUpdate, canCustomize = false, canManageCatalogue = canCustomize, embedded = false, exampleConfig, persistDemoConfig, persistSettings, referencePoints = [], fullscreen = false }: {
  agencySlug: string; agencyId: string; agencyName: string; properties: AgencyPropertyRecord[];
  settings: PresentationSettings; photosEnabled: boolean; onCreate: (data: FormData) => Promise<MapPropertyResult>;
  onUpdate: (propertyId: string, data: FormData) => Promise<MapPropertyResult>;
  exampleConfig?: DemoConfig;
  persistDemoConfig?: (value: unknown) => Promise<{ config: DemoConfig | null; error: string | null }>;
  persistSettings?: (value: unknown) => Promise<{ settings: PresentationSettings | null; error: string | null }>;
  referencePoints?: PresentationPoint[];
  fullscreen?: boolean;
  canCustomize?: boolean; canManageCatalogue?: boolean; embedded?: boolean;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [searchQuery,setSearchQuery]=useState('');
  const [requestedExampleId, setRequestedExampleId] = useState<string | undefined>(undefined);
  const [offerRevision, setOfferRevision] = useState(0);
  const [records, setRecords] = useState(properties);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [filters, setFilters] = useState<PropertySearchFilters>({});
  const [transition, setTransition] = useState<string | null>(null);
  const ids = useRef(new Map<string, number>());
  useEffect(() => { setRecords(properties); }, [properties]);
  useEffect(() => { setSettings(initialSettings); }, [initialSettings]);
  // Stable numeric render IDs bridge CityMap without changing stored catalogue IDs.
  for (const record of records) if (!ids.current.has(record.id)) ids.current.set(record.id, -(ids.current.size + 1));
  const [examples, setExamples] = useState(exampleConfig);
  const [activeExampleId, setActiveExampleId] = useState<string | null>(null);
  const [focusedZoneId, setFocusedZoneId] = useState<string | null>(null);
  const [zoneRevision, setZoneRevision] = useState(0);
  const aerialMode = !!examples && !embedded;
  const preferences = settings.explorer ?? defaultExplorerSettings;
  const effectivePreferences = { ...preferences, kindColors: effectivePropertyKindColors(preferences.kindColors) };
  const zones = useMemo(() => presentationZones(preferences, examples ? zonesForConfig(examples) : []), [preferences, examples]);
  const selected = records.find(record => record.id === selectedId);
  const zoneFor = (record: AgencyPropertyRecord) => propertyZoneId(record,zones);
  const searchFilters={...filters,query:searchQuery};
  const searchResults=useMemo(()=>buildPropertySearchResults({properties:records,settings,examples,zones,filters:searchFilters}),[records,settings,examples,zones,filters,searchQuery]);
  const visibleIds=new Set(searchResults.filter(item=>item.source==='real').map(item=>item.id));
  const visible=records.filter(record=>visibleIds.has(record.id));
  const markers = visible.filter(record => record.latitude !== null && record.longitude !== null).map(record => ({
    id: ids.current.get(record.id)!, latitude: record.latitude!, longitude: record.longitude!, price: record.price, currency: record.currency, address: record.title,
    showPrice: preferences.showPrices || !!preferences.listings[record.id]?.offer, markerColor: effectivePreferences.kindColors[names[record.type]],
  }));
  const mapPoints: PresentationPoint[] = [];
  const offerTargets = useMemo(() => agencyOfferTargets(records, settings, examples), [records, settings, examples]);
  const focusedAreas = focusedZoneId ? zones.filter(zone => zone.id === focusedZoneId) : zones;
  const selectedArea = zones.find(zone => zone.id === activeExampleId);
  const activeExampleZone: PresentationZone | null = selectedArea ? {
    id: selectedArea.id, name: selectedArea.label,
    geometry: { type: 'Polygon', coordinates: [[[selectedArea.bounds.west, selectedArea.bounds.south], [selectedArea.bounds.east, selectedArea.bounds.south], [selectedArea.bounds.east, selectedArea.bounds.north], [selectedArea.bounds.west, selectedArea.bounds.north], [selectedArea.bounds.west, selectedArea.bounds.south]]] },
  } : null;
  function enterZone(id: string) {
    if (examples) setActiveExampleId(id);
    else setFilters(current => ({ ...current, zone:id }));
  }
  function selectZone(id: string) {
    if (!zones.some(zone => zone.id === id)) return;
    setFocusedZoneId(id); setZoneRevision(current => current + 1);
    const custom = preferences.zones?.find(item => item.id === id);
    const videoUrl = custom ? custom.videoUrl : settings.zones?.[id]?.transitionEnabled ? settings.zones[id].videoUrl : '';
    if (videoUrl) setTransition(id); else enterZone(id);
  }
  const transitionArea = zones.find(zone => zone.id === transition);
  const transitionPreference = preferences.zones?.find(zone => zone.id === transition);
  const activeTransition = transitionArea ? { id:transitionArea.id, name:transitionArea.label,
    videoUrl:transitionPreference ? transitionPreference.videoUrl : settings.zones?.[transitionArea.id]?.videoUrl ?? '', duration:transitionPreference?.duration ?? 4 } : null;
  function cancelPlacement() { setPlacing(false); setPosition(null); }
  function pickOnAerial(point: [number, number]) {
    if (!canManageCatalogue || !placing || !point.every(Number.isFinite) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) return;
    setPosition(point); setPlacing(false);
  }
  async function saveExampleDetails(id: string, fields: PropertySummaryFields): Promise<string | null> {
    const target = offerTargets.find(item => item.source === 'example' && item.id === id);
    if (!canCustomize || !persistSettings || !target) return 'No tiene permiso para editar esta propiedad.';
    const previous = preferences.listings[id] ?? { hidden:false, offer:false, kind:target.kind??'Departamento', garage:null };
    const listing = { ...previous, ...fields };
    const result=await persistSettings({ ...settings, explorer:{...preferences,listings:{...preferences.listings,[id]:listing}} });
    if (!result.settings || result.error) return result.error || 'No se pudieron guardar los datos.';
    setSettings(result.settings);return null;
  }
  function selectOffer(target: OfferTarget) {
    cancelPlacement();setSearchQuery('');
    if (target.source === 'real') { setActiveExampleId(null); setSelectedId(target.id); }
    else if (target.zoneId) { setFilters({});setFocusedZoneId(target.zoneId);setZoneRevision(current=>current+1);setRequestedExampleId(target.id);setOfferRevision(current=>current+1);setActiveExampleId(target.zoneId); }
  }
  const hasSearch=!!normalizePropertySearch(searchQuery)||Object.values(filters).some(value=>value?.trim());
  const offerPopup = hasSearch?null:<PropertyOffersPopup offers={preferences.offers??[]} targets={offerTargets} onSelect={selectOffer}/>;
  const propertyForm = position ? <RealMapPropertyForm agencySlug={agencySlug} agencyId={agencyId} position={position} photosEnabled={photosEnabled} initial={editing ? selected : undefined}
    onCreate={editing && selected ? data => onUpdate(selected.id, data) : onCreate}
    onCancel={() => { setPosition(null); setEditing(false); }}
    onSaved={record => { setRecords(current => [record, ...current.filter(item => item.id !== record.id)]); setPosition(null); setEditing(false); setActiveExampleId(null); setSelectedId(record.id); router.refresh(); }} /> : null;
  const aerialControls = canManageCatalogue ? <div className={styles.actions}>
    {placing ? <><span role="status">Toque el mapa para colocar la propiedad.</span><button type="button" onClick={cancelPlacement}>Cancelar</button></> : <button type="button" className={styles.primary} onClick={()=>setPlacing(true)}>Agregar propiedad</button>}
  </div> : undefined;
  const searching=hasSearch;
  function clearSearch(){setFilters({});setSearchQuery('');}
  function selectSearchResult(target:PropertySearchResult){
    cancelPlacement();setEditing(false);
    if(target.source==='real'){setActiveExampleId(null);setSelectedId(target.id);}
    else if(target.zoneId){setSelectedId(null);setFocusedZoneId(target.zoneId);setZoneRevision(current=>current+1);setRequestedExampleId(target.id);setOfferRevision(current=>current+1);setActiveExampleId(target.zoneId);}
  }
  const resultCards=searching?<PropertySearchResults key={JSON.stringify(searchFilters)} items={searchResults} onSelect={selectSearchResult} onClear={clearSearch}/>:null;
  const filterControls=<>
    <label>Buscar propiedad o zona<input type="search" value={searchQuery} onChange={event=>setSearchQuery(event.target.value)} placeholder="Nombre, barrio, dirección o característica" autoComplete="off"/></label>
    <PresentationFilters value={filters} onChange={next=>{setFilters(next);if(!Object.keys(next).length)setSearchQuery('');}} settings={effectivePreferences} zones={zones} expanded advanced bare/>
  </>;
  const operationExtras=<>
    {preferences.showLegend&&<details><summary>Colores de propiedades</summary><div className={styles.sidebarLegend}>{Object.entries(effectivePreferences.kindColors).map(([kind,color])=><span key={kind}><i aria-hidden="true" className={styles.legendSwatch} style={{backgroundColor:color}}/>{kind}</span>)}</div></details>}
    {records.some(record=>record.latitude===null||record.longitude===null)&&<p className={styles.sidebarHelp}>Hay propiedades sin ubicación. Puede consultarlas desde Propiedades.</p>}
  </>;
  const popupStyle = { '--panel-surface':preferences.popupColor, '--panel-text':preferences.popupTextColor } as CSSProperties;
  return <section className={`${styles.workspace} ${fullscreen ? styles.fullscreen : ''}`}>
    {fullscreen&&<MapSidebarControls>{operationExtras}</MapSidebarControls>}
    {fullscreen&&<div className={styles.filterPosition} data-map-filter-controls><MapSearchControls>{filterControls}</MapSearchControls></div>}
    {!fullscreen&&<header className={styles.toolbar}><h1>{preferences.name || `Mapa de ${agencyName}`}</h1><div className={styles.actions}>
      {canManageCatalogue && !aerialMode && !selected && !position && <button type="button" className={styles.primary} onClick={() => setPlacing(true)}>Agregar propiedad</button>}
      {canCustomize && !embedded && <a href={`/inmobiliaria/${encodeURIComponent(agencySlug)}/panel/personalizacion`}>Personalizar</a>}
    </div></header>}
    {selected && !editing ? <div className={fullscreen?styles.selectedContent:undefined} style={popupStyle}><RealPropertyDetail whatsappContact={settings.propertyContacts?.[selected.id]} property={selected} onBack={() => setSelectedId(null)} onEdit={canManageCatalogue ? () => { setEditing(true); setPosition([selected.longitude!, selected.latitude!]); } : undefined} /></div> : position && !activeExampleZone ? propertyForm : <>
      {!fullscreen&&(placing ? <p className={styles.notice} role="status">Toque el mapa para ubicar la propiedad. <button type="button" onClick={() => setPlacing(false)}>Cancelar</button></p> : <PresentationFilters value={filters} onChange={setFilters} settings={effectivePreferences} zones={zones} advanced/>)}
      <div className={styles.canvas}>{settings.map.mode === 'artwork' && settings.map.artworkUrl ? <RealArtworkMap appearance={settings.map} areas={zones}
        areaColors={Object.fromEntries((preferences.zones ?? []).map(zone => [zone.id, zone.color]))} points={aerialMode ? [] : mapPoints} markers={aerialMode ? [] : markers}
        onSelect={id => setSelectedId(records.find(record => ids.current.get(record.id) === id)?.id ?? null)} onAreaSelect={selectZone}
        onMapPick={canManageCatalogue && !aerialMode && placing ? point => { setPosition(point); setPlacing(false); } : undefined} /> : <CityMap properties={aerialMode ? [] : markers} selected={null} onSelect={id => { if (!placing) setSelectedId(records.find(record => ids.current.get(record.id) === id)?.id ?? null); }}
        visible={!activeExampleZone && !activeTransition} controlsBlocked={!!activeExampleZone || !!activeTransition} focusProperty={null} focusRevision={0} areas={focusedAreas} zoneRevision={zoneRevision} onSearchArea={() => {}} overview compact appearance={settings.map} pointsOfInterest={aerialMode ? [] : mapPoints}
        areaColors={Object.fromEntries((preferences.zones ?? []).map(zone => [zone.id, zone.color]))} onAreaSelect={placing ? undefined : selectZone}
        editing={placing} onMapPick={canManageCatalogue && !aerialMode && placing ? point => { setPosition(point); setPlacing(false); } : undefined} />}{offerPopup&&(preferences.offers?.length??0)>0&&<div className={styles.offersPosition} data-map-offers>{offerPopup}</div>}</div>
      {!records.length && !examples && <p>Agregue la primera propiedad desde el mapa.</p>}
      {!fullscreen && records.some(record => record.latitude === null || record.longitude === null) && <p>Hay propiedades sin ubicación. Puede completarlas en <a href={`/inmobiliaria/${encodeURIComponent(agencySlug)}/panel/propiedades`}>Propiedades</a>.</p>}
      {!fullscreen && preferences.showLegend && <div className={styles.toolbar} aria-label="Leyenda del mapa">{Object.entries(effectivePreferences.kindColors).filter(([kind]) => records.some(record => names[record.type] === kind)).map(([kind,color]) => <span key={kind}><i aria-hidden="true" className={styles.legendSwatch} style={{backgroundColor:color}}/>{kind}</span>)}</div>}
    </>}
    {!selected&&!position&&!activeExampleZone&&resultCards&&<div className={styles.resultsPosition} data-map-search-results>{resultCards}</div>}
    {activeExampleZone && examples && <WorkspaceAerialExperience key={`${activeExampleZone.id}-${offerRevision}`} initialPropertyId={requestedExampleId} canEdit={canCustomize} onSaveExampleDetails={canCustomize ? saveExampleDetails : undefined} zone={activeExampleZone} clean
      settings={settings} pointsOfInterest={mapPoints} initialConfig={examples} persistDemoConfig={persistDemoConfig} onConfigSaved={setExamples}
      filters={filters} onFiltersChange={setFilters} filterZones={zones}
      searchControls={<MapSearchControls>{filterControls}</MapSearchControls>} searchResults={resultCards} matchedExampleIds={searchResults.filter(item=>item.source==='example').map(item=>item.id)}
      onZoneSelect={id => { if (!zones.some(item => item.id === id)) return; cancelPlacement(); setFocusedZoneId(id); setZoneRevision(current => current + 1); setRequestedExampleId(undefined); setActiveExampleId(id); }}
      canvasActions={{ managementControls:aerialControls, managementPanel:propertyForm ?? undefined, floatingContent:offerPopup,
        onMapPick:canManageCatalogue && placing ? pickOnAerial : undefined,
        catalogueProperties:visible.filter(record => zoneFor(record) === activeExampleZone.id && record.latitude !== null && record.longitude !== null).map(record => ({ id:record.id, title:record.title, latitude:record.latitude!, longitude:record.longitude!, price:record.price, currency:record.currency, color:effectivePreferences.kindColors[names[record.type]], showPrice:preferences.showPrices || !!preferences.listings[record.id]?.offer })),
        onCatalogueSelect:id => { setActiveExampleId(null); setSelectedId(id); },
      }}
      onClose={() => { cancelPlacement(); setActiveExampleId(null); setRequestedExampleId(undefined); setFocusedZoneId(null); setZoneRevision(current => current + 1); }} />}
    <AgencyIntro key={`${agencyId}|${settings.intro.videoUrl}`} agencyId={agencyId} src={settings.intro.videoUrl} title={agencyName} enabled={!embedded&&settings.intro.enabled}/>
    {activeTransition && <PresentationVideo key={activeTransition.id} src={activeTransition.videoUrl} title={activeTransition.name} continueLabel="Ver zona" integrated maxSeconds={activeTransition.duration} onContinue={() => { enterZone(activeTransition.id); setTransition(null); }} onBack={() => setTransition(null)} />}
  </section>;
}
