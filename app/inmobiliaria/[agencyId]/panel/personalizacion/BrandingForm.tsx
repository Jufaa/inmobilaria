'use client';

import { useActionState } from 'react';
import { updateAgencyBranding, type BrandingActionState } from './actions';
import styles from './branding.module.css';

const initialState: BrandingActionState = { status: 'idle', message: '' };

export function BrandingForm({
  agencySlug,
  initial,
}: {
  agencySlug: string;
  initial: {
    brandPrimaryColor: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
    welcomeVideoUrl: string | null;
    welcomeVideoDescription: string | null;
  };
}) {
  const action = updateAgencyBranding.bind(null, agencySlug);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.form}>
      <label>
        Color principal
        <input name="brandPrimaryColor" type="text" inputMode="text" placeholder="#236B58" defaultValue={initial.brandPrimaryColor ?? ''} maxLength={7} />
        <small>Usá un código hexadecimal de seis dígitos. Vacío aplica el color predeterminado.</small>
      </label>
      <label>
        URL del logo
        <input name="logoUrl" type="url" placeholder="https://…" defaultValue={initial.logoUrl ?? ''} maxLength={2048} />
      </label>
      <label>
        URL de portada
        <input name="coverUrl" type="url" placeholder="https://…" defaultValue={initial.coverUrl ?? ''} maxLength={2048} />
      </label>
      <label>
        Presentación en video (opcional)
        <input name="welcomeVideoUrl" type="url" placeholder="https://…" defaultValue={initial.welcomeVideoUrl ?? ''} maxLength={2048} />
        <small>Se muestra como enlace externo. No se reproduce automáticamente ni acepta iframes arbitrarios.</small>
      </label>
      <label>
        Descripción de la presentación
        <textarea name="welcomeVideoDescription" defaultValue={initial.welcomeVideoDescription ?? ''} maxLength={500} rows={3} />
      </label>
      {state.message && <p className={state.status === 'error' ? styles.error : styles.success} role="status">{state.message}</p>}
      <button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar identidad'}</button>
    </form>
  );
}
