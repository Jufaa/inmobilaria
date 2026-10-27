'use client';

import Link from 'next/link';
import styles from './workspace-shell.module.css';

type Section = 'map' | 'properties' | 'collaboration' | 'inquiries' | 'zones' | 'analytics' | 'branding' | 'rentals';

const groups: { label: string; sections: { id: Section; label: string; path: string; restricted?: 'collaboration' | 'rentals' }[] }[] = [
  { label: 'Operación', sections: [
    { id: 'map', label: 'Mapa', path: '' },
    { id: 'properties', label: 'Propiedades', path: '/propiedades' },
    { id: 'inquiries', label: 'Consultas', path: '/consultas' },
    { id: 'analytics', label: 'Estadísticas', path: '/analiticas' },
  ] },
  { label: 'Administración', sections: [
    { id: 'zones', label: 'Barrios', path: '/zonas' },
    { id: 'collaboration', label: 'Colaboración', path: '/colaboracion', restricted: 'collaboration' },
    { id: 'rentals', label: 'Alquileres', path: '/alquileres', restricted: 'rentals' },
    { id: 'branding', label: 'Personalización', path: '/personalizacion', restricted: 'collaboration' },
  ] },
];

export function AgencySectionTabs({
  panelPath,
  activeSection,
  canManageCollaboration,
  canManageRentals,
}: {
  panelPath: string;
  activeSection: Section;
  canManageCollaboration: boolean;
  canManageRentals: boolean;
}) {
  return (
    <nav className={styles.sectionTabs} aria-label="Secciones de la inmobiliaria">
      {groups.map((group) => {
        const available = group.sections.filter((section) =>
          section.restricted === 'collaboration' ? canManageCollaboration
            : section.restricted === 'rentals' ? canManageRentals
              : true,
        );
        return <div className={styles.sectionGroup} key={group.label}>
          <span className={styles.groupLabel}>{group.label}</span>
          <div className={styles.sectionTabsList}>
            {available.map((section) => (
              <Link
                key={section.id}
                href={`${panelPath}${section.path}`}
                className={styles.sectionTab}
                aria-current={activeSection === section.id ? 'page' : undefined}
              >
                {section.label}
              </Link>
            ))}
          </div>
        </div>;
      })}
    </nav>
  );
}
