'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './presentation-video.module.css';

export function PresentationVideo({ src, title, continueLabel, onContinue, onBack }: {
  src: string; title: string; continueLabel: string; onContinue: () => void; onBack?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const completed = useRef(false);
  const active = useRef(true);
  const latestAttempt = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  latestAttempt.current = attempt;
  useEffect(() => {
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    active.current = true;
    element?.showModal();
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    return () => { active.current = false; element?.close(); if (origin?.isConnected) origin.focus(); };
  }, []);
  function finish() {
    if (!active.current || completed.current || latestAttempt.current !== attempt) return;
    completed.current = true;
    onContinue();
  }
  return <dialog ref={dialog} className={styles.gate} aria-label={title}
    onCancel={event => { event.preventDefault(); if (onBack) onBack(); else finish(); }}>
    <video key={`${src}-${attempt}`} className={styles.video} src={src} controls muted playsInline autoPlay={!reducedMotion}
      onEnded={finish} onError={() => { if (active.current && latestAttempt.current === attempt) setError(true); }} />
    <div className={styles.shade} />
    <header className={styles.header}><span>PRESENTACIÓN INTERACTIVA</span><h1>{title}</h1><p>Video de muestra. Se puede reemplazar o desactivar desde Personalización.</p></header>
    {error && <div className={styles.error} role="alert"><h2>No se pudo reproducir el video.</h2><p>Puedes continuar sin él o volver a intentarlo.</p><button onClick={() => { setError(false); setAttempt(attempt + 1); }}>Reintentar video</button></div>}
    <footer className={styles.actions}>{onBack && <button onClick={onBack}>Volver al mapa</button>}<button onClick={finish}>{continueLabel}</button></footer>
    <p className={styles.caption}>Material ilustrativo: las imágenes no representan un vuelo continuo ni propiedades reales de Río Cuarto.</p>
  </dialog>;
}
