'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './presentation-video.module.css';

export function PresentationVideo({ src, title, continueLabel, onContinue, onBack, integrated = false, maxSeconds, autoStart = false, onStarted }: {
  src: string; title: string; continueLabel: string; onContinue: () => void; onBack?: () => void;
  integrated?: boolean; maxSeconds?: number; autoStart?: boolean; onStarted?: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
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
    if (integrated && window.matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
    return () => { active.current = false; element?.close(); if (origin?.isConnected) origin.focus(); };
  }, []);
  useEffect(() => {
    if (!autoStart && !integrated) return;
    const element = video.current;
    let disposed = false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element?.pause();
      finish();
      return;
    }
    if (element) {
      element.muted = true;
      element.playsInline = true;
      const reject = () => { if (!disposed && active.current && latestAttempt.current === attempt) setError(true); };
      try { Promise.resolve(element.play()).catch(reject); } catch { reject(); }
    }
    return () => { disposed = true; element?.pause(); };
  }, [src, attempt, autoStart, integrated]);
  function finish() {
    if (!active.current || completed.current || latestAttempt.current !== attempt) return;
    completed.current = true;
    onContinue();
  }
  return <dialog ref={dialog} className={`${styles.gate} ${integrated ? styles.integrated : ''}`} aria-label={title}
    onCancel={event => { event.preventDefault(); if (onBack) onBack(); else finish(); }}>
    <video ref={video} key={`${src}-${attempt}`} className={styles.video} src={src} controls={!integrated && !autoStart} muted playsInline autoPlay={!reducedMotion}
      onTimeUpdate={event => { if (integrated && maxSeconds && event.currentTarget.currentTime >= maxSeconds) { event.currentTarget.pause(); finish(); } }}
      onPlaying={()=>{if(active.current&&latestAttempt.current===attempt)onStarted?.();}}
      onEnded={finish} onError={() => { if (active.current && latestAttempt.current === attempt) setError(true); }} />
    <div className={styles.shade} />
    <header className={styles.header}>{!integrated && <span>PRESENTACIÓN INTERACTIVA</span>}<h1>{title}</h1>{!integrated && <p>Video de muestra. Se puede reemplazar o desactivar desde Personalización.</p>}</header>
    {error && <div className={styles.error} role="alert"><h2>No se pudo reproducir el video.</h2><p>Puedes continuar sin él o volver a intentarlo.</p><button onClick={() => { setError(false); setAttempt(attempt + 1); }}>Reintentar video</button></div>}
    <footer className={styles.actions}>{onBack && <button onClick={onBack}>Volver al mapa</button>}<button onClick={finish}>{continueLabel}</button></footer>
    {!integrated && <p className={styles.caption}>Material ilustrativo: las imágenes no representan un vuelo continuo ni propiedades reales de Río Cuarto.</p>}
  </dialog>;
}
