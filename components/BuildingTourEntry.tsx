'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Compass, Play, RotateCcw } from 'lucide-react';
import { tourProperties, type TourProperty } from '@/lib/property-tour-demo';
import styles from './property-tour-demo.module.css';

export function BuildingTourEntry({ property, properties = tourProperties, entering, reducedMotion, onSelect, onEntered, onReturn, returnLabel = 'Volver al edificio' }: {
  property: TourProperty;
  properties?: TourProperty[];
  entering: boolean;
  reducedMotion: boolean;
  onSelect: (id: string) => void;
  onEntered: (id: string) => void;
  onReturn: () => void;
  returnLabel?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { if (reducedMotion) video.current?.pause(); }, [reducedMotion]);

  const play = async () => {
    try { await video.current?.play(); }
    catch { setError(true); }
  };

  return (
    <main className={styles.entryPage}>
      {entering ? <video key={`${property.id}-${attempt}`} ref={video} className={styles.entryVideo}
        src={property.entranceVideo} poster={property.buildingPoster} aria-label={`Video de entrada al departamento ${String(properties.findIndex((item) => item.id === property.id) + 1).padStart(2, '0')}`}
        autoPlay={!reducedMotion} muted playsInline controls preload="auto"
        onPlay={() => { setPlaying(true); setError(false); }} onPause={() => setPlaying(false)}
        onPlaying={() => setLoading(false)} onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)} onError={() => { setError(true); setLoading(false); }}
        onEnded={() => onEntered(property.id)}>
        Tu navegador no permite reproducir este video MP4.
      </video> : <img className={styles.buildingImage} src={property.buildingPoster} alt="Edificio de muestra visto desde el aire, con dos departamentos seleccionables" />}
      <div className={`${styles.entryShade} ${entering ? styles.playingShade : ''}`} />
      <header className={styles.entryHeader}>
        <Link href="/" className={styles.entryBrand}><Compass size={26} /> territorio<span>.</span></Link>
        <span className={styles.entryHeaderLabel}>EXPLORA DESDE OTRA PERSPECTIVA</span>
        {entering ? <button onClick={onReturn}><ArrowLeft size={15} /> {returnLabel}</button> : <Link href="/"><ArrowLeft size={15} /> Volver al inicio</Link>}
      </header>
      <div className={styles.entrySteps} aria-label="Etapas de la visita"><span className={!entering ? styles.currentStep : ''}>01 <span>El edificio</span></span><i /><span className={entering ? styles.currentStep : ''}>02 <span>La entrada</span></span><i /><span>03 <span>Tu departamento</span></span></div>
      {!entering ? <>
        <section className={styles.entryCopy}>
          <span className={styles.entryEyebrow}>DOS DEPARTAMENTOS. UNA NUEVA MIRADA.</span>
          <h1>No lo imagines.<br /><em>Entra.</em></h1>
          <p>Elige un punto del edificio.<br />El recorrido empieza con un video<br />y termina en tu próximo espacio.</p>
          <span className={styles.entryHint}><span /> Selecciona 01 o 02 para comenzar</span>
        </section>
        <div className={styles.buildingPoints} aria-label="Departamentos de demostración">
          {properties.map((item, index) => <button key={item.id} className={`${styles.buildingPoint} ${index === 0 ? styles.firstBuildingPoint : styles.secondBuildingPoint}`}
            onClick={() => onSelect(item.id)} aria-label={`Entrar al departamento 0${index + 1}`}>
            <span className={styles.pointNumber}>0{index + 1}</span>
            <span className={styles.pointCard}><small>DEPARTAMENTO 0{index + 1}</small><strong>{item.area} m² · {item.bedrooms} dormitorios</strong><span>Iniciar recorrido <ArrowRight size={13} /></span></span>
          </button>)}
        </div>
        <div className={styles.entryFooter}><span className={styles.entryDemoBadge}>DEMO INTERACTIVA · SOLO 2 PROPIEDADES</span><p>Edificio, videos y posiciones ilustrativos.<br />No corresponden a propiedades reales del catálogo.</p></div>
      </> : <>
        <div className={styles.entryStatus} role="status"><span className={styles.entryEyebrow}>VIDEO DE ENTRADA · DEPARTAMENTO {String(properties.findIndex((item) => item.id === property.id) + 1).padStart(2, '0')}</span><h1>El recorrido empieza aquí.</h1><p>Al finalizar el video, se abrirá el interior interactivo.</p></div>
        {loading && playing && !error && <span className={styles.buffering} role="status">Cargando video…</span>}
        {!playing && !error && <button className={styles.startEntry} onClick={play}><Play size={27} fill="currentColor" /><span>Reproducir video de entrada</span></button>}
        {error && <div className={styles.videoError} role="alert"><p>No se pudo reproducir el video.</p><button onClick={() => { setError(false); setLoading(true); setAttempt((value) => value + 1); }}><RotateCcw size={16} /> Reintentar</button><button onClick={() => onEntered(property.id)}>Entrar sin video <ArrowRight size={16} /></button></div>}
        <button className={styles.skipEntry} onClick={() => onEntered(property.id)}>Omitir video y entrar <ArrowRight size={16} /></button>
        <p className={styles.entryStockNote}>Secuencia editada con videos de muestra. El exterior y el interior pertenecen a lugares diferentes.</p>
      </>}
    </main>
  );
}
