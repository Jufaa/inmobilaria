'use client';

import { useTheme, type ThemeMode } from './ThemeProvider';
import styles from './theme-toggle.module.css';

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  return (
    <label className={styles.control}>
      <span>Apariencia</span>
      <select aria-label="Apariencia" value={mode} onChange={(event) => setMode(event.target.value as ThemeMode)}>
        <option value="system">Sistema</option>
        <option value="light">Claro</option>
        <option value="dark">Oscuro</option>
      </select>
    </label>
  );
}
