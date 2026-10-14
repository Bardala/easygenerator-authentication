# AI assistance record

This record is updated as each implementation phase is completed. It describes assistance actually used rather than anticipated results.

## Planning

AI read the provided task PDF and inspected the initial repository. It helped define the architecture, security approach, verification strategy, and phased review process.

The engineer refined that output to require TanStack Query, native React forms, CSS Modules, global CSS variables, feature-owned frontend files, and explicit approval between phases. Backend dependency suggestions were clarified as backend-only. The proposed frontend `validator` dependency was removed. React Hook Form and Zod were also removed from the plan.

The engineer confirmed directory names by responsibility (`apps/frontend` and `apps/backend`) and retained Argon2id after discussion of bcrypt's 72-byte input limitation. A shared package was deferred to avoid unnecessary build coordination in this small application.

## Phase 1 assistance

AI scaffolded workspace manifests, TypeScript and lint configuration, frontend routes/providers/styles, backend modules, environment validation, Winston integration, MongoDB readiness, development Compose configuration, and initial documentation.

Effective instructions included limiting implementation to one reviewable phase, separating backend dependency suggestions from frontend choices, and asking for feature modules to own their components, hooks, and styles. These kept the scaffold small and prevented implementing authentication before its review gate.

Dependency metadata was checked before installation. The current TypeScript release was newer than the supported range of the lint tooling, so a compatible TypeScript 6 release was selected rather than using the newest major blindly.

Docker daemon access was denied in the execution environment even after an elevated check. Readiness verification uses a temporary real MongoDB process when necessary; its tooling is outside the repository and is not an application dependency.

## Phase 1 verification and corrections

- Installation resolved compatible NestJS 12, React 19, Vite 8, TypeScript 6, and ESLint 10 packages without peer errors. npm's installation audit reported zero vulnerabilities at verification time.
- A clean `npm ci` from the lockfile passed. Linting, strict type checks, formatting, and both production builds passed.
- Runtime startup uncovered an ESM/CJS interoperability error: Mongoose's `Connection` was imported as a runtime named export. It was corrected to a type-only import because Nest's explicit connection injection token provides the dependency.
- Inspection showed that Nest/Mongoose skips `onConnectionCreate` in lazy-connection mode. Logging listeners were moved to `connectionFactory`, which runs in that mode. This preserves a working readiness endpoint when MongoDB is unavailable.
- A temporary MongoDB 8 process verified `200` readiness directly and through Vite's proxy. Stopping MongoDB verified `503`, a sanitized response, and `Cache-Control: no-store`. A fresh backend startup with MongoDB absent also remained available and returned `503`.
- Configuration checks verified production HTTPS enforcement, safe production defaults, loopback-only local origins, rejection of origin paths, invalid ports, and placeholder secrets.
- Compose configuration validation passed. Docker container startup remains unverified because the daemon is inaccessible; administrator access requires a password.
- Frontend HTTP route serving was verified. No browser is connected to the session, so visual/browser interaction checks were not claimed.

No Phase 2 authentication behavior or Phase 3 forms have been implemented. The engineer's review and approval are required before advancing.

## Phase 1 review refinements

The engineer requested cleaner backend infrastructure, a common module, global error handling, explicit response contracts, and `Req`/`Res` names for application types in both workspaces. AI reviewed the existing code and explained that sanitized errors had originally been scheduled for Phase 2. The engineer authorized implementing this foundation before authentication.

AI added the common module, a global `APP_FILTER`, an HTTP error adapter, intentionally public application errors, and common error contracts. MongoDB readiness moved into a database-owned adapter. `HealthService` now delegates the check and returns `HealthRes` without constructing HTTP errors or catching driver failures. A focused try/catch remains at the driver boundary because translating dependency failures to `503` is meaningful error handling.

Success payloads and the existing health failure's `checks` field were preserved. Application contracts now use `Res` naming, including backend/frontend `HealthRes` and `ApiErrorRes`. No artificial request DTO was added for the bodyless health GET. The frontend HTTP client retains the server's error code and message in a typed error payload.

Inspection of Nest's installed Express adapter confirmed that its existing error layer routes middleware failures through global exception filters. An extra middleware bridge was therefore unnecessary. Common decorators, guards, interceptors, middleware, and pipes will be added when features need them, rather than generating unused scaffolding.

### Verification and rework

- Nine Jest regression tests passed through the real Nest/Express pipeline and database boundary, covering unchanged health success/failure payloads, unexpected errors, HTTP exceptions, middleware failures, malformed JSON, missing routes, disconnected databases, and driver ping failures.
- Jest's VM ESM loader could not load the CommonJS Winston adapter that requires Nest's ESM packages. Tests isolate that logging transport with an injectable double; the real HTTP pipeline, global filter, and error adapter remain under test. Native application startup separately verifies the actual Winston integration.
- Introducing Jest exposed advisories in its legacy coverage YAML dependency chain. A `js-yaml` override upgraded the parser, and the lockfile was resolved from clean manifests/dependencies after the existing resolution retained the older parser. The coverage loader's YAML API compatibility check passed. Installation then reported zero vulnerabilities.
- The override intentionally exceeds the coverage loader's declared YAML 3 range. `npm ls` reports that range mismatch; runtime compatibility is checked rather than assuming a major upgrade is safe.
- Linting, strict type checks, formatting, both production builds, and a clean online `npm ci` passed after the refactor. Offline installation lacked cached metadata, so clean-install verification was completed online.
- Native application checks verified the health `200` response, the sanitized global `404`, and the original health `503` payload with real MongoDB stopped. MongoDB was restored for the review preview.

The review refinements stay within Phase 1. Authentication implementation still requires approval to start Phase 2.
