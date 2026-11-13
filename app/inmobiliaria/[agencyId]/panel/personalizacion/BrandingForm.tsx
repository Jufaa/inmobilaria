'use client';

import { EditableForm } from '@/components/auth/WorkspaceEditPermission';

import { useActionState, useEffect, useState } from 'react';
import { PanelColorPicker } from '@/components/auth/PanelColorPicker';
import { previewPanelBrandColor } from '@/components/auth/PanelBrandTheme';
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
  const [primaryColor, setPrimaryColor] = useState(initial.brandPrimaryColor ?? '');
  useEffect(() => { setPrimaryColor(initial.brandPrimaryColor ?? ''); }, [agencySlug, initial.brandPrimaryColor]);
  useEffect(() => () => { previewPanelBrandColor(agencySlug, initial.brandPrimaryColor ?? ''); }, [agencySlug, initial.brandPrimaryColor]);

  function previewColor(value: string) {
    setPrimaryColor(value);
    previewPanelBrandColor(agencySlug, value);
  }

  return (
    <EditableForm action={formAction} className={styles.form}>
      <PanelColorPicker label="Color principal" name="brandPrimaryColor" value={primaryColor} onChange={previewColor} allowDefault disabled={pending} />
      <small>Vista previa del panel. Pulse Guardar identidad para conservar el color.</small>
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
    </EditableForm>
  );
}
