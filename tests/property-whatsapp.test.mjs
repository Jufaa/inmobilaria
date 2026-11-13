import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePropertyWhatsApp,parsePropertyContacts,propertyWhatsAppLink} from '../lib/properties/property-whatsapp.ts';
import {defaultPresentationSettings,parsePresentationSettings} from '../lib/agency-presentation.ts';
const contact={whatsappNumber:'+54 9 (358) 123-4567',message:'Hola, quiero visitar {propiedad}. {enlace}'};
test('contact numbers/messages validate, normalize and preserve legacy presentation configs',()=>{
 assert.deepEqual(parsePresentationSettings(defaultPresentationSettings),defaultPresentationSettings);
 const normalized=parsePropertyWhatsApp(contact);assert.equal(normalized.whatsappNumber,'5493581234567');
 assert.equal(parsePresentationSettings({...defaultPresentationSettings,propertyContacts:{'real-1':normalized}}).propertyContacts['real-1'].message,contact.message);
 for(const change of [{whatsappNumber:'https://evil.test'},{whatsappNumber:'0358'},{whatsappNumber:'1234567890123456'},{message:''},{message:'x'.repeat(1501)}])assert.equal(parsePropertyWhatsApp({...contact,...change}),null);
 assert.equal(parsePropertyContacts({'__proto__':contact,'bad/id':contact}),null);
});
test('WhatsApp link fixes the destination and includes the message, title and canonical selected-property URL exactly once',()=>{
 const href=propertyWhatsAppLink(contact,{id:'real-1',title:'Casa & patio',origin:'https://example.test'});const url=new URL(href);
 assert.equal(url.origin,'https://wa.me');assert.equal(url.pathname,'/5493581234567');
 const message=url.searchParams.get('text');assert.ok(message.includes('Casa & patio'));assert.ok(message.includes('https://example.test/explorar-propiedades/real-1'));assert.equal(message.split('https://example.test/explorar-propiedades/real-1').length,2);
 assert.equal(propertyWhatsAppLink(contact,{id:'../wrong',title:'Casa',origin:'https://example.test'}),null);
 assert.equal(propertyWhatsAppLink(contact,{id:'real-1',title:'Casa',origin:'javascript:alert(1)'}),null);
 assert.equal(propertyWhatsAppLink(undefined,{id:'real-1',title:'Casa',origin:'https://example.test'}),null);
});
