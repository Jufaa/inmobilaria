'use client';

import Link from 'next/link';
import styles from './workspace-shell.module.css';

type Section = 'map' | 'properties' | 'collaboration' | 'inquiries' | 'zones' | 'analytics' | 'branding' | 'rentals' | 'offers';

const groups: { label: string; sections: { id: Section; label: string; path: string; restricted?: 'collaboration' | 'rentals' | 'edit' | 'basic' }[] }[] = [
  { label: 'Operación', sections: [
    { id: 'map', label: 'Mapa', path: '' },
    { id: 'properties', label: 'Propiedades', path: '/propiedades' },
    { id: 'inquiries', label: 'Consultas', path: '/consultas' },
    { id: 'analytics', label: 'Estadísticas', path: '/analiticas' },
  ] },
  { label: 'Administración', sections: [
    { id: 'zones', label: 'Barrios', path: '/zonas', restricted: 'edit' },
    { id: 'collaboration', label: 'Colaboración', path: '/colaboracion', restricted: 'collaboration' },
    { id: 'rentals', label: 'Alquileres', path: '/alquileres', restricted: 'rentals' },
    { id: 'branding', label: 'Personalización', path: '/personalizacion', restricted: 'basic' },
    { id: 'offers', label: 'Ofertas', path: '/ofertas', restricted: 'basic' },
  ] },
];

export function AgencySectionTabs({
  panelPath,
  activeSection,
  canManageCollaboration,
  canManageRentals,
  canEdit = false,
  canManageBasic = false,
  group: selectedGroup,
  vertical = false,
}: {
  group?: 'operation' | 'administration';
  vertical?: boolean;
  panelPath: string;
  activeSection: Section;
  canManageCollaboration: boolean;
  canManageRentals: boolean;
  canEdit?: boolean;
  canManageBasic?: boolean;
}) {
  const navigationGroups = canEdit ? groups : [{ label: 'Operación', sections: [...groups[0].sections, ...groups[1].sections.filter(section=>section.restricted==='basic')] }];
  return (
    <nav className={`${styles.sectionTabs} ${vertical ? styles.verticalTabs : ''}`}   aria-label="Secciones de la inmobiliaria">
      {navigationGroups.filter(group=>!selectedGroup||(selectedGroup==='operation'?group.label==='Operación':group.label==='Administración')).map((group) => {
        const available = group.sections.filter((section) =>
          canEdit ? true : section.restricted === 'collaboration' ? canManageCollaboration
            : section.restricted === 'rentals' ? canManageRentals
              : section.restricted === 'basic' ? canManageBasic
              : section.restricted === 'edit' ? canEdit
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
