import Link from 'next/link';
import { Building2, MapPinned } from 'lucide-react';
import { GoogleSignOut } from './GoogleSignOut';
import styles from './workspace-shell.module.css';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { AgencySectionTabs } from './AgencySectionTabs';
import { PanelBrandTheme } from './PanelBrandTheme';
import { MapWorkspaceLayout } from './MapWorkspaceLayout';
import { WorkspaceEditPermissionProvider } from './WorkspaceEditPermission';

export function WorkspaceShell({
  agencyName,
  agencySlug,
  brandPrimaryColor,
  email,
  activeSection,
  canManageCollaboration = false,
  canManageRentals = canManageCollaboration,
  canEdit = false,
  fullscreenMap = false,
  children,
}: {
  agencyName: string;
  agencySlug: string;
  brandPrimaryColor?: string | null;
  email?: string | null;
  activeSection: 'map' | 'properties' | 'collaboration' | 'inquiries' | 'zones' | 'analytics' | 'branding' | 'rentals' | 'offers';
  canManageCollaboration?: boolean;
  canManageRentals?: boolean;
  canEdit?: boolean;
  fullscreenMap?: boolean;
  children: React.ReactNode;
}) {
  const panelPath = `/inmobiliaria/${encodeURIComponent(agencySlug)}/panel`;

  const accountControls=(
        <div className={styles.actions}>
          <ThemeToggle />
          <Link className={styles.workspaceLink} href="/workspace"><Building2 size={16} /> Espacios</Link>
          <GoogleSignOut />
        </div>
  );
  const header=(
      <header className={styles.bar}>
        <Link className={styles.brand} href="/" aria-label="Territorio, inicio">
          <span className={styles.brandMark}><MapPinned size={19} strokeWidth={2} /></span>
          <span>territorio<span className={styles.brandDot}>.</span></span>
        </Link>
        <div className={styles.identity}>
          <span className={styles.context}>Espacio inmobiliario</span>
          <strong>{agencyName}</strong>
          {email && <span className={styles.email}>{email}</span>}
        </div>
        {!fullscreenMap && accountControls}
      </header>
  );
  if(fullscreenMap) return <PanelBrandTheme agencySlug={agencySlug} initialColor={brandPrimaryColor} className={`${styles.shell} ${styles.fullscreenShell}`}>
    <WorkspaceEditPermissionProvider canEdit={canEdit}>
      <MapWorkspaceLayout header={<div className={styles.mapHeaderContent}>{header}</div>}
        operation={<AgencySectionTabs group="operation" vertical panelPath={panelPath} activeSection={activeSection} canManageCollaboration={canManageCollaboration} canManageRentals={canManageRentals} canEdit={canEdit}/>}
        administration={<><AgencySectionTabs group="administration" vertical panelPath={panelPath} activeSection={activeSection} canManageCollaboration={canManageCollaboration} canManageRentals={canManageRentals} canEdit={canEdit}/><div className={styles.sidebarAccount}>{accountControls}</div></>}>
        {children}
      </MapWorkspaceLayout>
    </WorkspaceEditPermissionProvider>
  </PanelBrandTheme>;
  return (
    <PanelBrandTheme agencySlug={agencySlug} initialColor={brandPrimaryColor} className={styles.shell}>
      {header}
      <div className={styles.content}>
        <AgencySectionTabs
          panelPath={panelPath}
          activeSection={activeSection}
          canManageCollaboration={canManageCollaboration}
          canManageRentals={canManageRentals}
          canEdit={canEdit}
        />
        <WorkspaceEditPermissionProvider canEdit={canEdit}>
          <div className={styles.main}>{children}</div>
        </WorkspaceEditPermissionProvider>
      </div>
    </PanelBrandTheme>
  );
}
