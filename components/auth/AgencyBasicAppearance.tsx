'use client';

import { useState, type FormEvent } from 'react';
import type { PresentationSettings } from '@/lib/agency-presentation';
import { defaultExplorerSettings, effectivePropertyKindColors } from '@/lib/presentation-explorer';
import { PanelColorPicker } from './PanelColorPicker';
import { previewPanelBrandColor } from './PanelBrandTheme';
import styles from './agency-basic-appearance.module.css';

export function AgencyBasicAppearance({ agencySlug, brandPrimaryColor, initialSettings, onSaveBrand, onSaveAppearance }: {
  agencySlug: string;
  brandPrimaryColor: string | null;
  initialSettings: PresentationSettings;
  onSaveBrand: (form: FormData) => Promise<{ color: string | null; error: string | null }>;
  onSaveAppearance: (value: unknown) => Promise<{ settings: PresentationSettings | null; error: string | null }>;
}) {
  const initial = initialSettings.explorer ?? defaultExplorerSettings;
  const [brand, setBrand] = useState(brandPrimaryColor ?? '');
  const [popupColor, setPopupColor] = useState(initial.popupColor);
  const [popupTextColor, setPopupTextColor] = useState(initial.popupTextColor);
  const [kindColors, setKindColors] = useState(Object.fromEntries(['Casa', 'Departamento', 'Dúplex', 'PH', 'Lote', 'Local', 'Otro'].map(kind => [kind, effectivePropertyKindColors(initial.kindColors)[kind]])));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function saveBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const form = new FormData(); form.set('brandPrimaryColor', brand);
      const result = await onSaveBrand(form);
      setMessage(result.error ?? 'Color de la inmobiliaria guardado.');
    } catch { setMessage('No se pudo guardar el color de la inmobiliaria.'); }
    finally { setBusy(false); }
  }
  async function saveAppearance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const result = await onSaveAppearance({ popupColor, popupTextColor, kindColors });
      setMessage(result.error ?? (result.settings ? 'Colores del mapa guardados.' : 'No se pudieron guardar los colores.'));
    } catch { setMessage('No se pudieron guardar los colores del mapa.'); }
    finally { setBusy(false); }
  }
  return <section className={styles.panels}>
    <form className={styles.card} onSubmit={saveBrand}>
      <h2>Color de la inmobiliaria</h2>
      <p>La vista previa del panel es inmediata. Guarde para conservar el color.</p>
      <PanelColorPicker label="Color principal" value={brand} allowDefault disabled={busy} onChange={value => { setBrand(value); previewPanelBrandColor(agencySlug, value); }} />
      <button disabled={busy} type="submit">Guardar color principal</button>
    </form>
    <form className={styles.card} onSubmit={saveAppearance}>
      <h2>Colores del mapa</h2>
      <p>Personalice las fichas y los tipos de propiedad sin modificar el catálogo ni la configuración avanzada.</p>
      <PanelColorPicker label="Fondo de las fichas" value={popupColor} disabled={busy} onChange={setPopupColor} />
      <PanelColorPicker label="Texto de las fichas" value={popupTextColor} disabled={busy} onChange={setPopupTextColor} />
      {Object.entries(kindColors).map(([kind, color]) => <PanelColorPicker key={kind} label={`Color de ${kind}`} value={color} disabled={busy} onChange={value => setKindColors({ ...kindColors, [kind]: value })} />)}
      <button disabled={busy} type="submit">Guardar colores del mapa</button>
    </form>
    {message && <p role="status">{message}</p>}
  </section>;
}
