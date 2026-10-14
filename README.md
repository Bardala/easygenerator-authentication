# Authentication application

A phased implementation of a React/TypeScript frontend and a NestJS/MongoDB backend.

## Current status

Phase 1 provides workspace tooling, feature modules, routing, CSS foundations, validated backend configuration, structured logging, and database readiness. Authentication modules and routes are explicitly scaffolded; authentication endpoints, forms, and route protection are delivered in later phases after review.

Phase 1 review refinements add a backend common module, global error formatting, a database readiness adapter, explicit `Req`/`Res` contract naming, and regression tests. Success payloads retain their existing shape.

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

| Command                                        | Purpose                                                   |
| ---------------------------------------------- | --------------------------------------------------------- |
| `npm run dev`                                  | Start both applications with file watching                |
| `npm run dev:backend` / `npm run dev:frontend` | Start one application                                     |
| `npm run check`                                | Lint, type-check, and check formatting                    |
| `npm run build`                                | Build both applications                                   |
| `npm run verify`                               | Run checks and production builds                          |
| `npm run test:backend`                         | Build the backend and run error-boundary regression tests |
| `npm run format`                               | Apply formatting                                          |
| `npm run start:backend`                        | Run the compiled backend                                  |
| `npm run preview:frontend`                     | Preview the frontend build at port 4173                   |
| `npm run db:up` / `npm run db:down`            | Start/stop development MongoDB                            |

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
    common/
      adapters/                # Normalize HTTP errors
      errors/                  # Explicitly public application errors
      filters/                 # Global HTTP exception boundary
      types/                   # Common API contracts
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

Application DTOs and API types use `Req` and `Res` suffixes, such as `HealthRes`. Framework-provided types retain their library names. A bodyless GET has no artificial request DTO. Add common guards, decorators, interceptors, middleware, and pipes when a feature needs them.

## Error handling

The common module registers a dependency-injected `APP_FILTER`. It covers controller errors, routing errors, and Express middleware failures through Nest's existing exception layer. Responses use `{ code, message, fieldErrors? }`; the health dependency error also retains its existing `checks` field.

`ApplicationError` marks a payload as intentionally public. Ordinary exceptions receive safe messages selected by status; their raw messages, causes, and stack traces are excluded from responses and error logs. Unknown errors return `500` with `INTERNAL_ERROR`. Error responses are not cacheable. Startup configuration errors remain handled separately before the HTTP application exists.

MongoDB-specific translation belongs in `MongoReadinessAdapter`. It retains a failed driver's cause internally and throws a public dependency error. `HealthService` delegates the check and returns a typed success payload without HTTP error construction or a try/catch block.

The Jest suite exercises the real Nest/Express HTTP pipeline with isolated database and logging doubles, including malformed JSON, middleware failures, sanitized controller failures, and health contracts. It does not require a running database. The test command enables Jest's experimental VM-module support for ESM; production execution does not use that flag.

A root `js-yaml` override removes a vulnerable legacy dependency from Jest's coverage configuration loader. The loader's YAML API compatibility is checked during verification. The override upgrades its declared YAML 3 dependency to YAML 4; `npm ls` reports the upstream range mismatch, while clean installation, compatibility checks, and tests pass.

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
