import { signOut } from '@/auth';

export function GoogleSignOut() {
  return (
    <form
      action={async () => {
        'use server';
        await signOut({ redirectTo: '/login' });
      }}
    >
      <button type="submit">Cerrar sesión</button>
    </form>
  );
}
