'use client';

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './map-workspace-layout.module.css';

const OperationControlsHost = createContext<HTMLDivElement | null>(null);
export function MapSidebarControls({children}:{children:ReactNode}) {
  const host=useContext(OperationControlsHost);
  return host ? createPortal(children,host) : null;
}

export function MapWorkspaceLayout({header,operation,administration,operationFooter,children}:{header:ReactNode;operation:ReactNode;administration:ReactNode;operationFooter?:ReactNode;children:ReactNode}) {
  const id=useId();
  const [operationOpen,setOperationOpen]=useState(false);
  const [administrationOpen,setAdministrationOpen]=useState(false);
  const [controlsHost,setControlsHost]=useState<HTMLDivElement|null>(null);
  const operationToggle=useRef<HTMLButtonElement>(null);
  const administrationToggle=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const media=window.matchMedia('(min-width: 901px)');
    const resize=()=>{setOperationOpen(media.matches);if(!media.matches)setAdministrationOpen(false);};
    resize();media.addEventListener('change',resize);
    return()=>media.removeEventListener('change',resize);
  },[]);
  function toggle(side:'operation'|'administration') {
    const narrow=window.matchMedia('(max-width: 900px)').matches;
    if(side==='operation'){setOperationOpen(value=>!value);if(narrow)setAdministrationOpen(false);}
    else {setAdministrationOpen(value=>!value);if(narrow)setOperationOpen(false);}
  }
  return <OperationControlsHost.Provider value={controlsHost}>
    <div className={styles.viewport} data-operation-open={operationOpen} data-administration-open={!!administration&&administrationOpen}>
      <div className={styles.mapContent}>{children}</div>
      <div className={styles.mapHeader}>{header}</div>
      <button ref={operationToggle} type="button" className={`${styles.toggle} ${styles.operationToggle}`} aria-expanded={operationOpen} aria-controls={`${id}-operation`} onClick={()=>toggle('operation')}>☰ Operación</button>
      {administration&&<button ref={administrationToggle} type="button" className={`${styles.toggle} ${styles.administrationToggle}`} aria-expanded={administrationOpen} aria-controls={`${id}-administration`} onClick={()=>toggle('administration')}>Administración ☰</button>}
      <aside id={`${id}-operation`} className={`${styles.pane} ${styles.operationPane}`} aria-label="Operación" hidden={!operationOpen}
        onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOperationOpen(false);operationToggle.current?.focus();}}}>
        <header><strong>Operación</strong><button type="button" aria-label="Cerrar operación" onClick={()=>{setOperationOpen(false);operationToggle.current?.focus();}}>×</button></header>
        <div className={styles.paneBody}><div className={styles.operationControls} ref={setControlsHost}/>{operation}{operationFooter}</div>
      </aside>
      {administration&&<aside id={`${id}-administration`} className={`${styles.pane} ${styles.administrationPane}`} aria-label="Administración" hidden={!administrationOpen}
        onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setAdministrationOpen(false);administrationToggle.current?.focus();}}}>
        <header><strong>Administración</strong><button type="button" aria-label="Cerrar administración" onClick={()=>{setAdministrationOpen(false);administrationToggle.current?.focus();}}>×</button></header>
        <div className={styles.paneBody}>{administration}</div>
      </aside>}
    </div>
  </OperationControlsHost.Provider>;
}
