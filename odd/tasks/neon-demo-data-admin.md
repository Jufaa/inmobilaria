# Hosted fictitious demo data and global administrator
Copy the confirmed fictitious local data to the linked Neon database and enable a dedicated opt-in global demo login.
Branch: feat/google-aerial-zones-demo. Route: inline (one cohesive unit); verification: focused tests, suite, build and production login/authorized-page requests. Risk: items 1, 2, 4, 5. Forecast: approximately 350–450 authored lines; no remote Vercel mutation or publishing authorized.

## Specs
- S1: "ya esta subido a vercer como copio los datos a nen y preparo lo de admin admin". Source is the preserved local environment; destination is the previously authorized linked Neon production branch. Do not overwrite existing destination records or change local data. The user confirmed all data are fictitious with "si".
- S2: "el admin admin puede checkear y ver todo". Enable a dedicated explicit global-demo mode, retain existing single-agency demo restrictions and normal authentication when the new mode is off.
- S3: Verify the copy and production login, report observed results and the exact Vercel variables the user must set. Vercel project/domain/account are not selected; do not access or modify Vercel remotely.

## Tasks
- [x] T1 (S1) inline — Guarded, transactional local-to-Neon copy excluding live OAuth/session/verification credentials; preserve user IDs and destination migration history. Verified Neon production copy: 20 properties, 2 agencies, 3 zones, 1 share grant; commit pending.
- [x] T2 (S2) inline — Dedicated global fictitious demo owner, explicit opt-in, password hash verification and identity validation. Commit: pending.
- [ ] T3 (S3) inline — Tests, actual data copy and production authenticated E2E verification; deployment instructions. Independent verifier required for security/data/concurrency changes. Commit: pending.

## Log
- L1 (2026-10-27): "ya esta subido a vercer como copio los datos a nen y preparo lo de admin admin".
- L2: The user previously authorized the exact Neon org/project/production branch and confirmed all source data fictitious. No Vercel destination/session authorization is available. Keep existing Auth.js and existing seeds unchanged. Source backup .env.local.before-neon; target .env.local direct URL. Never print credentials or row contents.
- L3: Existing admin@localhost has no stored password hash; shortcut is development-only. Existing single-agency demo rejects OWNER. Add a separate dedicated identity rather than silently elevating an imported account. Copy under a repeatable-read source snapshot and a destination transaction with table locks, emptiness checks and count verification. Preserve local data and roll back on failure. Engram mirror unavailable: no authoritative runtime session identity; writes prohibited.

- L4: Implemented copy tool and dedicated opt-in global demo identity. Auth tests observed RED then GREEN; copy guards, rollback, exact-decimal transfer and ordinary demo regressions pass. All101 tests, typecheck, corrected npm run build passed. Independent verifier found one flags-off fallback/session blocker, fixed in one batch and limited recheck passed.
- L5: Actual read-only copy preview failed ECONNREFUSED to source 127.0.0.1:5432. postgresql service is inactive; sudo -n systemctl start postgresql failed because a password is required. No --apply was executed and no data/account was written in Neon. Human action needed: start the existing PostgreSQL service with sudo systemctl start postgresql, then resume preview/copy and production login E2E.
- L6: New docs/hosted-demo.md records the server-side Vercel flags and redeploy requirements. Vercel itself was not inspected/modified.
- L7 (2026-10-27): User confirmed PostgreSQL was ready. Read-only preview passed with 20 properties, 2 agencies, 3 zones, 1 share grant and other listed fictitious records. Applied once to the explicitly linked empty Neon production branch. Read-only verification found the dedicated verified OWNER identity and configured scrypt password hash; credentials/hash were not printed. Hosted login/page E2E remains unverified because Vercel project access was not authorized. Risk: items1/2/4/5.
