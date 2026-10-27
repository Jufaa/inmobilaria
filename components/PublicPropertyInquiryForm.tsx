'use client';

import { useActionState } from 'react';
import {
  submitPropertyInquiryAction,
  type InquiryActionState,
} from '@/app/explorar-propiedades/[propertyId]/actions';
import styles from './public-property-detail.module.css';

const initialState: InquiryActionState = {};

export function PublicPropertyInquiryForm({ propertyId, presentingAgencySlug }: { propertyId: string; presentingAgencySlug: string | null }) {
  const action = submitPropertyInquiryAction.bind(null, propertyId, presentingAgencySlug);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.form}>
      <h2>Consultá por esta propiedad</h2>
      <label>Nombre<input name="contactName" required minLength={2} maxLength={100} autoComplete="name" /></label>
      <label>Email<input name="contactEmail" type="email" required maxLength={254} autoComplete="email" /></label>
      <label>Teléfono <span>(opcional)</span><input name="contactPhone" type="tel" maxLength={40} autoComplete="tel" /></label>
      <label>Mensaje<textarea name="message" required minLength={10} maxLength={2000} rows={5} defaultValue="Hola, quisiera recibir más información sobre esta propiedad." /></label>
      <label className={styles.honeypot} aria-hidden="true">
        Sitio web<input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <p className={styles.privacyNotice}>
        Usaremos estos datos para responder esta consulta y compartirla con la inmobiliaria responsable de la propiedad.
      </p>
      {state.error && <p className={styles.error} role="alert">{state.error}</p>}
      {state.success && <p className={styles.success} role="status">{state.success}</p>}
      <button type="submit" disabled={pending || !!state.success}>
        {pending ? 'Enviando…' : 'Enviar consulta'}
      </button>
    </form>
  );
}
