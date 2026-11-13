'use client';

import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import styles from './workspace-shell.module.css';

const WorkspaceEditPermission = createContext(false);

export function WorkspaceEditPermissionProvider({ canEdit = false, children }: { canEdit?: boolean; children: ReactNode }) {
  return <WorkspaceEditPermission.Provider value={canEdit === true}>{children}</WorkspaceEditPermission.Provider>;
}

export function useWorkspaceEditPermission(): boolean {
  return useContext(WorkspaceEditPermission);
}

// UI permissions are advisory; every mutation also requires its server-side guard.
export function EditableForm({ children, ...props }: ComponentProps<'form'>) {
  const canEdit = useWorkspaceEditPermission();
  return <form {...props}>
    {!canEdit && <p className={styles.readOnlyMessage} role="note">Solo lectura. Solo el administrador general del sistema puede editar.</p>}
    <fieldset className={styles.editableFields} disabled={!canEdit}>{children}</fieldset>
  </form>;
}
