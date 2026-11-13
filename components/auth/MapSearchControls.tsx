'use client';
import type {ReactNode} from 'react';
import styles from './map-search-controls.module.css';
export function MapSearchControls({children}:{children:ReactNode}) {
  return <details className={styles.dock} aria-label="Filtros del mapa"><summary>Filtros</summary><div className={styles.body}>{children}</div></details>;
}
