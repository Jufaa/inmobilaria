'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useReducer, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Bath, BedDouble, ChevronLeft, ChevronRight, Compass, Expand, LayoutGrid, MapPin, Image as ImageIcon, Play, Rotate3D, Scan, Square } from 'lucide-react';
import { createTourState, tourProperties, updateTourState, type TourMode, type TourAction, type TourState, type TourProperty } from '@/lib/property-tour-demo';
import styles from './property-tour-demo.module.css';
import { BuildingTourEntry } from './BuildingTourEntry';

const Panorama = dynamic(() => import('./Panorama'), {
  ssr: false,
  loading: () => <div className={styles.loading} role="status">Preparando la vista 360°…</div>,
});
const modes: { id: TourMode; label: string; icon: typeof Play }[] = [
  { id: 'video', label: 'Video', icon: Play },
  { id: 'photo', label: 'Galería', icon: ImageIcon },
  { id: 'panorama', label: 'Vista 360°', icon: Rotate3D },
  { id: 'plan', label: 'Plano', icon: LayoutGrid },
];

function FloorPlan({ property, active, onSelect }: { property: TourProperty; active: number; onSelect: (index: number) => void }) {
  return (
    <div className={styles.floorPlan}>
      <svg viewBox="0 0 500 400" aria-hidden="true">
        <rect x="40" y="22" width="420" height="50" fill="#c8b998" fillOpacity=".25" />
        <path d="M40 72H460V378H40ZM40 270H320M320 72V378M320 210H460M390 72V210" />
        <path className={styles.door} d="M270 270h50M320 228v42M390 170v40" />
        <g className={styles.furniture}>
          <rect x="66" y="100" width="100" height="38" rx="6" /><rect x="66" y="100" width="30" height="110" rx="6" />
          <rect x="130" y="165" width="75" height="45" rx="8" /><circle cx="260" cy="160" r="29" />
          <path d="M58 294H190V354H58ZM58 310H190M166 294V354" />
          <rect x="334" y="90" width="42" height="75" rx="4" /><rect x="404" y="90" width="42" height="75" rx="4" />
          <rect x="340" y="305" width="95" height="44" rx="8" />
        </g>
        <text x="179" y="250">LIVING / COMEDOR</text><text x="140" y="374">COCINA</text>
        <text x="390" y="255">ÁREA PRIVADA</text><text x="250" y="53">BALCÓN</text>
      </svg>
      {property.scenes.map((scene, index) => (
        <button key={scene.id} className={`${styles.planPoint} ${active === index ? styles.activePoint : ''}`}
          style={{ left: `${scene.x}%`, top: `${scene.y}%` }} onClick={() => onSelect(index)}
          aria-label={`Ver ${scene.name}`} title={scene.name}>
          {index + 1}
        </button>
      ))}
    </div>
  );
}

export function PropertyTourDemo({ initialPropertyId, properties = tourProperties, onReturn }: { initialPropertyId?: string; properties?: TourProperty[]; onReturn?: () => void } = {}) {
  const [state, dispatch] = useReducer((current: TourState, action: TourAction) => updateTourState(current, action, properties), initialPropertyId, (id) => createTourState(id, properties));
  const [reducedMotion, setReducedMotion] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const interiorVideo = useRef<HTMLVideoElement>(null);
  const [fullscreenError, setFullscreenError] = useState('');
  const [imageError, setImageError] = useState(false);
  const viewer = useRef<HTMLDivElement>(null);
  const property = properties.find((item) => item.id === state.propertyId)!;
  const scene = property.scenes[state.sceneIndex];

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setReducedMotion(media.matches); if (media.matches) interiorVideo.current?.pause(); };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => { setImageError(false); setVideoError(false); }, [scene.image, property.id, state.mode]);

  const expand = async () => {
    setFullscreenError('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (viewer.current?.requestFullscreen) await viewer.current.requestFullscreen();
      else setFullscreenError('La pantalla completa no está disponible en este navegador.');
    } catch { setFullscreenError('La pantalla completa no está disponible en este navegador.'); }
  };

  if (state.phase !== 'inside') {
    return <BuildingTourEntry key={`${state.propertyId}-${state.phase}`} property={property} properties={properties}
      entering={state.phase === 'entering'} reducedMotion={reducedMotion}
      onSelect={(id) => dispatch({ type: 'property', id })}
      onEntered={(id) => dispatch({ type: 'entered', id })}
      onReturn={onReturn ?? (() => dispatch({ type: 'return' }))} returnLabel={onReturn ? 'Volver a la zona' : undefined} />;
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Territorio, inicio"><Compass size={25} /> territorio<span>.</span></Link>
        <span className={styles.headerLabel}>ESPACIOS QUE SE VIVEN</span>
        <button className={styles.back} onClick={onReturn ?? (() => dispatch({ type: 'return' }))}><ArrowLeft size={16} /> {onReturn ? 'Volver a la zona' : 'Volver al edificio'}</button>
      </header>
      <div className={styles.intro}>
        <div><span className={styles.eyebrow}>UNA NUEVA FORMA DE VISITAR</span><h1>Tu próxima historia empieza adentro.</h1></div>
        <span className={styles.demoBadge}><span /> DEMO · {properties.length} PROPIEDADES</span>
      </div>
      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <div className={styles.selectionLabel}><span>Elige un espacio</span><span>01 — {String(properties.length).padStart(2, '0')}</span></div>
          <div className={styles.propertyList} aria-label="Departamentos de demostración">
            {properties.map((item, index) => (
              <button key={item.id} onClick={() => dispatch({ type: 'property', id: item.id })}
                className={`${styles.propertyOption} ${item.id === property.id ? styles.selectedProperty : ''}`} aria-pressed={item.id === property.id}>
                <img src={item.interiorPoster} alt="" /><span><small>DEPARTAMENTO 0{index + 1}</small><strong>{item.neighborhood.split(' · ')[0]}</strong><small>{item.area} m² · {item.bedrooms} dormitorios</small></span><ArrowUpRight size={18} />
              </button>
            ))}
          </div>
          <div className={styles.propertyInfo}>
            <span className={styles.forSale}>EN VENTA · EJEMPLO FICTICIO</span>
            <h2>{property.title}</h2>
            <p className={styles.location}><MapPin size={14} /> {property.neighborhood}</p>
            <div className={styles.facts}><span><Square size={18} /><strong>{property.area} m²</strong>superficie</span><span><BedDouble size={19} /><strong>{property.bedrooms}</strong>dormitorios</span><span><Bath size={18} /><strong>{property.bathrooms}</strong>baños</span></div>
            <div className={styles.price}><small>PRECIO ILUSTRATIVO</small><strong>{property.price}</strong></div>
          </div>
          <div className={styles.sidebarNote}><Scan size={22} /><p>No solo lo mires.<br /><strong>Imagina vivirlo.</strong></p></div>
        </aside>
        <div className={styles.experience}>
          <div className={styles.toolbar}>
            <div className={styles.modes} aria-label="Modo de visualización">
              {modes.map(({ id, label, icon: Icon }) => <button key={id} aria-pressed={state.mode === id} className={state.mode === id ? styles.activeMode : ''} onClick={() => dispatch({ type: 'mode', mode: id })}><Icon size={16} />{label}</button>)}
            </div>
            <span className={styles.viewLabel}>TU VISITA, A TU RITMO</span>
          </div>
          <div className={styles.viewer} ref={viewer} tabIndex={0} aria-label="Visor interactivo del departamento"
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget || state.mode !== 'photo') return;
              if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); dispatch({ type: event.key === 'ArrowRight' ? 'next' : 'previous' }); }
            }}>
            {state.mode === 'photo' && <>
              <img key={`${property.id}-${scene.id}`} className={`${styles.sceneImage} ${scene.id === 'balcony' ? styles.closeup : ''}`}
                style={{ objectPosition: scene.position }} src={scene.image} alt={`${scene.name}: imagen ilustrativa de un interior, no de una propiedad real`} onError={() => setImageError(true)} />
              <div className={styles.shade} />
              {imageError && <p className={styles.imageError} role="alert">No se pudo cargar la imagen. Prueba con otro ambiente.</p>}
              <span className={styles.sceneBadge}><span /> GALERÍA ILUSTRATIVA · {String(state.sceneIndex + 1).padStart(2, '0')} / 03</span>
              <button className={styles.hotspot} onClick={() => dispatch({ type: 'scene', index: (state.sceneIndex + 1) % property.scenes.length })} aria-label={`Explorar ${property.scenes[(state.sceneIndex + 1) % property.scenes.length].name}`}><ArrowUpRight size={22} /><span>Siguiente espacio</span></button>
              <div className={styles.sceneCaption}><small>RECORRE. DESCUBRE. IMAGINA.</small><h3>{scene.name}</h3><p>{scene.description}</p></div>
              <div className={styles.playback}>
                <span>Fotografías ilustrativas · {state.sceneIndex + 1} de {property.scenes.length}</span>
                <button onClick={() => dispatch({ type: 'previous' })} aria-label="Ambiente anterior"><ChevronLeft size={20} /></button>
                <button onClick={() => dispatch({ type: 'next' })} aria-label="Ambiente siguiente"><ChevronRight size={20} /></button>
              </div>
            </>}
            {state.mode === 'video' && <>
              <video key={property.id} ref={interiorVideo} className={styles.interiorVideo}
                src={property.interiorVideo} poster={property.interiorPoster} aria-label="Video del interior del departamento, material de muestra"
                controls autoPlay={!reducedMotion} loop muted playsInline preload="auto" onError={() => setVideoError(true)}>
                Tu navegador no permite reproducir este video MP4.
              </video>
              <span className={styles.sceneBadge}>VIDEO INTERIOR · MATERIAL DE MUESTRA</span>
              {videoError && <div className={styles.videoError} role="alert"><p>No se pudo cargar el video del interior.</p><button onClick={() => { setVideoError(false); interiorVideo.current?.load(); }}>Reintentar video</button><button onClick={() => dispatch({ type: 'mode', mode: 'panorama' })}>Abrir vista 360°</button></div>}
            </>}
            {state.mode === 'panorama' && <div className={styles.panorama}><Panorama key={property.id} url={property.panorama} /></div>}
            {state.mode === 'plan' && <div className={styles.planView}><span className={styles.eyebrow}>CADA ESPACIO, CONECTADO</span><h3>Elige por dónde empezar.</h3><p>Selecciona un punto del plano para explorar su vista ilustrativa.</p><FloorPlan property={property} active={state.sceneIndex} onSelect={(index) => dispatch({ type: 'scene', index })} /><small>Plano esquemático, no a escala. No representa una distribución real.</small></div>}
            <button className={styles.expand} onClick={expand} aria-label="Alternar pantalla completa"><Expand size={18} /></button>
            {fullscreenError && <p className={styles.fullscreenError} role="status">{fullscreenError}</p>}
          </div>
          <div className={styles.sceneStrip} aria-label="Vistas del departamento">
            {property.scenes.map((item, index) => <button key={item.id} className={state.mode === 'photo' && state.sceneIndex === index ? styles.selectedScene : ''} aria-pressed={state.mode === 'photo' && state.sceneIndex === index} onClick={() => dispatch({ type: 'scene', index })}><span className={styles.thumbnail}><img src={item.image} alt="" style={{ objectPosition: item.position }} /><span>0{index + 1}</span></span><span>{item.name}</span>{state.mode === 'photo' && state.sceneIndex === index && <span className={styles.here}>ESTÁS AQUÍ</span>}</button>)}
          </div>
        </div>
      </div>
      <footer className={styles.disclaimer}><span>UNA MUESTRA DE LO QUE VIENE.</span><p>Solo dos propiedades ficticias. Los videos de stock muestran lugares diferentes: no representan un mismo edificio ni propiedades reales en Río Cuarto. Las fotos, el panorama 360° y el plano son ilustrativos. <a href="/demo-assets/tours/CREDITS.md">Créditos de los videos</a>.</p></footer>
    </main>
  );
}
