# Authentication application

A phased implementation of a React/TypeScript frontend and a NestJS/MongoDB backend.

## Current status

Phase 1 provides workspace tooling, feature modules, routing, CSS foundations, validated backend configuration, structured logging, and database readiness.

Phase 1 review refinements add a backend common module, global error formatting, a database readiness adapter, explicit `Req`/`Res` contract naming, and regression tests. Success payloads retain their existing shape.

Phase 2 implements the backend authentication API, MongoDB sessions, password hashing, validation, CSRF protection, throttling, and local Swagger documentation. Frontend authentication forms and protected routing remain scheduled for Phase 3 after review.

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
- Local Swagger: <http://127.0.0.1:3000/api/docs>

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
| `npm run test:backend`                         | Build and run backend unit/HTTP/MongoDB integration tests |
| `npm run format`                               | Apply formatting                                          |
| `npm run start:backend`                        | Run the compiled backend                                  |
| `npm run preview:frontend`                     | Preview the frontend build at port 4173                   |
| `npm run db:up` / `npm run db:down`            | Start/stop development MongoDB                            |

The Vite proxy targets backend port 3000. Update its configuration if changing `PORT`. Frontend preview is for local build inspection, not production hosting. Production containers and CI arrive in Phase 4.

## Environment

The backend reads the repository-root `.env` regardless of its launch directory. Process environment variables take precedence. Invalid configuration prevents startup; diagnostics name invalid settings without printing their values.

| Variable           | Meaning                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| `APP_ENV`          | `local`, `test`, or `production`; defaults to production when `NODE_ENV=production`, otherwise local |
| `PORT`             | Backend port, defaults to 3000                                                                       |
| `APP_ORIGIN`       | Exact browser origin; local/test require a loopback host and production requires HTTPS               |
| `MONGODB_URI`      | MongoDB connection string                                                                            |
| `LOG_LEVEL`        | `error`, `warn`, `info`, or `debug`; defaults to info                                                |
| `SESSION_SECRET`   | Generated secret of at least 32 characters for signed session cookies                                |
| `TRUST_PROXY_HOPS` | `0` by default for direct access; `1` only behind a trusted single reverse proxy                     |

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
      guards/                  # Session authentication, CSRF, empty-body checks
      middleware/              # Request IDs and safe completion logging
      pipes/                   # DTO validation
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

The error-boundary tests exercise the real Nest/Express HTTP pipeline with isolated database and logging doubles. Authentication integration tests run the full application in native Node child processes against a real MongoDB server, including the actual Winston adapter, throttler, and session store. This avoids CommonJS/ESM limitations in Jest's VM loader. The test command enables experimental VM-module support for the test runner; the application processes use ordinary Node execution.

A scoped `js-yaml` override removes a vulnerable legacy dependency from Jest's coverage configuration loader. It upgrades that loader's declared YAML 3 dependency to YAML 4 without changing Swagger's YAML dependency. Clean installation and tests verify compatibility.

## Backend verification

Start MongoDB on `127.0.0.1:27017`, then run `npm run test:backend`. Integration tests create a randomly named `easygenerator_auth_test_*` database and delete only that database afterward; they never use the developer database from `.env`. The MongoDB test user needs permission to create indexes and drop this temporary database.

Coverage includes normalized/concurrent duplicate registration, validation boundaries, password preservation and dummy verification, session/token rotation, persistence across API restart, idle/absolute/store expiry, logout and requests finishing around logout, CSRF/origin rejection, cookie attributes, rate limits, parser limits, dependency failures, and response/log privacy. Production cookie tests simulate HTTPS termination through a trusted proxy; they do not test a real TLS deployment.

## Authentication API

All paths below include the `/api` prefix. Authentication responses use `Cache-Control: no-store`. Public users contain only `{ id, email, name }`.

| Method and path           | Request                     | Success                                           |
| ------------------------- | --------------------------- | ------------------------------------------------- |
| `GET /api/auth/csrf`      | None                        | `200 { csrfToken }`, initializes a session        |
| `POST /api/auth/sign-up`  | `{ email, name, password }` | `201 { user, csrfToken }`, automatically signs in |
| `POST /api/auth/sign-in`  | `{ email, password }`       | `200 { user, csrfToken }`                         |
| `GET /api/auth/me`        | Session cookie              | `200 { user }`                                    |
| `POST /api/auth/sign-out` | No body or `{}`             | `204`, destroys the session and clears its cookie |

For every POST, send the session cookie and `X-CSRF-Token` from `GET /api/auth/csrf`. Send JSON for request bodies. Replace the token with the one returned by successful signup/sign-in: authentication regenerates the session and rotates its token. A supplied `Origin` must exactly match `APP_ORIGIN`; CORS is unnecessary with the same-origin Vite/Nginx proxy.

Email is trimmed, lowercased, validated, and limited to 254 characters. Names are trimmed and must contain 3–100 characters. Signup passwords contain 8–128 characters, a Unicode letter, an ASCII digit, and a punctuation or symbol character. Passwords are preserved exactly. Sign-in accepts a valid email and a nonempty password of at most 128 characters without applying signup complexity rules. Unexpected body properties are rejected.

Errors use `{ code, message, fieldErrors? }`: `400` validation, `401` invalid credentials or session, `403` invalid CSRF/origin, `409` account conflict, `413` excessive body size, `415` unsupported body content type, `429` rate limit, and `503` unavailable storage. Wrong passwords and unknown accounts both return `INVALID_CREDENTIALS`. Expired authenticated sessions return `SESSION_EXPIRED`; a cookie absent from/expired in the store returns `UNAUTHORIZED`. After expiry, request a fresh CSRF token before signing in again.

## Backend security and production settings

- Passwords are asynchronously hashed with Argon2id (19 MiB memory, two iterations, parallelism one). Hashes are excluded from default model queries and all public responses. A unique email index is awaited before user operations; MongoDB handles simultaneous duplicate registration.
- Sessions share Mongoose's MongoDB client. Idle lifetime is 30 minutes and absolute lifetime is 24 hours; the server checks both independently of cookie and TTL cleanup. Activity updates existing records without upsert, so read requests finishing around logout cannot recreate authentication. Authentication sessions are saved before responding.
- Cookies are host-only, HttpOnly, SameSite=Lax, and use `Path=/`. Explicit local/test mode uses `eg.sid` over localhost HTTP. Production uses `__Host-eg.sid` and requires Secure cookies and HTTPS.
- Helmet applies security headers; local Swagger alone relaxes CSP for its inline scripts. Swagger is disabled in production. JSON bodies are limited to 16 KiB.
- Routed API requests share a 100-request-per-minute budget per IP. Signup/sign-in share an additional ten-attempt budget, including invalid validation/CSRF attempts. The Nest limiter is process-local: horizontal scaling requires a shared limiter store, and restarting the API resets counters.
- Request logs contain generated request IDs, method, status, and duration. Bodies, URLs, credentials, cookies, tokens, raw exception messages, and connection strings are excluded.

For production, set `APP_ENV=production`, an HTTPS `APP_ORIGIN`, a private MongoDB URI, and a generated `SESSION_SECRET`. Behind the planned single reverse proxy, set `TRUST_PROXY_HOPS=1`, keep the API inaccessible to public clients, and ensure the proxy overwrites forwarded IP/protocol headers. Direct local access should retain `0`; blindly trusting forwarded headers allows IP spoofing. All instances must share the session secret and MongoDB store. Production container networking, Nginx forwarding, TLS/proxy instructions, and CI remain Phase 4 work.

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
