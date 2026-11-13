'use server';
import {revalidatePath} from 'next/cache';
import {requireAgencyPropertyContactAccess} from '@/lib/agency-access';
import {parsePropertyWhatsApp} from '@/lib/properties/property-whatsapp';
import {savePropertyWhatsAppContact} from '@/lib/properties/property-contact-service';
export type PropertyContactState={error?:string;success?:string};
export async function savePropertyContactAction(slug:string,data:FormData):Promise<PropertyContactState>{
  const {membership}=await requireAgencyPropertyContactAccess(slug);
  const id=String(data.get('propertyId')??'');
  if(!/^[a-z0-9_-]{1,80}$/i.test(id)||['__proto__','constructor','prototype'].includes(id))return{error:'La propiedad no es válida.'};
  const remove=data.get('intent')==='remove';
  const contact=remove?null:parsePropertyWhatsApp({whatsappNumber:data.get('whatsappNumber'),message:data.get('message')});
  if(!remove&&!contact)return{error:'Ingrese un número internacional válido y un mensaje de hasta 1500 caracteres.'};
  try{
    await savePropertyWhatsAppContact(membership.agency.id,id,contact);
  }catch{return{error:'No se pudo guardar el WhatsApp. No se modificaron los datos anteriores.'};}
  revalidatePath(`/inmobiliaria/${encodeURIComponent(slug)}/panel/propiedades`);
  revalidatePath(`/inmobiliaria/${encodeURIComponent(slug)}/panel`);
  revalidatePath(`/explorar-propiedades/${encodeURIComponent(id)}`);
  return{success:remove?'WhatsApp quitado de la propiedad.':'WhatsApp guardado para esta propiedad.'};
}
