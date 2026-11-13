'use client';

import { cloneElement, useId, useState, type ReactElement, type ReactNode } from 'react';
import styles from './personalization-panels.module.css';

export type PresentationSection = 'map' | 'properties' | 'appearance';
type PersonalizationSection = 'identity' | PresentationSection;
type Section<T extends string> = { id: T; label: string };

export const presentationSections: Section<PresentationSection>[] = [
  { id: 'map', label: 'Mapa' },
  { id: 'properties', label: 'Inmuebles' },
  { id: 'appearance', label: 'Apariencia' },
];

export function PresentationPanelTabs<T extends string>({ id, sections, value, onChange, panelId }: {
  id: string; sections: Section<T>[]; value: T; onChange: (section: T) => void; panelId?: (section: T) => string;
}) {
  return <div className={styles.tabs} role="tablist" aria-label="Secciones de personalización">
    {sections.map((section, index) => <button
      key={section.id}
      id={`${id}-tab-${section.id}`}
      data-section={section.id}
      type="button"
      role="tab"
      aria-selected={value === section.id}
      aria-controls={panelId?.(section.id) ?? `${id}-panel-${section.id}`}
      tabIndex={value === section.id ? 0 : -1}
      onClick={() => onChange(section.id)}
      onKeyDown={event => {
        const nextIndex = event.key === 'ArrowRight' ? (index + 1) % sections.length
          : event.key === 'ArrowLeft' ? (index - 1 + sections.length) % sections.length
            : event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : null;
        if (nextIndex === null) return;
        event.preventDefault();
        const next = sections[nextIndex].id;
        onChange(next);
        event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-section="${next}"]`)?.focus();
      }}
    >{section.label}</button>)}
  </div>;
}

export function PersonalizationPanels({ identity, presentation }: {
  identity: ReactNode;
  presentation: ReactElement<{ section?: PresentationSection; hideNavigation?: boolean }>;
}) {
  const id = useId();
  const [active, setActive] = useState<PersonalizationSection>('identity');
  const [editorSection, setEditorSection] = useState<PresentationSection>('map');
  function select(section: PersonalizationSection) {
    if (section !== 'identity') setEditorSection(section);
    setActive(section);
  }
  return <section className={styles.panels}>
    <PresentationPanelTabs id={id} sections={[{ id: 'identity', label: 'Identidad' }, ...presentationSections]} value={active} onChange={select} panelId={section => `${id}-panel-${section === 'identity' ? 'identity' : 'presentation'}`} />
    <div id={`${id}-panel-identity`} role="tabpanel" aria-labelledby={`${id}-tab-identity`} hidden={active !== 'identity'}>
      {identity}
    </div>
    <div id={`${id}-panel-presentation`} role="tabpanel" aria-labelledby={`${id}-tab-${editorSection}`} hidden={active === 'identity'}>
      {cloneElement(presentation, { section: editorSection, hideNavigation: true })}
    </div>
  </section>;
}
