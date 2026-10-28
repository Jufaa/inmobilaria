export const platformDemoIdentity = { id: 'territorio-platform-demo-owner', email: 'platform-admin@demo.invalid' } as const;

export type DemoAccessConfig = {
  platformOwner?: boolean;
  username: string;
  password: string;
  email: string;
  agencySlug: string;
};

type Environment = Record<string, string | undefined>;

export function isDemoAccessEnabled(environment: Environment = process.env) {
  return environment.DEMO_ACCESS_ENABLED === 'true';
}

export function readDemoAccessConfig(environment: Environment = process.env): DemoAccessConfig | null {
  if (!isDemoAccessEnabled(environment)) return null;

  const platformOwner = environment.DEMO_PLATFORM_OWNER_ENABLED === 'true';
  if (platformOwner && environment.DEMO_FICTITIOUS_DATA_CONFIRMED !== 'true') {
    throw new Error('Global demo requires explicit fictitious-data confirmation.');
  }
  const values = {
    username: environment.DEMO_ADMIN_USERNAME?.trim(),
    password: environment.DEMO_ADMIN_PASSWORD,
    email: environment.DEMO_ADMIN_EMAIL?.trim().toLowerCase(),
    agencySlug: environment.DEMO_AGENCY_SLUG?.trim(),
  };
  const required = [
    ['DEMO_ADMIN_USERNAME', values.username],
    ['DEMO_ADMIN_PASSWORD', values.password],
    ['DEMO_ADMIN_EMAIL', values.email],
    ...(!platformOwner ? [['DEMO_AGENCY_SLUG', values.agencySlug]] : []),
  ] as const;
  for (const [name, value] of required) {
    if (!value) throw new Error(`Demo access is enabled but ${name} is not configured.`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email!)) {
    throw new Error('Demo access requires a valid DEMO_ADMIN_EMAIL.');
  }
  if (values.username !== 'admin' || values.password !== 'admin') {
    throw new Error('Fictitious demo access credentials must be admin/admin.');
  }
  if (platformOwner && values.email !== platformDemoIdentity.email) {
    throw new Error('Global demo requires the dedicated platform demo identity.');
  }
  return { ...values, agencySlug: values.agencySlug ?? '', ...(platformOwner ? { platformOwner: true } : {}) } as DemoAccessConfig;
}

export function isDemoIdentity(session: { user?: { email?: string | null } } | null | undefined, config: Pick<DemoAccessConfig, 'email'>) {
  return Boolean(session?.user?.email && session.user.email.toLowerCase() === config.email.toLowerCase());
}

export function isDemoProtectedPath(pathname: string) {
  if (pathname === '/login') return false;
  if (pathname === '/api/auth' || pathname.startsWith('/api/auth/')) return false;
  if (pathname.startsWith('/_next/') || pathname === '/favicon.ico' || pathname === '/robots.txt' || pathname === '/sitemap.xml') return false;
  if (!pathname.startsWith('/api/') && /\.[a-z0-9]{1,10}$/i.test(pathname)) return false;
  return true;
}
