import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import { normalizeEmail, verifyPassword } from '@/lib/auth/password-auth';
import { platformDemoIdentity, readDemoAccessConfig } from '@/lib/auth/demo-access';

const isDevelopment = process.env.NODE_ENV === 'development';
const demoAccess = readDemoAccessConfig();
const emailPasswordProvider = Credentials({
  name: demoAccess ? 'Demo' : 'Correo y contraseña',
  credentials: {
    email: { label: 'Correo electrónico', type: 'email' },
    username: { label: 'Usuario local', type: 'text' },
    password: { label: 'Contraseña', type: 'password' },
  },
  async authorize(credentials) {
    const password = typeof credentials?.password === 'string' ? credentials.password : '';
    if (!password || password.length > 128) return null;

    if (demoAccess) {
      if (credentials?.username !== demoAccess.username || password !== demoAccess.password) return null;
      const user = await prisma.user.findUnique({
        where: { email: demoAccess.email },
        select: { id: true, name: true, email: true, passwordHash: true, platformRole: true },
      });
      if (!user?.email || user.email.toLowerCase() !== demoAccess.email || !await verifyPassword(password, user.passwordHash)) return null;
      if (demoAccess.platformOwner) {
        if (user.id !== platformDemoIdentity.id || user.platformRole !== 'OWNER') return null;
        return { id: user.id, name: user.name, email: user.email };
      }
      if (user.platformRole !== 'USER') return null;
      const memberships = await prisma.membership.findMany({
        where: { userId: user.id },
        select: { role: true, agency: { select: { slug: true } } },
      });
      if (memberships.length !== 1 || memberships[0]?.agency.slug !== demoAccess.agencySlug || memberships[0]?.role !== 'ADMIN') return null;
      return { id: user.id, name: user.name, email: user.email };
    }

    if (isDevelopment && credentials?.username === 'admin') {
      const expectedPassword = process.env.DEV_ADMIN_PASSWORD ?? 'admin';
      if (password !== expectedPassword) return null;
      return prisma.user.findUnique({
        where: { email: 'admin@localhost' },
        select: { id: true, name: true, email: true },
      });
    }

    if (typeof credentials?.email !== 'string') return null;
    const email = normalizeEmail(credentials.email);
    if (!email || email.length > 254) return null;
    const user = await prisma.user.findUnique({ where: { email } });
    if (user?.id === platformDemoIdentity.id || user?.email?.toLowerCase() === platformDemoIdentity.email) return null;
    if (!user?.emailVerified || !await verifyPassword(password, user.passwordHash)) return null;

    return { id: user.id, name: user.name, email: user.email };
  },
});

const googleProviders = !demoAccess && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [Google] : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: demoAccess ? [emailPasswordProvider] : [...googleProviders, emailPasswordProvider],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token }) {
      if (token.sub === platformDemoIdentity.id && !demoAccess?.platformOwner) return null;
      return token;
    },
    async signIn({ account, profile }) {
      if (account?.provider === 'credentials') return true;
      if (account?.provider !== 'google') return false;
      return profile?.email_verified === true;
    },
    session({ session, user, token }) {
      const userId = user?.id ?? token?.sub;
      if (session.user && userId) session.user.id = userId;
      return session;
    },
  },
});
