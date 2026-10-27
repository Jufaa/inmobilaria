'use client';

import { useActionState } from 'react';
import {
  updateInquiryStatusAction,
  type InquiryStatusActionState,
} from '@/app/inmobiliaria/[agencyId]/panel/consultas/actions';
import type { InquiryStatusValue } from '@/lib/properties/public-inquiry-service';
import styles from './inquiry-manager.module.css';

type InquiryRecord = {
  id: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  message: string;
  status: InquiryStatusValue;
  createdAt: string;
  property: { id: string; title: string; status: string };
  ownerAgency: { id: string; name: string };
  presentingAgency: { id: string; name: string };
};

const statuses: [InquiryStatusValue, string][] = [
  ['NEW', 'Nueva'],
  ['CONTACTED', 'Contactada'],
  ['QUALIFIED', 'En seguimiento'],
  ['CLOSED', 'Cerrada'],
];

function InquiryStatusForm({ agencySlug, inquiry }: { agencySlug: string; inquiry: InquiryRecord }) {
  const action = updateInquiryStatusAction.bind(null, agencySlug);
  const [state, formAction, pending] = useActionState(action, {} satisfies InquiryStatusActionState);
  return (
    <form className={styles.statusForm} action={formAction}>
      <input type="hidden" name="inquiryId" value={inquiry.id} />
      <label>
        Seguimiento
        <select name="status" defaultValue={inquiry.status}>
          {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Actualizar'}</button>
      {state.error && <p className={styles.error} role="alert">{state.error}</p>}
      {state.success && <p className={styles.success} role="status">{state.success}</p>}
    </form>
  );
}

export function InquiryManager({ agencySlug, inquiries }: { agencySlug: string; inquiries: InquiryRecord[] }) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Seguimiento comercial</p>
          <h1>Consultas</h1>
          <p>Consultas recibidas por propiedades de esta inmobiliaria, con titularidad y presentación registradas.</p>
        </div>
        <span className={styles.count}>{inquiries.length}{inquiries.length === 200 ? '+' : ''}</span>
      </header>
      <p className={styles.privacyNote}>Los datos de contacto solo son visibles para integrantes autorizados de esta inmobiliaria.</p>
      {inquiries.length === 0 ? (
        <section className={styles.empty}>
          <h2>Todavía no hay consultas</h2>
          <p>Cuando alguien consulte por una propiedad publicada, aparecerá acá.</p>
        </section>
      ) : (
        <section className={styles.list} aria-label="Consultas recibidas">
          {inquiries.map((inquiry) => (
            <article className={styles.card} key={inquiry.id}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.eyebrow}>{new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(inquiry.createdAt))}</p>
                  <h2>{inquiry.contactName}</h2>
                  <a href={`mailto:${inquiry.contactEmail}`}>{inquiry.contactEmail}</a>
                  {inquiry.contactPhone && <a href={`tel:${inquiry.contactPhone}`}>{inquiry.contactPhone}</a>}
                </div>
                <span className={styles.status}>{statuses.find(([value]) => value === inquiry.status)?.[1]}</span>
              </div>
              <p className={styles.property}>Por <strong>{inquiry.property.title}</strong></p>
              <p className={styles.attribution}>Titular: {inquiry.ownerAgency.name} · Presentó: {inquiry.presentingAgency.name}</p>
              <p className={styles.message}>{inquiry.message}</p>
              <InquiryStatusForm key={`${inquiry.id}-${inquiry.status}`} agencySlug={agencySlug} inquiry={inquiry} />
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
