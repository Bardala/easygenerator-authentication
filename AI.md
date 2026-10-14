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
