'use client';

import { useState } from 'react';
import type { PropertyOffer, OfferTarget } from '@/lib/property-offers';
import { resolvePropertyOffers } from '@/lib/property-offers';
import styles from './property-offers.module.css';
function offerTextColor(color: string) {
  const channels = [1,3,5].map(start => parseInt(color.slice(start,start+2),16)/255)
    .map(value => value <= .04045 ? value/12.92 : ((value+.055)/1.055)**2.4);
  const luminance=channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
  return luminance>.179?'#000000':'#ffffff';
}
export function PropertyOffersPopup({offers,targets,onSelect}:{offers:PropertyOffer[];targets:OfferTarget[];onSelect:(target:OfferTarget)=>void}) {
  const [closed,setClosed]=useState(false);
  const cards=resolvePropertyOffers(offers,targets);
  if(!cards.length)return null;
  if(closed)return <button className={styles.reopen} type="button" onClick={()=>setClosed(false)}>Ver ofertas</button>;
  return <aside className={styles.popup} aria-label="Ofertas de la inmobiliaria">
    {cards.map(offer=><article key={offer.id} style={{backgroundColor:offer.color??'#eab308',color:offerTextColor(offer.color??'#eab308')}}><button className={styles.close} type="button" aria-label="Cerrar ofertas" onClick={()=>setClosed(true)}>×</button>{offer.source==='example'&&<small>Ejemplo ficticio</small>}<h2>{offer.title}</h2><p>{offer.property.title}</p><strong>{offer.currency} {new Intl.NumberFormat('es-AR').format(offer.price)}</strong>{offer.description&&<p>{offer.description}</p>}<button type="button" onClick={()=>onSelect(offer.property)}>Ver propiedad</button></article>)}
  </aside>;
}
