import type { AgencyPropertyRecord } from './properties/agency-property-service';
import type { PresentationSettings } from './agency-presentation.ts';
import type { DemoConfig } from './property-tour-config.ts';
import type { Zone } from './zones.ts';
import type { OfferTarget } from './property-offers.ts';
import { defaultExplorerSettings, enabledPresentationFilters, matchesPresentationFilters, type PresentationFilters } from './presentation-explorer.ts';
import { visiblePresentationArea } from './presentation-listings.ts';

export type PropertySearchFilters = PresentationFilters & {
  query?: string; minArea?: string; maxArea?: string; minBedrooms?: string; maxBedrooms?: string;
  bathrooms?: string; operation?: string; status?: string; features?: string; offersOnly?: string;
};
export type PropertySearchResult = OfferTarget & {
  area: number; bedrooms: number; bathrooms: number; features: string[]; image?: string;
  description?: string; address?: string; neighborhood?: string; operation?: string; status?: string;
  garage: boolean | null; offer: boolean;
};
const kinds: Record<string,string> = { HOUSE:'Casa', APARTMENT:'Departamento', PH:'PH', LAND:'Lote', COMMERCIAL:'Local', OTHER:'Otro' };
export function normalizePropertySearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
export function propertyZoneId(record: AgencyPropertyRecord, zones: Zone[]) {
  return zones.find(zone => record.longitude !== null && record.latitude !== null && record.longitude >= zone.bounds.west && record.longitude <= zone.bounds.east && record.latitude >= zone.bounds.south && record.latitude <= zone.bounds.north)?.id ?? '';
}
export function buildPropertySearchResults({properties,settings,examples,zones,filters}: {
  properties: AgencyPropertyRecord[]; settings: PresentationSettings; examples?: DemoConfig; zones: Zone[]; filters: PropertySearchFilters;
}): PropertySearchResult[] {
  const preferences=settings.explorer??defaultExplorerSettings;
  const base=enabledPresentationFilters(filters,preferences);
  // An empty currency is unrestricted; amounts are never converted between currencies.
  base.currency=preferences.filters.price ? filters.currency??'' : '';
  const selectedPlan = base.zone ? settings.zoneMaps?.[base.zone] : undefined;
  const linkedToSelectedPlan = (id: string) => selectedPlan?.mode === 'illustrated' && selectedPlan.pins.some(pin => pin.source === 'real' && pin.propertyId === id);
  const offered=(source:'real'|'example',id:string)=>!!preferences.listings[id]?.offer || !!preferences.offers?.some(offer=>offer.enabled&&offer.source===source&&offer.propertyId===id);
  const real:PropertySearchResult[]=properties.filter(record=>!preferences.listings[record.id]?.hidden).map(record=>({
    id:record.id,source:'real',title:record.title,description:record.description,address:record.address,neighborhood:record.neighborhood,
    price:record.price,currency:record.currency,kind:kinds[record.type],zoneId:linkedToSelectedPlan(record.id) ? base.zone : propertyZoneId(record,zones),
    area:record.area,bedrooms:record.bedrooms,bathrooms:record.bathrooms,features:record.features,operation:record.operation,status:record.status,
    garage:record.features.some(feature=>normalizePropertySearch(feature)==='cochera'),offer:offered('real',record.id),
    image:record.media.find(media=>media.kind==='PHOTO')?.url,
  }));
  const samples:PropertySearchResult[]=examples?zones.flatMap(zone=>{
    const {west,east,south,north}=zone.bounds;
    const area=visiblePresentationArea({id:zone.id,name:zone.label,geometry:{type:'Polygon',coordinates:[[[west,south],[east,south],[east,north],[west,north],[west,south]]]}},examples,preferences);
    return area?.properties.map(property=>({id:property.id,source:'example' as const,title:property.title,price:property.amount??0,currency:property.currency??'USD',kind:property.kind,zoneId:zone.id,
      area:property.tour.area,bedrooms:property.tour.bedrooms,bathrooms:property.tour.bathrooms,features:property.tour.features??[],
      garage:property.garage??null,offer:offered('example',property.id),image:property.tour.interiorPoster,neighborhood:zone.label}))??[];
  }):[];
  const query=normalizePropertySearch(filters.query??'').split(/\s+/).filter(Boolean);
  const features=normalizePropertySearch(filters.features??'').split(',').map(value=>value.trim()).filter(Boolean);
  const within=(value:number,min?:string,max?:string)=>(!min?.trim()||value>=Number(min))&&(!max?.trim()||value<=Number(max));
  return [...real,...samples].filter(item=>{
    if(!matchesPresentationFilters({zoneId:item.zoneId??'',amount:item.price,currency:item.currency,kind:item.kind??'',bedrooms:item.bedrooms,garage:item.garage},base))return false;
    if(base.currency&&base.currency!==item.currency)return false;
    if(filters.operation&&item.operation!==filters.operation)return false;
    if(filters.status&&item.status!==filters.status)return false;
    if(!within(item.area,filters.minArea,filters.maxArea)||!(preferences.filters.bedrooms ? within(item.bedrooms,filters.minBedrooms,filters.maxBedrooms) : true))return false;
    if(filters.bathrooms?.trim()&&item.bathrooms<Number(filters.bathrooms))return false;
    if(filters.offersOnly==='yes'&&!item.offer)return false;
    const haystack=normalizePropertySearch([item.title,item.description,item.address,item.neighborhood,item.kind,...item.features].filter(Boolean).join(' '));
    return query.every(term=>haystack.includes(term))&&features.every(term=>item.features.some(feature=>normalizePropertySearch(feature).includes(term)));
  });
}
