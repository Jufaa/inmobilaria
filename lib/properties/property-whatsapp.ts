export type PropertyWhatsApp = {whatsappNumber:string;message:string};
const propertyId = (value:string) => /^[a-z0-9_-]{1,80}$/i.test(value)&&!['__proto__','constructor','prototype'].includes(value);
export function parsePropertyWhatsApp(value:unknown):PropertyWhatsApp|null {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const contact=value as Record<string,unknown>;
  if(typeof contact.whatsappNumber!=='string'||contact.whatsappNumber.length>40||!/^\+?[\d\s()-]+$/.test(contact.whatsappNumber.trim())||typeof contact.message!=='string')return null;
  const number=contact.whatsappNumber.replace(/[\s()+-]/g,'');
  const message=contact.message.trim();
  return /^[1-9]\d{7,14}$/.test(number)&&message.length>0&&message.length<=1500?{whatsappNumber:number,message}:null;
}
export function parsePropertyContacts(value:unknown):Record<string,PropertyWhatsApp>|null {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>600)return null;
  const contacts:Record<string,PropertyWhatsApp>={};
  for(const [id,raw] of Object.entries(value)){
    const contact=parsePropertyWhatsApp(raw);
    if(!propertyId(id)||!contact)return null;
    contacts[id]=contact;
  }
  return contacts;
}
export function propertyWhatsAppLink(value:unknown,property:{id:string;title:string;origin:string}):string|null {
  const contact=parsePropertyWhatsApp(value);
  if(!contact||!propertyId(property.id))return null;
  try{
    const origin=new URL(property.origin);
    if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)return null;
    const link=new URL(`/explorar-propiedades/${encodeURIComponent(property.id)}`,origin.origin).href;
    let message=contact.message.replaceAll('{propiedad}',property.title).replaceAll('{enlace}',link);
    if(!message.includes(property.title))message+=`\n\nPropiedad: ${property.title}`;
    if(!message.includes(link))message+=`\n${link}`;
    return `https://wa.me/${contact.whatsappNumber}?${new URLSearchParams({text:message})}`;
  }catch{return null;}
}
