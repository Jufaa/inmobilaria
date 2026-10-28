# Run this app with Neon PostgreSQL

The existing Next.js server connects to Neon through Prisma 7 and `@prisma/adapter-pg`. Auth.js and the application routes remain in Next.js. `neon deploy` configures PostgreSQL; it does not publish this frontend.

## Run locally against Neon

1. Use the existing `.neon` project link and `neon.ts` configuration.
2. Run `neon deploy` to reconcile the selected services and pull environment variables.
3. Run `pnpm db:generate`, then `pnpm db:migrate:deploy`.
4. Run `npm run build`, then `npm run start -- --port 3108`.

Do not commit environment files or connection strings.

## Connections

- `DATABASE_URL`: pooled runtime connection, used only by the server-side Prisma adapter.
- `DATABASE_URL_UNPOOLED`: direct connection for Prisma CLI migrations. When absent, Prisma CLI uses `DATABASE_URL`, preserving local development.
- `NEON_BRANCH`: branch context supplied by the Neon CLI.

Setup preserved the previous ignored local environment in `.env.local.before-neon` (or `.env.before-neon` when applicable). Keep that backup private. Running the app now uses Neon; it does not copy, delete, or replace the former local database.

## Data and authentication

Applying migrations creates the schema, not sample records or copies of existing data. The sample/demo seed commands intentionally require a local development database; do not disable those checks to seed a hosted database.

The local `admin/admin` shortcut is development-only. Existing demo mode is limited to one fictitious agency and rejects a global owner. It is not a production-wide admin account. A hosted globally browsing demo needs a separately scoped authentication change before sharing the application URL.

## Verify

A build or HTTP 200 alone does not prove database connectivity: some public application services intentionally catch database errors. Verify successful model queries through the existing Prisma adapter, then exercise database-backed application routes through the production server. An empty migrated database should return an empty catalogue rather than an unavailable catalogue.
