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
  useEffect(() => { try { const saved = parseAgencies(JSON.parse(localStorage.getItem(AGENCY_REGISTRY_KEY) || 'null')); if(saved) setAgencies(saved); } catch {} setReady(true); }, [pathname]);
  const id = pathname.match(/^\/inmobiliaria\/([^/]+)/)?.[1] ?? 'principal';
  const agency = agencies.find(item => item.id === id);
  if (!agency) return ready ? <main className="seller-app"><h1>Inmobiliaria no disponible en esta demo</h1><Link href="/vendedor">Volver al panel del vendedor</Link></main> : <p role="status">Cargando inmobiliaria…</p>;
  return <DemoProvider key={agency.id} agency={agency}>{children}</DemoProvider>;
}
