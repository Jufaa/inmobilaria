'use client';
import {useRef,useState,type FormEvent} from 'react';
import {savePropertyContactAction} from '@/app/inmobiliaria/[agencyId]/panel/propiedades/contact-actions';
import type {PropertyWhatsApp} from '@/lib/properties/property-whatsapp';
import {PropertyWhatsAppButton} from '../PropertyWhatsAppButton';
import styles from './property-manager.module.css';
const defaultMessage='Hola, quisiera coordinar una visita a {propiedad}. {enlace}';
export function PropertyContactForm({agencySlug,propertyId,title,initial,isPublished=false}:{agencySlug:string;propertyId:string;title:string;initial?:PropertyWhatsApp;isPublished?:boolean}){
  const [number,setNumber]=useState(initial?.whatsappNumber??'');
  const [message,setMessage]=useState(initial?.message??defaultMessage);
  const [busy,setBusy]=useState(false),[feedback,setFeedback]=useState<{error?:string;success?:string}>({});
  const pending=useRef(false);
  async function save(intent:'save'|'remove'){
    if(pending.current)return;
    pending.current=true;setBusy(true);setFeedback({});
    const data=new FormData();data.set('propertyId',propertyId);data.set('whatsappNumber',number);data.set('message',message);data.set('intent',intent);
    try{
      const result=await savePropertyContactAction(agencySlug,data);setFeedback(result);
      if(result.success&&intent==='remove'){setNumber('');setMessage(defaultMessage);}
    }catch{setFeedback({error:'No se pudo guardar el WhatsApp. Intente nuevamente.'});}
    finally{pending.current=false;setBusy(false);}
  }
  function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();void save('save');}
  return <details className={styles.contactEditor}><summary>WhatsApp de esta propiedad</summary>
    <form onSubmit={submit} aria-label={`Configurar WhatsApp de ${title}`}>
      <fieldset disabled={busy}>
        <label>Número de WhatsApp<input type="tel" autoComplete="tel" required maxLength={40} value={number} onChange={event=>setNumber(event.target.value)} placeholder="+54 9 358 1234567"/></label>
        <small>Incluya el código de país. Este será el número de contacto visible para los visitantes.</small>
        <label>Mensaje para el visitante<textarea required maxLength={1500} rows={4} value={message} onChange={event=>setMessage(event.target.value)}/></label>
        <small>Puede usar {'{propiedad}'} y {'{enlace}'}. El título y el enlace se incluyen automáticamente.</small>
        {isPublished?<PropertyWhatsAppButton propertyId={propertyId} title={title} contact={{whatsappNumber:number,message}}/>:<small>El enlace público estará disponible cuando la propiedad esté publicada.</small>}
        <div className={styles.cardActions}><button type="submit" className={styles.primaryButton}>{busy?'Guardando…':'Guardar WhatsApp'}</button><button type="button" className={styles.secondaryButton} onClick={()=>void save('remove')}>Quitar WhatsApp</button></div>
      </fieldset>
      {feedback.error&&<p className={styles.error} role="alert">{feedback.error}</p>}{feedback.success&&<p className={styles.success} role="status">{feedback.success}</p>}
    </form>
    <small>El botón abre WhatsApp con el mensaje preparado. No envía mensajes automáticamente ni crea una reserva interna.</small>
  </details>;
}
