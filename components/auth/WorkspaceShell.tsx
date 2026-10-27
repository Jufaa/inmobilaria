import Link from 'next/link';
import { Building2, MapPinned } from 'lucide-react';
import { GoogleSignOut } from './GoogleSignOut';
import styles from './workspace-shell.module.css';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { AgencySectionTabs } from './AgencySectionTabs';

export function WorkspaceShell({
  agencyName,
  agencySlug,
  email,
  activeSection,
  canManageCollaboration = false,
  canManageRentals = canManageCollaboration,
  children,
}: {
  agencyName: string;
  agencySlug: string;
  email?: string | null;
  activeSection: 'map' | 'properties' | 'collaboration' | 'inquiries' | 'zones' | 'analytics' | 'branding' | 'rentals';
  canManageCollaboration?: boolean;
  canManageRentals?: boolean;
  children: React.ReactNode;
}) {
  const panelPath = `/inmobiliaria/${encodeURIComponent(agencySlug)}/panel`;

  return (
    <div className={styles.shell}>
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
        <div className={styles.actions}>
          <ThemeToggle />
          <Link className={styles.workspaceLink} href="/workspace"><Building2 size={16} /> Espacios</Link>
          <GoogleSignOut />
        </div>
      </header>
      <div className={styles.content}>
        <AgencySectionTabs
          panelPath={panelPath}
          activeSection={activeSection}
          canManageCollaboration={canManageCollaboration}
          canManageRentals={canManageRentals}
        />
        <div className={styles.main}>{children}</div>
      </div>
    </div>
  );
}
