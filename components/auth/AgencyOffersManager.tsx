'use client';

import { useState, type FormEvent } from 'react';
import type { PresentationSettings } from '@/lib/agency-presentation';
import type { PropertyOffer, OfferTarget } from '@/lib/property-offers';
import styles from './property-offers.module.css';
import { PanelColorPicker } from './PanelColorPicker';
export function AgencyOffersManager({initialSettings,targets,onPersist}:{initialSettings:PresentationSettings;targets:OfferTarget[];onPersist:(value:PropertyOffer[])=>Promise<{settings:PresentationSettings|null;error:string|null}>}) {
  const [settings,setSettings]=useState(initialSettings),[editing,setEditing]=useState<PropertyOffer|null>(null),[target,setTarget]=useState(''),[price,setPrice]=useState(''),[currency,setCurrency]=useState<'ARS'|'USD'>('USD'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[color,setColor]=useState('#eab308');
  const offers=settings.explorer?.offers??[];
  async function persist(next:PropertyOffer[]) {
    setBusy(true);setMessage('');
    try {const result=await onPersist(next);if(!result.settings||result.error){setMessage(result.error??'No se pudieron guardar las ofertas.');return false;}setSettings(result.settings);setMessage('Ofertas guardadas. El mapa mostrará las ofertas activas.');return true;}
    catch {setMessage('No se pudieron guardar las ofertas.');return false;}
    finally {setBusy(false);}
  }
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(busy)return;const form=event.currentTarget,data=new FormData(form);
    const property=targets.find(item=>`${item.source}|${item.id}`===target);
    if(!property){setMessage('Seleccione una propiedad.');return;}
    const offer:PropertyOffer={id:editing?.id??`offer-${crypto.randomUUID()}`,source:property.source,propertyId:property.id,title:String(data.get('title')??'').trim(),description:String(data.get('description')??'').trim(),price:Number(price),currency,enabled:data.get('enabled')==='on',color};
    if(await persist([...offers.filter(item=>item.id!==offer.id),offer])){setEditing(null);setTarget('');setPrice('');setColor('#eab308');form.reset();}
  }
  return <main className={styles.page}><header><h1>Ofertas</h1><p>Las ofertas activas aparecen en una ventana abajo a la derecha del mapa. No cambian el precio original del catálogo.</p></header>
    <form className={styles.form} key={editing?.id??'new'} onSubmit={save}><fieldset disabled={busy} style={{display:'contents',border:0,padding:0}}>
      <h2>{editing?'Editar oferta':'Crear oferta'}</h2>
      <label>Propiedad<select required value={target} onChange={event=>{setTarget(event.target.value);const item=targets.find(item=>`${item.source}|${item.id}`===event.target.value);setPrice(item?String(item.price):'');setCurrency(item?.currency??'USD');}}><option value="">Seleccione una propiedad</option>{targets.map(item=><option key={`${item.source}|${item.id}`} value={`${item.source}|${item.id}`}>{item.title}{item.source==='example'?' · Ejemplo ficticio':''}</option>)}</select></label>
      <label>Título de la oferta<input required name="title" maxLength={100} defaultValue={editing?.title??''}/></label><label>Descripción breve<textarea name="description" maxLength={500} defaultValue={editing?.description??''}/></label>
      <label>Precio de la oferta<input required type="number" min={0} max={1e12} step="any" value={price} onChange={event=>setPrice(event.target.value)}/></label><label>Moneda<select name="currency" value={currency} onChange={event=>setCurrency(event.target.value as 'ARS'|'USD')}><option>USD</option><option>ARS</option></select></label>
      <PanelColorPicker label="Color de la oferta" value={color} onChange={setColor}/>
      <label className={styles.checkboxRow}><input type="checkbox" name="enabled" defaultChecked={editing?.enabled??true}/> Mostrar oferta</label>
      <div className={styles.actions}><button disabled={busy||(!editing&&offers.length>=20)} type="submit">{busy?'Guardando…':'Guardar oferta'}</button>{editing&&<button type="button" onClick={()=>{setEditing(null);setTarget('');setPrice('');setColor('#eab308');}}>Cancelar edición</button>}</div>
    </fieldset></form>
    {message&&<p role="status">{message}</p>}
    {offers.map(offer=><article className={styles.form} key={offer.id}><h2>{offer.title}</h2><p>{offer.source==='example'?'Ejemplo ficticio · ':''}{offer.enabled?'Activa':'Oculta'} · {offer.currency} {new Intl.NumberFormat('es-AR').format(offer.price)}</p><div className={styles.actions}><button type="button" disabled={busy} onClick={()=>{setEditing(offer);setTarget(`${offer.source}|${offer.propertyId}`);setPrice(String(offer.price));setCurrency(offer.currency);setColor(offer.color??'#eab308');}}>Editar</button><button type="button" disabled={busy} onClick={()=>void persist(offers.filter(item=>item.id!==offer.id))}>Quitar oferta</button></div></article>)}
  </main>;
}
