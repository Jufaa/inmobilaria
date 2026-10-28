# Neon production setup
Connect the existing Next.js/Prisma app to the explicitly selected Neon project and verify it end to end.
Branch: feat/google-aerial-zones-demo. Route: inline; no independent writer units. Verification: npm run build, production start, PostgreSQL application flows. Delivery: ask-on-risk; remote publication outside PostgreSQL is not authorized.

## Specs
- S1: `npm i -g neon@latest`. If that fails, use `npx neon@latest` in place of `neon`. If a neon command opens a browser sign-in, tell the user to finish it there. If that times out or fails, ask the user to run `neon login`, then retry.
- S2: In the project root: `neon init -y --org-id org-curly-forest-49303341 --project-id damp-grass-69747378 --branch production --services postgres`.
- S3: `neon deploy`. It provisions the services in neon.ts and pulls their env vars into `.env.local` (or `.env` if it exists).
- S4: Wire each service into the app's code using those env vars. Consult the installed Neon agent skills for best practices, e.g., what database driver to use given the app architecture and hosting runtime.
- S5: Prove it works: `npm run build` must pass, then start the app, each wired service must be tested to prove it works end to end.
- S6: Report what changed, the command output that proves step 5, and anything that failed.

## Tasks
- [x] T1 (S1) inline — Install CLI; npm global install succeeded. esbuild install script was blocked by npm policy; check CLI operation before changing that policy. Commit: pending.
- [x] T2 (S2-S3) inline — Initialize/deploy the exact authorized project and branch, preserving local environment secrets. Commit: pending.
- [x] T3 (S4) inline — Reuse Prisma 7 and pg adapter, configure pooled runtime/direct migrations as supplied. Commit: pending.
- [x] T4 (S5-S6) inline — Build, production start, real database-backed E2E verification and independent verification (risk items 1, 5). Commit: pending.

## Log
- L1 (2026-10-27): Original request:

> Set up this app on Neon.
> 1. `npm i -g neon@latest`. If that fails, use `npx neon@latest` in place of `neon`.
>    If a neon command opens a browser sign-in, tell me to finish it there. If that times out or fails, ask me to run `neon login`, then retry.
> 2. In the project root:
>    neon init -y --org-id org-curly-forest-49303341 --project-id damp-grass-69747378 --branch production --services postgres
> 3. `neon deploy`. It provisions the services in neon.ts and pulls their env vars into `.env.local` (or `.env` if it exists).
> 4. Wire each service into the app's code using those env vars. Consult the installed Neon agent skills for best practices, e.g., what database driver to use given the app architecture and hosting runtime.
> 5. Prove it works: `npm run build` must pass, then start the app, each wired service must be tested to prove it works end to end.
> 6. Report what changed, the command output that proves step 5, and anything that failed.

- L2: Existing app has Prisma 7.10, @prisma/adapter-pg, pg and Auth.js. No neon.ts or .neon exists before setup. Keep the existing ORM/authentication; provision only requested PostgreSQL. Local env files are ignored. Repository contains substantial pre-existing uncommitted work; preserve it. Forecast: approximately 100–200 authored changed lines, excluding CLI-generated lockfile changes.
- L3: Engram mirror pending: runtime session identity is unavailable and attributed writes are prohibited. Do not invent an identity or write without one.

- L4: Neon CLI 8.12.2 init completed for the exact requested org/project/production branch. Generated neon.ts and .neon; added @neon/config and @neon/env. neon deploy reported: "Utilized services: Postgres", "No changes — branch production already matches the policy." Both commands pulled three variables into ignored .env.local. Private pre-Neon env backup remains ignored. CLI init also installed user-level integrations and minted an account-scoped MCP API key; no key value is recorded here.
- L5: Observed RED: direct-URL config test failed (runtime URL selected); local fallback test passed. Prisma config now prefers DATABASE_URL_UNPOOLED; runtime adapter remains unchanged. Existing seed scripts are local-only, and development admin/admin is not a production credential. Do not bypass seed/auth guards as part of wiring.

- L6: All 12 existing migrations applied successfully to the selected Neon branch; final `pnpm exec prisma migrate status` returned `Database schema is up to date!`. No sample rows were inserted, and no local data was copied.
- L7: GREEN: config regression 2/2, pnpm typecheck, pnpm test 23/23 files and git diff --check passed. Independent verifier confirmed pooled runtime/direct migrations and successful SELECT 1 plus agency/property/presentationConfig counts, all zero.
- L8: `npm run build` passed outside sandbox: `Compiled successfully in 1464ms`, `Finished TypeScript in 5.5s`, `Generating static pages using 15 workers (15/15)`. Sandbox first attempt failed parsing TypeScript --showConfig; standalone --showConfig worked, and escalation resolved it without source edits.
- L9: `npm run start -- --port 3108` returned `Ready in 89ms`; public discovery and filtered SALE/USD requests returned HTTP 200, databaseAvailable=true, emptyCatalogue=true, catalogueUnavailable=false. Workspace redirected 307 to login. Temporary production server stopped. Parent spot check reran config tests and final migrations successfully.
- L10: Remaining separate deployment work: no frontend hosting/public URL, no copied data, no hosted global admin/admin login. Production-local Auth.js logged UntrustedHost for the temporary 127.0.0.1:3108 origin; authenticated flows were not verified. Existing seed/auth restrictions preserved. No browser/WebGL inspection.
- L11: Native review assessment requires an explicit inventory for the large pre-existing untracked workspace; canonical review STATUS failed safely. Native review unavailable, not approved. Independent functional verification passed. No work-unit commit was made: pre-existing untracked app/Prisma code and mixed manifest/lock edits prevent committing a coherent isolated setup without including unrelated work. Changes remain local for review; no push occurred.
- L12: Engram mirror and session summary remain unavailable because no authoritative registered runtime session identity exists. Task document is the local recovery source. Risk: items 1 and 5 (schema initialization, environment/dependencies).
