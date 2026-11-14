'use client';

import { useEffect, useRef, useState } from 'react';
import { defaultExplorerSettings, presentationZones } from '@/lib/presentation-explorer';
import { zonesForConfig, type DemoConfig } from '@/lib/property-tour-config';
import { visiblePresentationArea } from '@/lib/presentation-listings';
import { pinKey, type ZoneMap, type ZoneMapTarget } from '@/lib/zone-map';
import type { PresentationSettings } from '@/lib/agency-presentation';
import type { AgencyPropertyRecord } from '@/lib/properties/agency-property-service';
import { ZoneImageMap } from './ZoneImageMap';
import styles from './agency-presentation-settings.module.css';

export function ZoneMapSettings({ settings, config, records = [], onChange }: {
  settings: PresentationSettings; config: DemoConfig; records?: AgencyPropertyRecord[];
  onChange: (maps: Record<string, ZoneMap>) => void;
}) {
  const [zoneId, setZoneId] = useState('');
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const revision = useRef(0);
  useEffect(() => { revision.current++; return () => { revision.current++; }; }, [settings]);
  const preferences = settings.explorer ?? defaultExplorerSettings;
  const zones = presentationZones(preferences, zonesForConfig(config));
  const zone = zones.find(zone => zone.id === zoneId) ?? zones[0];
  if (!zone) return <p>Agregue una zona para personalizar su mapa interno.</p>;
  const map: ZoneMap = settings.zoneMaps?.[zone.id] ?? { mode: 'google', imageUrl: '', bounds: { ...zone.bounds }, pins: [] };
  function update(change: Partial<ZoneMap>) {
    revision.current++; setError('');
    onChange({ ...settings.zoneMaps, [zone.id]: { ...map, ...change } });
  }
  const { west, east, south, north } = zone.bounds;
  const area = visiblePresentationArea({ id: zone.id, name: zone.label, geometry: { type: 'Polygon', coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] } }, config, preferences);
  const targets: ZoneMapTarget[] = [
    ...records.filter(record => !preferences.listings[record.id]?.hidden).map(record => ({ source: 'real' as const, propertyId: record.id, title: record.title, latitude: record.latitude, longitude: record.longitude })),
    ...(area?.properties ?? []).map(property => ({ source: 'example' as const, propertyId: property.id, title: `${property.title} (ejemplo)`, latitude: property.latitude, longitude: property.longitude })),
  ];
  const selectedTarget = targets.find(target => pinKey(target) === selected);
  function place(target: ZoneMapTarget, point: { x: number; y: number }) {
    update({ pins: [...map.pins.filter(pin => pinKey(pin) !== pinKey(target)), { source: target.source, propertyId: target.propertyId, ...point }] });
    setSelected(pinKey(target));
  }
  function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setError('Seleccione PNG, JPEG o WebP de hasta 2 MB.'); return; }
    const request = ++revision.current;
    const reader = new FileReader();
    reader.onload = () => {
      if (request === revision.current && typeof reader.result === 'string') update({ imageUrl: reader.result, mode: map.mode === 'google' ? 'geographic' : map.mode });
    };
    reader.onerror = () => { if (request === revision.current) setError('No se pudo leer la imagen.'); };
    reader.readAsDataURL(file);
  }
  return <details className={styles.group}><summary>Mapa interno y chinchetas de cada zona</summary>
    <p>El mapa interno es el que se abre al seleccionar una zona. Los cambios se guardan para esta inmobiliaria con Guardar cambios.</p>
    {error && <p role="alert">{error}</p>}
    <label className={styles.field}>Zona a configurar<select value={zone.id} onChange={event => { revision.current++; setZoneId(event.target.value); setSelected(''); setError(''); }}>{zones.map(zone => <option key={zone.id} value={zone.id}>{zone.label}</option>)}</select></label>
    <label className={styles.field}>Tipo de mapa interno<select value={map.mode} onChange={event => update({ mode: event.target.value as ZoneMap['mode'] })}>
      <option value="google">Vista aérea de Google (original)</option><option value="geographic">Mapa geográfico con coordenadas</option><option value="illustrated">Plano ilustrado con chinchetas manuales</option>
    </select></label>
    {map.mode !== 'google' && <>
      <label className={styles.field}>Imagen del mapa interno<input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} /><small>Hasta 2 MB por imagen. El conjunto de ajustes tiene un límite de 3 MB; para varios mapas use enlaces HTTPS.</small></label>
      <label className={styles.field}>URL de la imagen del mapa interno<input value={map.imageUrl} onChange={event => update({ imageUrl: event.target.value })} /></label>
      {map.mode === 'geographic' ? <>
        <p>Las chinchetas se ubican con las coordenadas reales. Indique los límites de la imagen para alinearlas.</p>
        <div className={styles.coordinateGrid}>{(['west', 'east', 'south', 'north'] as const).map(key => <label key={key} className={styles.field}>{({ west: 'Oeste', east: 'Este', south: 'Sur', north: 'Norte' })[key]}<input type="number" step="any" value={Number.isFinite(map.bounds[key]) ? map.bounds[key] : ''} onChange={event => update({ bounds: { ...map.bounds, [key]: event.target.value === '' ? NaN : Number(event.target.value) } })} /></label>)}</div>
      </> : <>
        <p>Seleccione una propiedad y toque el plano para vincular su chincheta. Arrastre una chincheta o use las flechas del teclado para moverla. Escape cancela el arrastre. La ubicación real no cambia.</p>
        <label className={styles.field}>Propiedad para ubicar<select value={selectedTarget ? selected : ''} onChange={event => setSelected(event.target.value)}><option value="">Seleccione una propiedad</option>{targets.map(target => <option key={pinKey(target)} value={pinKey(target)}>{target.title}</option>)}</select></label>
        {selectedTarget && <button type="button" onClick={() => update({ pins: map.pins.filter(pin => pinKey(pin) !== selected) })}>Quitar chincheta del plano</button>}
      </>}
      {map.imageUrl && <ZoneImageMap key={`${zone.id}-${map.imageUrl}-${map.mode}`} map={map} targets={targets} onSelect={target => setSelected(pinKey(target))}
        onPlace={map.mode === 'illustrated' && selectedTarget ? point => place(selectedTarget, point) : undefined} onMove={map.mode === 'illustrated' ? place : undefined} />}
    </>}
  </details>;
}
