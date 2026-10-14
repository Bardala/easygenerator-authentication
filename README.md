# Authentication application

A phased implementation of a React/TypeScript frontend and a NestJS/MongoDB backend.

## Current status

Phase 1 provides workspace tooling, feature modules, routing, CSS foundations, validated backend configuration, structured logging, and database readiness. Authentication modules and routes are explicitly scaffolded; authentication endpoints, forms, and route protection are delivered in later phases after review.

## Prerequisites

- Node.js 24 and npm 11.
- Docker Engine with permission to use its daemon, and Docker Compose v2; alternatively, a local MongoDB 8 server.

## Local setup

Run all commands from the repository root:

```bash
nvm use
npm ci
cp .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Paste the generated value into `SESSION_SECRET` in `.env`. Keep that file private. The example's placeholder is deliberately rejected.

```bash
npm run db:up
npm run dev
```

- Frontend: <http://127.0.0.1:5173>
- Backend readiness: <http://127.0.0.1:3000/api/health>

Vite forwards `/api` requests to the backend. The Phase 1 setup page displays the real readiness result. MongoDB data lives in a named Docker volume; `npm run db:down` stops the service without removing that data.

If Docker is unavailable, start a local MongoDB server and set `MONGODB_URI` accordingly. The API remains available to report `503` while MongoDB is unavailable. If the initial connection fails, start MongoDB and restart the backend; disconnections after a successful initial connection use the driver's reconnect behavior.

## Commands

| Command                                        | Purpose                                    |
| ---------------------------------------------- | ------------------------------------------ |
| `npm run dev`                                  | Start both applications with file watching |
| `npm run dev:backend` / `npm run dev:frontend` | Start one application                      |
| `npm run check`                                | Lint, type-check, and check formatting     |
| `npm run build`                                | Build both applications                    |
| `npm run verify`                               | Run checks and production builds           |
| `npm run format`                               | Apply formatting                           |
| `npm run start:backend`                        | Run the compiled backend                   |
| `npm run preview:frontend`                     | Preview the frontend build at port 4173    |
| `npm run db:up` / `npm run db:down`            | Start/stop development MongoDB             |

The Vite proxy targets backend port 3000. Update its configuration if changing `PORT`. Frontend preview is for local build inspection, not production hosting. Production containers and CI arrive in Phase 4.

## Environment

The backend reads the repository-root `.env` regardless of its launch directory. Process environment variables take precedence. Invalid configuration prevents startup; diagnostics name invalid settings without printing their values.

| Variable         | Meaning                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `APP_ENV`        | `local`, `test`, or `production`; defaults to production when `NODE_ENV=production`, otherwise local |
| `PORT`           | Backend port, defaults to 3000                                                                       |
| `APP_ORIGIN`     | Exact browser origin; local/test require a loopback host and production requires HTTPS               |
| `MONGODB_URI`    | MongoDB connection string                                                                            |
| `LOG_LEVEL`      | `error`, `warn`, `info`, or `debug`; defaults to info                                                |
| `SESSION_SECRET` | Generated secret of at least 32 characters, reserved for Phase 2 sessions                            |

Both development applications bind to loopback. The Compose database is exposed only on `127.0.0.1`. This unauthenticated database service is for local development only.

## Structure and boundaries

```text
apps/
  frontend/src/
    app/                       # Routing and providers
    components/                # Common UI
    lib/                       # HTTP utilities
    styles/                    # Global variables and base styles
    modules/
      authentication/          # Own components, pages, types, styles
      application/             # Own API functions, hooks, components, pages, types, styles
  backend/src/
    modules/
      configuration/
      logging/
      database/
      health/
      users/
      authentication/
```

Modules gain hooks, validation functions, and API functions when their behavior is implemented; empty abstractions are not added in advance. CSS Modules consume global CSS variables. TanStack Query owns server data; form state will remain local and use native inputs. No frontend form or validation libraries are installed.

There is no shared package in this scope. Backend framework/database types stay in the backend, and frontend API types remain in their feature module.

## Readiness contract

`GET /api/health` sends `Cache-Control: no-store` and pings MongoDB:

- `200`: `{ "status": "ok", "checks": { "mongodb": "up" } }`.
- `503`: `{ "code": "DEPENDENCY_UNAVAILABLE", "message": "Database is unavailable.", "checks": { "mongodb": "down" } }`.

Credentials and connection details are excluded from the response. Database connection logs use fixed messages rather than raw driver errors.

## Review sequence

1. Foundation and development setup.
2. Secure backend authentication and integration tests.
3. Native frontend authentication forms and component tests.
4. Browser verification, production containers, and CI.
5. Documentation and submission readiness.

Each phase stops for review and explicit approval before the next begins. Public GitHub publication follows approval of the completed submission.
