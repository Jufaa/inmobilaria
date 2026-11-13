'use client';

import type { DemoConfig } from '@/lib/property-tour-config';
import { zonesForConfig } from '@/lib/property-tour-config';
import { defaultExplorerSettings, presentationZones, type ExplorerSettings, type ListingPreference } from '@/lib/presentation-explorer';
import type { PresentationSettings } from '@/lib/agency-presentation';
import { visiblePresentationArea } from '@/lib/presentation-listings';
import styles from './agency-presentation-settings.module.css';

export function ExamplePropertyFields({settings,config,onChange}:{settings:PresentationSettings;config:DemoConfig;onChange:(preferences:ExplorerSettings)=>void}) {
  const preferences=settings.explorer??defaultExplorerSettings;
  const examples=presentationZones(preferences,zonesForConfig(config)).flatMap(zone=>{
    const {west,east,south,north}=zone.bounds;
    return visiblePresentationArea({id:zone.id,name:zone.label,geometry:{type:'Polygon',coordinates:[[[west,south],[east,south],[east,north],[west,north],[west,south]]]}},config,preferences)?.properties??[];
  });
  return <details><summary>Propiedades de ejemplo · precio y características</summary><p>Estos cambios son ilustrativos y no crean propiedades reales.</p>
    {examples.map(property=>{
      const previous=preferences.listings[property.id]??{hidden:false,offer:false,kind:property.kind,bedrooms:property.tour.bedrooms,garage:null};
      const change=(fields:Partial<ListingPreference>)=>onChange({...preferences,listings:{...preferences.listings,[property.id]:{...previous,...fields}}});
      return <details key={property.id}><summary>{property.title}</summary><div className={styles.group}><div className={styles.pointGrid}>
        <label className={styles.field}>Título<input maxLength={100} value={property.title} onChange={event=>change({title:event.target.value})}/></label>
        <label className={styles.field}>Precio<input type="number" min={0} max={1e12} value={Number.isFinite(property.amount)?property.amount:''} onChange={event=>change({amount:event.target.value===''?NaN:Number(event.target.value)})}/></label>
        <label className={styles.field}>Moneda<select value={property.currency??'USD'} onChange={event=>change({currency:event.target.value as 'ARS'|'USD'})}><option>USD</option><option>ARS</option></select></label>
        <label className={styles.field}>Superficie (m²)<input type="number" min={0.01} max={99999999} step="any" value={property.tour.area} onChange={event=>change({area:event.target.value===''?NaN:Number(event.target.value)})}/></label>
        <label className={styles.field}>Dormitorios<input type="number" min={0} max={50} value={property.tour.bedrooms} onChange={event=>change({bedrooms:event.target.value===''?NaN:Number(event.target.value)})}/></label>
        <label className={styles.field}>Baños<input type="number" min={0} max={50} value={property.tour.bathrooms} onChange={event=>change({bathrooms:event.target.value===''?NaN:Number(event.target.value)})}/></label>
        <label className={styles.field}>Características<input maxLength={2400} value={(property.tour.features??[]).join(', ')} onChange={event=>change({features:event.target.value.split(',').map(item=>item.trim()).filter(Boolean)})}/></label>
      </div></div></details>;
    })}
  </details>;
}
