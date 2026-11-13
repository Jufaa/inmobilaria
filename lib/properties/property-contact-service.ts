import 'server-only';
import {prisma} from '@/lib/prisma';
import {defaultPresentationSettings,parsePresentationSettings,type PresentationSettings} from '@/lib/agency-presentation';
import {parsePropertyContacts,type PropertyWhatsApp} from './property-whatsapp';

function retryable(error:unknown) {
  return !!error&&typeof error==='object'&&'code' in error&&['P2034','P2002'].includes(String(error.code));
}
export async function updateAgencyPresentationSettings(agencyId:string,transform:(current:unknown)=>PresentationSettings,propertyId?:string) {
  for(let attempt=0;attempt<3;attempt++){
    try{
      return await prisma.$transaction(async tx=>{
        if(propertyId&&!await tx.property.findFirst({where:{id:propertyId,agencyId},select:{id:true}}))throw Error('Property does not belong to this agency');
        const row=await tx.agencyPresentationConfig.findUnique({where:{agencyId},select:{presentationSettings:true}});
        const next=transform(row?.presentationSettings);
        if(!parsePresentationSettings(next)||JSON.stringify(next).length>3_000_000)throw Error('Invalid presentation settings');
        await tx.agencyPresentationConfig.upsert({where:{agencyId},create:{agencyId,presentationSettings:next},update:{presentationSettings:next}});
        return next;
      },{isolationLevel:'Serializable'});
    }catch(error){if(attempt===2||!retryable(error))throw error;}
  }
  throw Error('Presentation update exhausted');
}
export function savePropertyWhatsAppContact(agencyId:string,propertyId:string,contact:PropertyWhatsApp|null) {
  return updateAgencyPresentationSettings(agencyId,current=>{
    const settings=current==null?structuredClone(defaultPresentationSettings):parsePresentationSettings(current);
    if(!settings)throw Error('Existing presentation settings are invalid');
    const propertyContacts={...settings.propertyContacts};
    if(contact)propertyContacts[propertyId]=contact;else delete propertyContacts[propertyId];
    return {...settings,propertyContacts};
  },propertyId);
}
// General appearance saves must not replace newer independently edited property contacts.
export function savePresentationPreservingContacts(agencyId:string,settings:PresentationSettings) {
  return updateAgencyPresentationSettings(agencyId,current=>{
    const raw=current&&typeof current==='object'&&!Array.isArray(current)?current as Record<string,unknown>:{};
    const contacts=raw.propertyContacts===undefined?undefined:parsePropertyContacts(raw.propertyContacts);
    if(contacts===null)throw Error('Existing property contacts are invalid');
    const {propertyContacts:_submittedContacts,...presentation}=settings;
    return {...presentation,...(contacts?{propertyContacts:contacts}:{})};
  });
}
