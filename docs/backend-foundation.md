# Authentication and agency foundation

This increment adds Google sign-in, PostgreSQL persistence through Prisma ORM 7, and agency memberships. It does not migrate the local demo catalog or make the existing property, inquiry, visit, or brand editor server-backed.

## Local setup

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local` and fill in `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET`. Keep real credentials out of version control.
3. Create a PostgreSQL database and configure the Google OAuth client. Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI. For production, add the matching HTTPS callback URL for the deployed domain.
4. Generate Prisma Client with `pnpm db:generate`.
5. Review and apply the additive schema with `pnpm exec prisma migrate dev`.
6. Start the app with `pnpm dev` and open `/login`. A normal verified Google account can create an agency and becomes its agency `OWNER`.

The application does not create OAuth credentials, provision a database, or apply a migration automatically. The repository contains additive SQL migrations for Auth.js, agencies, memberships, and the global platform role.

## Access model

`Agency` owns a unique slug, while `Membership` joins regular users to agencies with an explicit agency role. `User.platformRole` is independent of memberships and defaults to `USER`. A platform `OWNER` can open and manage every agency through its existing panel routes, and can create additional agencies from `/onboarding`; authorization is checked against the database on each request. Regular users remain limited to their own memberships. Public browse routes expose only `PUBLISHED` properties, so the local sample listings remain private drafts.

The first-login flow creates an agency and its owner membership in one database transaction. Agency slugs include a short random suffix to avoid collisions between companies with the same name. Platform OWNER access does not create membership rows for unrelated agencies.

## Local sample owner and demo data

To promote an existing account and populate the two fictional sample agencies, first apply the latest migrations. Then set `SAMPLE_DATA_SEED=true` and `SAMPLE_OWNER_EMAIL` in `.env.local` and run `pnpm db:seed:sample`. The selected email must belong to an existing verified Google user; the seed does not create that account. In development only, the existing `admin@localhost` seed identity remains supported. The seed promotes that selected user to global platform `OWNER`, creates or updates 20 fictional `DRAFT` properties across the sample agencies, and remains restricted to an explicitly enabled local PostgreSQL database outside production, hosted, and CI environments. It does not delete records. Re-running it updates only its deterministic sample records.

## Current boundary

The existing `AdminPanel` still reads and writes the browser's demo repository. The login and membership layer protects entry to that interface, but it does not make demo properties, consultations, appointments, or brand settings private server records. Do not put production or personal customer data into the legacy panel until its data access is migrated to tenant-scoped server operations.
