'use client';
import { useState } from 'react';
import type { PropertySearchResult } from '@/lib/property-search';
import styles from './property-search-results.module.css';

export function PropertySearchResults({items,onSelect,onClear}:{items:PropertySearchResult[];onSelect:(item:PropertySearchResult)=>void;onClear:()=>void}) {
  const [limit,setLimit]=useState(12);
  const [collapsed,setCollapsed]=useState(false);
  if(collapsed)return <button className={styles.reopen} type="button" onClick={()=>setCollapsed(false)}>Ver resultados ({items.length})</button>;
  return <section className={styles.results} aria-label="Propiedades encontradas">
    <header><strong aria-live="polite">{items.length} {items.length===1?'propiedad':'propiedades'}</strong><button type="button" aria-label="Ocultar resultados" onClick={()=>setCollapsed(true)}>×</button></header>
    {!items.length&&<p>No hay propiedades con estos filtros. Puede quitar alguno o dejarlos en blanco.</p>}
    <div className={styles.cards}>{items.slice(0,limit).map(item=><button className={styles.card} type="button" key={`${item.source}-${item.id}`} onClick={()=>onSelect(item)}>
      {item.image?<img src={item.image} alt="" loading="lazy"/>:<span className={styles.noPhoto}>Sin foto</span>}
      <span className={styles.description}><strong>{item.title}</strong><b>{item.currency} {new Intl.NumberFormat('es-AR').format(item.price)}</b><span>{item.area} m² · {item.bedrooms} dorm. · {item.bathrooms} baños</span>{item.neighborhood&&<span>{item.neighborhood}</span>}<small>{item.source==='example'?'Ejemplo ficticio':item.operation==='RENT'?'Alquiler':'Venta'}{item.offer?' · Oferta':''}</small></span>
    </button>)}</div>
    {items.length>limit&&<button type="button" onClick={()=>setLimit(value=>value+12)}>Ver más propiedades</button>}
    <button type="button" onClick={onClear}>Limpiar búsqueda y filtros</button>
  </section>;
}
