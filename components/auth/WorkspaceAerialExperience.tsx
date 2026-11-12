'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { GoogleAerialArea } from '@/components/GoogleAerialArea';
import { PropertyTourDemo } from '@/components/PropertyTourDemo';
import { TourDemoEditor } from '@/components/TourDemoEditor';
import { defaultDemoConfig, readDemoConfig, saveDemoConfig, type DemoConfig } from '@/lib/property-tour-config';
import { createPresentationArea, type PresentationZone } from '@/lib/workspace-aerial-presentation';
import type { PresentationSettings, PresentationPoint } from '@/lib/agency-presentation';
import styles from '../aerial-experience.module.css';
import { visiblePresentationArea } from '@/lib/presentation-listings';
import { defaultExplorerSettings, type PresentationFilters as Filters } from '@/lib/presentation-explorer';
import { PresentationFilters } from './PresentationFilters';
import type { PropertySummaryFields } from '@/lib/property-offers';
import type { ComponentProps } from 'react';
import type { Zone } from '@/lib/zones';

export function WorkspaceAerialExperience({ zone, onClose, settings, pointsOfInterest, initialConfig, persistDemoConfig, onConfigSaved, clean = false, filters, onFiltersChange, filterZones = [], onZoneSelect, canvasActions, canEdit = false, initialPropertyId, onSaveExampleDetails, searchControls, searchResults, matchedExampleIds }: {
  searchControls?: ReactNode; searchResults?: ReactNode; matchedExampleIds?: string[];
  canEdit?: boolean; initialPropertyId?: string;
  onSaveExampleDetails?: (id: string, fields: PropertySummaryFields) => Promise<string | null>;
  onZoneSelect?: (id: string) => void;
  canvasActions?: Pick<ComponentProps<typeof GoogleAerialArea>, 'onMapPick' | 'onPointSelect' | 'editablePointIds' | 'catalogueProperties' | 'onCatalogueSelect' | 'managementControls' | 'managementPanel' | 'floatingContent'>;
  clean?: boolean; filters?: Filters; onFiltersChange?: (value: Filters) => void; filterZones?: Zone[];
  zone: PresentationZone; onClose: () => void; settings?: PresentationSettings; pointsOfInterest?: PresentationPoint[];
  initialConfig?: DemoConfig;
  persistDemoConfig?: (value: unknown) => Promise<{ config: DemoConfig | null; error: string | null }>;
  onConfigSaved?: (config: DemoConfig) => void;
}) {
  const [config, setConfig] = useState(initialConfig ?? defaultDemoConfig);
  const [notice, setNotice] = useState('');
  const [propertyId, setPropertyId] = useState<string | null>(initialPropertyId ?? null);
  const [editorOpen, setEditorOpen] = useState(false);
  const aerial = useRef<HTMLDialogElement>(null);
  const tour = useRef<HTMLDialogElement>(null);
  const editor = useRef<HTMLDialogElement>(null);
  const tourTrigger = useRef<HTMLElement | null>(null);
  const area = useMemo(() => { const result=clean ? visiblePresentationArea(zone, config, settings?.explorer, matchedExampleIds ? {} : filters) : createPresentationArea(zone,config); return result&&matchedExampleIds ? {...result,properties:result.properties.filter(property=>matchedExampleIds.includes(property.id))}:result; }, [zone,config,clean,settings?.explorer,filters,matchedExampleIds]);
  const properties = useMemo(() => area?.properties.map(property => {
    const playback = settings?.properties[property.id];
    return playback ? { ...property.tour, entranceEnabled: true, entranceVideo: playback.videoUrl || property.tour.entranceVideo } : property.tour;
  }) ?? [], [area, settings]);

  useEffect(() => {
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = aerial.current;
    dialog?.showModal();
    try {
      if (initialConfig) setConfig(initialConfig);
      else {
        const loaded = readDemoConfig(window.localStorage);
        setConfig(loaded.config); if (loaded.error) setNotice(loaded.error);
      }
    } catch { setNotice('La presentación usa sus valores originales porque el almacenamiento local no está disponible.'); }
    return () => { dialog?.close(); if (origin?.isConnected) origin.focus(); };
  }, [initialConfig]);
  useEffect(() => { if (propertyId && !tour.current?.open) tour.current?.showModal(); }, [propertyId]);
  useEffect(() => { if (editorOpen && !editor.current?.open) editor.current?.showModal(); }, [editorOpen]);

  function openProperty(id: string) {
    if (!area?.properties.some(property => property.id === id)) return;
    tourTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPropertyId(id);
  }
  function closeTour() { tour.current?.close(); setPropertyId(null); }
  function closeEditor() { editor.current?.close(); setEditorOpen(false); }
  function applyConfig(value: unknown): string | null | Promise<string | null> {
    if (persistDemoConfig) {
      return persistDemoConfig(value).then(saved => {
        if (!saved.config) return saved.error ?? 'No se pudo guardar la personalización.';
        setConfig(saved.config);
        onConfigSaved?.(saved.config);
        setNotice('Plantillas guardadas para esta inmobiliaria y disponibles en otros dispositivos.');
        closeEditor();
        return null;
      }).catch(() => 'No se pudieron guardar las plantillas. No se modificó el catálogo.');
    }
    try {
      const saved = saveDemoConfig(window.localStorage,value);
      if (!saved.config) return saved.error;
      setConfig(saved.config); setNotice('Plantillas de presentación guardadas solo en este navegador.');
      closeEditor(); return null;
    } catch { return 'No se pudo guardar la personalización local. No se modificó el catálogo.'; }
  }

  return <div className={styles.experience}>
    <dialog ref={aerial} className={styles.aerialDialog} aria-label={`Presentación aérea de ${zone.name}`}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      {area ? <GoogleAerialArea {...canvasActions} searchControls={searchControls} searchResults={searchResults} zoneNavigation={onZoneSelect && filterZones.length > 1 ? <nav className={styles.zoneNavigation} aria-label="Cambiar de zona">
        <button type="button" aria-label="Zona anterior" onClick={() => onZoneSelect(filterZones[(filterZones.findIndex(item => item.id === zone.id) - 1 + filterZones.length) % filterZones.length].id)}>←</button>
        <label>Zona<select aria-label="Elegir zona" value={zone.id} onChange={event => onZoneSelect(event.target.value)}>{filterZones.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <button type="button" aria-label="Zona siguiente" onClick={() => onZoneSelect(filterZones[(filterZones.findIndex(item => item.id === zone.id) + 1) % filterZones.length].id)}>→</button>
      </nav> : undefined} clean={clean} preferences={settings?.explorer ?? defaultExplorerSettings} filterControls={!searchControls && clean && onFiltersChange ? <PresentationFilters value={filters ?? {}} onChange={onFiltersChange} settings={settings?.explorer ?? defaultExplorerSettings} zones={filterZones} /> : undefined} area={area} appearance={settings?.map} pointsOfInterest={pointsOfInterest} onSelect={openProperty} onClose={onClose} onEdit={canEdit ? () => setEditorOpen(true) : undefined} /> : <div className={styles.unavailable} role="alert"><h2>Esta zona no tiene una ubicación válida.</h2><p>Configura su geometría o sus coordenadas para abrir la vista aérea.</p><button onClick={onClose}>Volver al mapa</button></div>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
    </dialog>
    <dialog ref={tour} className={styles.tourDialog} aria-label="Recorrido de una propiedad de presentación"
      onCancel={(event) => { event.preventDefault(); closeTour(); }}
      onClose={() => { setPropertyId(null); if (tourTrigger.current?.isConnected) tourTrigger.current.focus(); }}>
      {propertyId && <><PropertyTourDemo onSaveDetails={canEdit && onSaveExampleDetails ? fields => onSaveExampleDetails(propertyId, fields) : undefined} focused={clean} key={propertyId} initialPropertyId={propertyId} properties={properties} onReturn={closeTour} /><button className={styles.closeTour} onClick={closeTour}><ArrowLeft size={16} /> Volver a la vista aérea <span>ESC</span></button></>}
    </dialog>
    <dialog ref={editor} className={styles.editorDialog} aria-label="Personalizar las plantillas de presentación"
      onCancel={(event) => { event.preventDefault(); closeEditor(); }} onClose={() => setEditorOpen(false)}>
      {canEdit && editorOpen && <TourDemoEditor config={config} onSave={applyConfig} onClose={closeEditor} />}
    </dialog>
  </div>;
}
