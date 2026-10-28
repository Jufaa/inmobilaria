# Prepare the fictitious hosted demo

This workflow copies the existing local business data into the linked Neon production database and creates a dedicated global demo owner. It is only for the user-confirmed fictitious dataset. Do not enable this on customer data.

## Copy once

The script reads the local source from the ignored `.env.local.before-neon` backup and the direct Neon target from `.env.local`. PostgreSQL must be running locally. It never writes to the source database.

Preview without writes:

```sh
DEMO_FICTITIOUS_DATA_CONFIRMED=true DEMO_TARGET_PROJECT_ID=damp-grass-69747378 node --experimental-strip-types scripts/prepare-neon-demo.mjs
```

Use the same command with `--apply` to copy and create the dedicated account. The destination must be empty; the script refuses to merge, overwrite, truncate or reset records. Do not retry an uncertain commit automatically.

Both databases must have identical completed migration histories and the expected table inventory. A repeatable-read source snapshot preserves consistency. During apply, the destination transaction locks application tables, checks emptiness, restores rows with exact decimal JSON values and creates the account atomically. Failure before commit rolls everything back. Locks time out rather than waiting indefinitely.

OAuth accounts, sessions and verification tokens are deliberately excluded. Existing user IDs remain because audit and sharing records depend on them. Destination migration history is retained.

## Configure Vercel after a successful copy

Set these **server-side** environment variables for the deployment:

```dotenv
DEMO_ACCESS_ENABLED=true
DEMO_PLATFORM_OWNER_ENABLED=true
DEMO_FICTITIOUS_DATA_CONFIRMED=true
DEMO_ADMIN_USERNAME=admin
DEMO_ADMIN_PASSWORD=admin
DEMO_ADMIN_EMAIL=platform-admin@demo.invalid
```

Also configure the pooled Neon `DATABASE_URL`, a private random `AUTH_SECRET`, and `AUTH_URL=https://YOUR-DEPLOYMENT-DOMAIN`. Keep the Mapbox public token configured. Never paste a connection string or auth secret into a public variable. Redeploy the updated source after setting variables.

Global demo mode authenticates only the dedicated account with its stored password hash and `OWNER` role. It does not promote imported users. Without the global flag, existing single-agency demo restrictions remain intact. Disable both demo flags before using real data.

The development shortcut `admin@localhost` is not the hosted demo account. Hosted login must use the username and password form. Frontend source publication and Vercel changes require the chosen Vercel project; the database-copy command does neither.
