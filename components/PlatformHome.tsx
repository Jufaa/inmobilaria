import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Building2, Compass, Layers3, MapPinned } from 'lucide-react';
import styles from './platform-home.module.css';

export function PlatformHome() {
  return (
    <main className={styles.home}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Territorio, inicio">
          <span className={styles.brandIcon}><MapPinned size={19} strokeWidth={2.2} /></span>
          <span>territorio<span className={styles.brandDot}>.</span></span>
        </Link>
        <nav className={styles.nav} aria-label="Navegación principal">
          <Link href="/explorar-propiedades">Explorar propiedades</Link>
        </nav>
        <Link className={styles.login} href="/login">Espacio inmobiliario <ArrowUpRight size={16} /></Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.copy}>
          <div className={styles.eyebrow}><span /> Una nueva forma de explorar la ciudad</div>
          <h1>Encontrá tu lugar.<br /><em>Recorré la ciudad.</em></h1>
          <p className={styles.intro}>Barrios, desarrollos y propiedades en una experiencia visual pensada para descubrir más que una dirección.</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/explorar-propiedades">Explorar propiedades <ArrowRight size={18} /></Link>
            <Link className={styles.secondary} href="/login"><span className={styles.play}><Building2 size={14} /></span> Ingresar como inmobiliaria</Link>
          </div>
          <p className={styles.note}>El catálogo en vivo requiere que la base de datos esté configurada.</p>
        </div>

        <div className={styles.visual} aria-label="Vista ilustrativa de un mapa urbano con propiedades" role="img">
          <div className={styles.visualTop}><span><span className={styles.pulse} /> Río Cuarto, Córdoba</span><span className={styles.mapLabel}>MAPA INTERACTIVO</span></div>
          <svg className={styles.map} viewBox="0 0 620 460" aria-hidden="true">
            <path className={styles.park} d="M421 37l104 16 39 57-29 43-89-5-38-43z" />
            <path className={styles.park} d="M54 325l82-35 61 39-8 73-97 22-52-40z" />
            <path className={styles.road} d="M-20 166C105 207 217 193 330 222s213 32 326-12" />
            <path className={styles.road} d="M258-16c-9 94 3 155 14 228 12 82 4 161 22 270" />
            <path className={styles.roadThin} d="M36 67l503 302M81 35l-29 361M119 22l442 353M194 3l-62 415M345 5l-92 440M445 2l-88 446M570 180L30 235M591 259L62 310M576 85L64 143M514 26L21 286" />
            <path className={styles.zone} d="M191 107l121-33 94 41 17 88-64 62-137-16-52-64z" />
            <path className={styles.zoneLine} d="M191 107l121-33 94 41 17 88-64 62-137-16-52-64z" />
            <g className={styles.mapPin} transform="translate(294 175)"><circle r="25" /><circle r="9" /><path d="M0 31v21" /></g>
            <g className={styles.smallPin} transform="translate(421 293)"><circle r="13" /><circle r="4" /></g>
            <g className={styles.smallPin} transform="translate(165 275)"><circle r="13" /><circle r="4" /></g>
            <text x="271" y="120" className={styles.mapText}>CENTRO</text>
            <text x="425" y="105" className={styles.parkText}>PARQUE</text>
          </svg>
          <div className={styles.mapCard}>
            <div className={styles.cardImage}><Building2 size={25} /></div>
            <div><span className={styles.cardKicker}>EN ESTA ZONA</span><strong>Propiedades para descubrir</strong><span className={styles.cardMeta}>Barrios · casas · departamentos</span></div>
            <span className={styles.cardArrow}><ArrowUpRight size={16} /></span>
          </div>
          <span className={`${styles.floatTag} ${styles.floatOne}`}><Compass size={14} /> Explorá por barrio</span>
          <span className={`${styles.floatTag} ${styles.floatTwo}`}><Layers3 size={14} /> Ciudad · Barrio · Propiedad</span>
        </div>
      </section>

      <section className={styles.bottom} aria-label="Qué podés hacer en Territorio">
        <p>La ciudad, desde otra perspectiva</p>
        <div><span>01</span> Explorá zonas y barrios</div>
        <div><span>02</span> Descubrí propiedades a tu ritmo</div>
        <div><span>03</span> Conectá con inmobiliarias</div>
      </section>
    </main>
  );
}
