'use client';
import {useEffect,useState} from 'react';
import {propertyWhatsAppLink,type PropertyWhatsApp} from '@/lib/properties/property-whatsapp';
import styles from './property-whatsapp-button.module.css';
export function PropertyWhatsAppButton({propertyId,title,contact}:{propertyId:string;title:string;contact?:PropertyWhatsApp}){
  const [origin,setOrigin]=useState('');
  useEffect(()=>{setOrigin(window.location.origin);},[]);
  const href=propertyWhatsAppLink(contact,{id:propertyId,title,origin});
  if(!href)return null;
  return <a className={styles.button} href={href} target="_blank" rel="noopener noreferrer">Consultar o coordinar visita por WhatsApp</a>;
}
