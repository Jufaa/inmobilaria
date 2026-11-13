'use client';

import { useId } from 'react';
import { formatRgbColor, normalizeHexColor, panelColorPresets } from '@/lib/panel-colors';
import styles from './panel-color-picker.module.css';

export type PanelColorPickerProps = {
  label: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  name?: string;
  allowDefault?: boolean;
  defaultColor?: string;
  disabled?: boolean;
};

export function PanelColorPicker({
  label,
  value,
  onChange,
  name,
  allowDefault = false,
  defaultColor = '#236b58',
  disabled = false,
}: PanelColorPickerProps) {
  const inputId = useId();
  const selected = normalizeHexColor(value);
  const preview = selected ?? normalizeHexColor(defaultColor) ?? '#236b58';
  const isDefault = value == null || value === '';
  const submitted = selected ?? (isDefault ? '' : value);

  function choose(next: string) {
    const normalized = normalizeHexColor(next);
    if (!disabled && normalized) onChange(normalized);
  }

  return <fieldset className={styles.picker} disabled={disabled}>
    <legend className={styles.legend}>{label}</legend>
    {name && <input type="hidden" name={name} value={submitted ?? ''} />}
    <div className={styles.swatches} role="group" aria-label={`Paleta de ${label.toLowerCase()}`}>
      {panelColorPresets.map(color => <button
        key={color.value}
        type="button"
        className={styles.swatch}
        data-color={color.value}
        disabled={disabled}
        aria-label={`${color.name}: ${formatRgbColor(color.value)}`}
        aria-pressed={selected === color.value}
        title={`${color.name} · ${formatRgbColor(color.value)}`}
        style={{ backgroundColor: color.value }}
        onClick={() => choose(color.value)}
      >{selected === color.value && <span className={styles.check} aria-hidden="true">✓</span>}</button>)}
    </div>
    <div className={styles.custom}>
      <label className={styles.customLabel} htmlFor={inputId}>Más colores</label>
      <input
        id={inputId}
        className={styles.native}
        type="color"
        aria-label={`${label}: más colores`}
        value={preview}
        disabled={disabled}
        onChange={event => choose(event.target.value)}
      />
      <output className={styles.readout} aria-live="polite" aria-atomic="true">
        {isDefault ? 'Predeterminado' : selected ? `${formatRgbColor(selected)} · ${selected.toUpperCase()}` : 'Color no válido'}
      </output>
    </div>
    {allowDefault && <button className={styles.reset} type="button" disabled={disabled} onClick={() => { if (!disabled) onChange(''); }}>Usar predeterminado</button>}
  </fieldset>;
}
