'use client';

import {PropertyWhatsAppButton} from '../PropertyWhatsAppButton';
import type {PropertyWhatsApp} from '@/lib/properties/property-whatsapp';
import type { AgencyPropertyRecord } from '@/lib/properties/agency-property-service';
import styles from './real-agency-map.module.css';

export function RealPropertyDetail({ property, onBack, onEdit, whatsappContact }: { whatsappContact?: PropertyWhatsApp; onEdit?: () => void; property: AgencyPropertyRecord; onBack: () => void }) {
  const photos = property.media.filter(item => item.kind === 'PHOTO');
  return <article className={styles.detail}>
    <button type="button" onClick={onBack}>← Volver al mapa</button>
    {onEdit && <button type="button" onClick={onEdit}>Editar propiedad</button>}
    <header><h1>{property.title}</h1><p>{property.address} · {property.neighborhood}</p>
      <strong>{property.currency} {new Intl.NumberFormat('es-AR').format(property.price)}</strong>
      {property.status === 'DRAFT' && <span className={styles.badge}>Borrador · no publicado</span>}
    </header>
    {property.status==='PUBLISHED'&&<PropertyWhatsAppButton propertyId={property.id} title={property.title} contact={whatsappContact}/>}
    {photos.length ? <div className={styles.gallery}>{photos.map(photo => <img key={photo.id} src={photo.url} alt={photo.caption || property.title} loading="lazy" />)}</div> : <p className={styles.notice}>Esta propiedad todavía no tiene fotos.</p>}
    <p>{property.area} m² · {property.bedrooms} dormitorios · {property.bathrooms} baños</p>
    {(property.description || property.features.length > 0) && <details><summary>Más información</summary><p>{property.description}</p><ul>{property.features.map(feature => <li key={feature}>{feature}</li>)}</ul></details>}
  </article>;
}
