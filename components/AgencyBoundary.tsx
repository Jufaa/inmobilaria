 'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AGENCY_REGISTRY_KEY, defaultAgencies, parseAgencies } from '@/lib/agencies';
import { DemoProvider } from './DemoProvider';
export default function AgencyBoundary({children}: {children: React.ReactNode}) {
  const pathname = usePathname();
  const [agencies, setAgencies] = useState(defaultAgencies);
  const [ready, setReady] = useState(false);
  const [isDatabaseAgency, setIsDatabaseAgency] = useState(false);
  const isAuthenticatedPanelRoute = /^\/inmobiliaria\/[^/]+\/panel(?:\/.*)?\/?$/.test(pathname);
  const id = pathname.match(/^\/inmobiliaria\/([^/]+)/)?.[1] ?? 'principal';
  useEffect(() => {
    if (isAuthenticatedPanelRoute) return;
    let cancelled = false;
    setReady(false);
    let localAgencies = defaultAgencies;
    try {
      const saved = parseAgencies(JSON.parse(localStorage.getItem(AGENCY_REGISTRY_KEY) || 'null'));
      if (saved) localAgencies = saved;
    } catch {}
    setAgencies(localAgencies);
    const localAgency = localAgencies.find((item) => item.id === id);
    if (localAgency) {
      setIsDatabaseAgency(false);
      setReady(true);
    } else {
      void fetch(`/api/public-agencies/${encodeURIComponent(id)}/exists`, { cache: 'no-store' })
        .then((response) => response.ok ? response.json() : { exists: false })
        .then((result: { exists?: boolean }) => {
          if (cancelled) return;
          setIsDatabaseAgency(result.exists === true);
          setReady(true);
        })
        .catch(() => {
          if (cancelled) return;
          setIsDatabaseAgency(false);
          setReady(true);
        });
    }
    return () => { cancelled = true; };
  }, [isAuthenticatedPanelRoute, id]);
  if (isAuthenticatedPanelRoute) return <>{children}</>;
  if (isDatabaseAgency) return <>{children}</>;
  const agency = agencies.find(item => item.id === id);
  if (!agency) return ready ? <main className="seller-app"><h1>Inmobiliaria no disponible en esta demo</h1><Link href="/vendedor">Volver al panel del vendedor</Link></main> : <p role="status">Cargando inmobiliaria…</p>;
  return <DemoProvider key={agency.id} agency={agency}>{children}</DemoProvider>;
}
