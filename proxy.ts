import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isDemoIdentity, isDemoProtectedPath, readDemoAccessConfig } from '@/lib/auth/demo-access';

export const proxy = auth((request) => {
  const demoAccess = readDemoAccessConfig();
  if (!demoAccess || !isDemoProtectedPath(request.nextUrl.pathname)) return NextResponse.next();
  if (isDemoIdentity(request.auth, demoAccess)) return NextResponse.next();
  return NextResponse.redirect(new URL('/login', request.url));
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
