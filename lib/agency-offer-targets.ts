import type { AgencyPropertyRecord } from './properties/agency-property-service';
import type { PresentationSettings } from './agency-presentation.ts';
import { defaultExplorerSettings, presentationZones } from './presentation-explorer.ts';
import { visiblePresentationArea } from './presentation-listings.ts';
import { zonesForConfig, type DemoConfig } from './property-tour-config.ts';
import type { OfferTarget } from './property-offers.ts';
export function agencyOfferTargets(records: AgencyPropertyRecord[], settings: PresentationSettings, config?: DemoConfig): OfferTarget[] {
  const preferences=settings.explorer??defaultExplorerSettings;
  const real:OfferTarget[]=records.filter(record=>!preferences.listings[record.id]?.hidden).map(record=>({id:record.id,source:'real',title:record.title,price:record.price,currency:record.currency}));
  const examples:OfferTarget[]=config?presentationZones(preferences,zonesForConfig(config)).flatMap(zone=>{
    const {west,east,south,north}=zone.bounds;
    const area=visiblePresentationArea({id:zone.id,name:zone.label,geometry:{type:'Polygon',coordinates:[[[west,south],[east,south],[east,north],[west,north],[west,south]]]}},config,preferences);
    return area?.properties.map(property=>({id:property.id,source:'example' as const,kind:property.kind,title:property.title,price:property.amount??0,currency:property.currency??'USD',zoneId:zone.id}))??[];
  }):[];
  return [...real,...examples];
}
