# EduCore — Hostinger Migration Readiness

## Current baseline

- Runtime: Node.js 20.20.2
- Web server: Express 4
- Public proxy: `proxy2.js` on `PORT` (default 8080)
- Internal backend: `server.js` on `BACKEND_PORT` (default 8081)
- Current database: SQLite via `better-sqlite3`
- Container entrypoint: `npm start`

## Phase 0 goals

1. Keep secrets and runtime databases out of Git.
2. Keep Docker builds small and deterministic.
3. Keep public and internal ports explicit.
4. Prepare environment variables for the later PostgreSQL/Supabase migration.
5. Do not migrate production data until the schema and API compatibility work is complete.

## Important findings to resolve before production migration

- `package.json` currently has no committed `package-lock.json`; create and commit one during the local validation pass so the production dependency tree is reproducible.
- The application still creates/uses `school.db` through `better-sqlite3`. Hostinger migration should not switch the database blindly; first add a PostgreSQL-compatible data layer and migration path.
- `proxy2.js` starts a public proxy and a separate backend process. Keep this behavior explicit in the container until the deployment architecture is validated.
- Supabase should be introduced only after the current API contract is mapped to PostgreSQL and tested.

## Hostinger target

Hostinger VPS -> Docker -> EduCore application -> self-hosted Supabase/PostgreSQL (after migration validation).

## Deployment acceptance checks

- `/health` returns HTTP 200.
- `/api/health` returns HTTP 200.
- Login succeeds with a controlled test account.
- Owner school creation succeeds.
- Employee attendance check-in handles duplicate requests safely.
- Owner routes do not return unexpected 404/500 responses.
- No `.env`, database files, secrets, or private keys are committed.
- Database backup and restore are tested before production cutover.
