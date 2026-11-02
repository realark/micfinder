# AGENTS.md

## Project overview

Mic Finder is a small community calendar for Boise open-mic events. It has three runtime pieces:

- `frontend/`: React 19 + Vite + Tailwind SPA. `src/components/MicFinder.jsx` owns most UI, authentication, API calls, calendar/list views, and client-side RRULE expansion.
- `backend/`: CommonJS Express API backed by PostgreSQL. `server.js` contains the routes and Swagger annotations; `start.js` loads the root `.env` and starts the server.
- `schema.sql`: tables and triggers for JSONB mic records, audit history, validation, and optimistic versioning. `test-data.sql` seeds the local Docker database.

The root `.env` is shared: the backend loads it with `dotenv`, while Vite reads it through `envDir: '..'`. Never put secrets in `VITE_*` variables.

## Local workflow

Use Node 18 or newer and Docker.

```sh
cp .env.local.sample .env

docker compose up                 # PostgreSQL on port 5432
npm --prefix backend run dev      # API on port 3000
npm --prefix frontend run dev     # Vite dev server
```

Run checks relevant to the changed area:

```sh
npm --prefix backend test         # Jest/Supertest; starts PostgreSQL 17 via Testcontainers
npm --prefix frontend run lint
npm --prefix frontend run build
```

Backend tests require a working Docker daemon. There is no frontend test suite; smoke-test changed UI behavior in the browser after lint/build.

## Contracts and change guidance

- Public reads are `GET /health`, `GET /mics`, and `GET /mics/:id`. Login returns a 30-day JWT; mic writes and password changes require `Authorization: Bearer <token>`.
- A mic's supported fields are defined by `validateMicData` in `backend/server.js`. Keep that allowlist, Swagger docs, frontend form/state, and API tests synchronized when changing the record shape.
- PostgreSQL stores each mic as JSONB. Database triggers inject `id`, increment `edit_version`, validate RRULE strings, and write `audit_mic` rows. Preserve these trigger-owned behaviors.
- Updates and deletes use optimistic concurrency. Send the latest `edit_version`; `PUT` and `DELETE` return `409` for stale records. Deletion also depends on the transaction-local `app.user_id` used by the audit trigger.
- Recurrence values are RFC 5545-style strings such as `RRULE:FREQ=WEEKLY;BYDAY=MO`. The frontend expands them locally with `rrule` and parses date-only values at local noon to avoid timezone drift. Preserve date-only semantics.
- Continue sanitizing all accepted mic text on the server, reject unknown fields, and use parameterized SQL. Do not rely on the browser for authorization or validation.
- There is no registration endpoint or moderation workflow; users are provisioned directly in PostgreSQL.
- There is no migration framework. `schema.sql` initializes new databases only. Schema changes must account for existing deployed data and may require recreating the local `postgres_data` volume.
- Deployments run from `master`. Never commit `.env`, credentials, generated `dist/`, or `node_modules/`.
