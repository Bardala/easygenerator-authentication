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

## Phase 2 assistance

After the engineer approved backend authentication, AI implemented user persistence and DTOs, focused authentication/password/session/CSRF services, a MongoDB session adapter, reusable common guards and validation pipes, request logging, security headers, shared rate-limit budgets, and local Swagger. Application contracts continue using `Req`/`Res`; Express framework types retain their own names. Frontend forms were kept outside this phase.

Effective instructions were “continue phase2,” the existing requirement to stop at each review gate, and the request for cleaner modules and common infrastructure. These kept controllers focused on HTTP, user operations within the users service, storage failure translation at adapters, and session orchestration separate from persistence. README and this record were updated with actual behavior and verification.

The implementation uses only required backend dependencies from the agreed stack. Argon2id, sessions, CSRF, Nest validation/throttling, and Swagger replace unrelated suggested packages; SQL drivers, JWTs, scheduling, realtime, process managers, and frontend validation libraries were unnecessary.

### Engineering decisions and corrections

- Session-bound CSRF applies to signup, sign-in, and logout. Authentication regenerates sessions and tokens and explicitly saves them before returning. CSRF enforcement uses a common guard after the global rate-limit guard, so invalid CSRF attempts also consume the authentication budget.
- Both signup and sign-in share the same per-IP authentication key. The general budget also shares keys across routed API endpoints rather than applying a separate allowance to each controller method. Proxy trust defaults to zero and permits only an explicitly configured single trusted proxy.
- Session idle and absolute timestamps are checked server-side independently of MongoDB TTL removal. The store shares Mongoose's existing MongoDB client, and the adapter initializes the session TTL index. The users service awaits the unique email index before user operations.
- Inspection of Express session and connect-mongo exposed a logout race: modifying session data during read requests triggers an upsert when a late request finishes, potentially recreating a destroyed session. Activity now uses an atomic update of an existing MongoDB session without upsert, while request session data remains unchanged. Existing CSRF tokens are returned without another full save. A controlled delayed-request test verifies that logout remains effective.
- Unknown accounts still perform Argon2 verification using a dummy hash initialized at startup. Failed sign-in responses remain identical. Signup password strings are never trimmed or normalized.
- An initial test assumed a fixed order for encoded Argon2 parameters. It was corrected to check algorithm, version, and parameter values independently of their serialized order.
- Nest's `Header` decorator is method-only, so authentication cache headers are set by the shared session middleware. Helmet options were narrowed to comply with strict optional-property typing. CSP is retained for API responses and relaxed only for local Swagger.
- Logout accepts no body or an empty JSON object and rejects properties. Content-type enforcement checks whether a body exists, allowing bodyless logout without requiring an artificial request DTO.
- The YAML security override was scoped to Jest's legacy coverage loader so Swagger can retain its declared YAML version.
- Full application integration tests launch native Node processes because Jest's VM ESM loader cannot reliably load CommonJS adapters requiring Nest ESM. Actual Winston logging, MongoDB, cookies, CSRF, throttling, DTO transformation, and HTTP error handling remain exercised together. The test harness pauses one user lookup to reproduce the logout race without adding test routes to production.

Implementation references checked included [Express session configuration](https://expressjs.com/en/resources/middleware/session/) and [Nest rate limiting](https://docs.nestjs.com/security/rate-limiting), together with installed connect-mongo and csrf-sync source/types.

### Phase 2 verification and review

- A clean lockfile installation passed and npm reported zero known vulnerabilities. The first `npm ci` encountered an `ENOTEMPTY` filesystem cleanup error; affected dependency folders were preserved under the ignored `.npm-cache/phase2-install-backup` directory before retrying from empty dependency directories.
- Root linting, strict type checks, formatting checks, and both production builds passed after clean installation.
- All 30 backend tests passed across three suites. Integration tests used a real MongoDB 8 server with a randomly named, isolated test database and cleaned it afterward. They did not use the developer's `.env` database.
- Verification covered complete signup/sign-in/protected access/logout, validation boundaries and unexpected properties, normalized/concurrent uniqueness, encoded Argon2 parameters, unchanged passwords, dummy verification, session and CSRF rotation, API restart persistence, idle/absolute/store expiry, bounded renewal, account deletion, and logout with a delayed read request.
- Security checks covered session-bound tokens and allowed origins, combined signup/sign-in throttling, a general cross-endpoint budget, malformed/oversized JSON, unsupported body content types, sanitized dependency failures, cookie attributes, local Swagger, production Swagger exclusion, and log/response privacy.
- Production tests simulated a trusted HTTPS reverse proxy and exercised signup, protected access, and logout with Secure `__Host-` cookies. Direct HTTP did not receive a production session cookie. Actual TLS/container/browser verification remains Phase 4 work.
- The process-local limiter targets the agreed single API instance. README documents the shared-store requirement for horizontal scaling and safe proxy trust configuration.

Phase 2 is ready for the engineer's API and security review. Phase 3 has not started and requires explicit approval. No repository commit or publication was performed.

## Phase 3 assistance

The engineer approved starting Phase 3. AI implemented the frontend signup, sign-in, protected welcome, and logout flows, retaining native React forms, TanStack Query, CSS Modules, global variables, and feature-owned files. No React Hook Form, Zod, frontend validator, shared workspace, or extra state container was introduced.

### Decisions and corrections

- Native inputs remain uncontrolled and values are read through FormData. A feature hook owns submission, blur validation, errors, and focus behavior. Password feedback and visibility use local state within the password component, keeping typing updates out of the parent form.
- Current-user data remains in `['auth', 'me']` with the agreed freshness and revalidation settings. Route boundaries wait for restoration and show connection retry separately from anonymous sessions. Common layout receives navigation by composition instead of importing authentication behavior.
- Successful authentication replaces user/token caches directly. Private queries use explicit metadata and consume abort signals; session transitions cancel outstanding private queries and remove cached private data. Logout changes authentication only after server confirmation. Failed logout remains recoverable.
- Mutation retries are disabled. CSRF/session-expiry failures refresh security tokens and require an explicit submission retry. Mutation variables are reset and use zero garbage-collection time to avoid retaining submitted passwords after completion. Authentication cache stays in memory.
- Tests exposed an accessibility timing issue: server-error focus attempted to target an input while the pending fieldset was still disabled. Focus now waits until the next animation frame after the form is enabled.
- Native maxlength counts UTF-16 units while backend name/password validators count Unicode characters. Input caps allow two units per permitted character, and explicit validation enforces the actual limits. A maximum-length Unicode password is exercised against the real backend.
- Obsolete foundation and placeholder pages/readiness UI were removed when the real application routes replaced them. Backend readiness remains available through its documented endpoint.
- Added Vitest, Testing Library, user-event, jest-dom, and jsdom as frontend development dependencies. Test TypeScript files are included in strict type checking. Full browser automation remains in Phase 4.
- A real API integration test reuses the backend's native-process fixture, with guarded cleanup of a randomly named test database. Vitest's DOM-transformed import URLs required resolving that fixture from the workspace directory rather than passing a browser URL to Node's process launcher.

Implementation references checked included [TanStack Query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation), [QueryClient cache operations](https://tanstack.com/query/latest/docs/framework/react/reference/QueryClient), and [native maxlength semantics](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/maxlength).

### Phase 3 verification and review

- Frontend development dependency installation updated the lockfile and reported zero known vulnerabilities.
- Root linting, strict type checks (including frontend tests), formatting, and both production builds passed.
- All 13 component tests passed. They cover blur/submission validation, accessible descriptions and focus, password guidance/visibility, unchanged password submission, pending states and duplicate-submit prevention, anonymous/expired/restored sessions, connection retry, invalid credentials, server field errors, CSRF acquisition/rotation/recovery, recoverable logout, and cancellation of late private responses.
- The real frontend/API integration test passed against an isolated real MongoDB database: signup, welcome, restoration with an empty client cache after remounting, logout, and sign-in. It exercised a 128-character Unicode password to check frontend/backend validation compatibility. The test database was cleaned afterward.
- All 30 backend regression tests also passed after extending the shared test fixture with guarded database cleanup for the frontend integration test.
- Browser surface discovery returned no available browsers. DOM interaction and compiled styles were verified, but visual review, real browser refresh/cookie behavior, and Playwright checks are not claimed; these remain Phase 4 verification.

Phase 3 is ready for review of styling, module boundaries, forms, and session behavior. Phase 4 has not started and requires explicit approval. No commit or publication was performed.

## Discussion before Phase 4

The engineer asked AI to explain Phase 4's importance and identify work that could be omitted while meeting the assignment, without editing code. AI reread both pages of the task PDF and reviewed the current documentation, development Compose service, application startup, and test commands. This section records findings and recommendations; it does not approve a reduced scope or change the agreed implementation plan.

### Assignment requirements and existing coverage

The brief requires React or Vue with TypeScript, signup/sign-in forms and matching validation, the welcome page, NestJS with MongoDB, at least one protected endpoint, README, AI.md, and public GitHub submission. Logout is optional in the brief and has already been implemented. The brief also expects production readiness and evaluates security, maintainability, code quality, and delivery speed. Logging, error handling, testing, basic CI/CD, and API documentation are bonus items. Docker, Nginx, Playwright specifically, and hosted deployment are not prescribed requirements.

The current implementation covers the requested application features and includes logging, sanitized errors, API documentation, 30 backend tests, 13 frontend component tests, and a real frontend/API integration test. These are recorded results from earlier phases, not checks rerun during this discussion. Final submission review and public GitHub publication are still pending.

The remaining verification gap is real browser behavior. The frontend integration test uses jsdom, a cookie bridge, and remounting; it does not establish actual browser cookie handling, full-page reload behavior, responsive appearance, or delivery-server routing. Production cookie checks simulate HTTPS proxy headers rather than verifying a deployed TLS setup.

### Value of the original Phase 4

| Area                         | What it contributes                                                                                      | Recommendation for a smaller submission                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Browser verification         | Exercises actual cookies, redirects, reloads, protected navigation, and rendered UI                      | Keep a small Chromium suite and a brief desktop/mobile-width visual review                                  |
| Basic CI                     | Verifies installation, checks, tests, and builds on a clean runner; exposes machine-specific assumptions | Keep one GitHub Actions job with Node 24 and a MongoDB test service                                         |
| Production containers        | Packages applications and MongoDB into a reproducible runtime for reviewer convenience                   | Defer unless container delivery is specifically desired                                                     |
| Nginx and production routing | Serves built frontend assets, supports SPA deep links, and forwards same-origin API calls                | Nginx itself is optional; document an appropriate production server/proxy path if containers are deferred   |
| Container smoke tests        | Verifies container networking, readiness, persistence, and runtime permissions                           | Needed if production containers are delivered; unnecessary if those containers are omitted                  |
| Larger browser/CI matrices   | Broadens platform and failure coverage                                                                   | Skip multi-browser/OS/Node matrices, sharding, visual snapshot baselines, and duplicated edge-case coverage |

Container delivery adds runtime concerns beyond Dockerfiles: backend network binding, internal service addresses, proxy trust, cookie settings, image permissions, and persistent storage all need verification. Containers are useful packaging but do not establish production readiness by themselves. If containers are retained, their non-root execution, network isolation, and smoke verification should remain part of that work.

### Recommended reduced scope, pending the engineer's decision

1. Add a few focused Chromium checks for signup, welcome, real reload, logout, sign-in, and anonymous direct navigation to `/app`. Add one representative expiry or connection-failure recovery check. Keep detailed validation, throttling, outages, and logout-race combinations in their existing backend/component tests instead of reproducing every case in a browser.
2. Add one CI workflow running clean installation, existing checks/tests, production builds, and the small browser suite. No automatic deployment, image publishing, platform matrix, or separate workflow per check is needed.
3. Retain the existing development MongoDB Compose service and document production serving, SPA fallback, `/api` forwarding, HTTPS, secure cookies, proxy trust, secrets, and private database access. Defer production application containers and their smoke tests unless the engineer chooses them.

For the tightest time budget, a recorded manual browser review could replace Playwright, and CI could also be omitted because the brief treats it as a bonus. AI recommends retaining the small automated suite and basic CI because they address the main remaining confidence gap with limited project complexity.

Skipping packaging does not justify removing authentication protections or claiming an unverified deployment is production-tested. Vite preview is a local build-preview tool, not a production hosting solution. Public repository publication and final documentation review remain necessary submission work in Phase 5.

This recommendation balances the brief's emphasis on efficient execution with useful verification. No new application features or architecture changes are needed. Only this discussion record was edited; Phase 4 implementation has not started, and the original plan remains unchanged pending the engineer's decision.

References checked: the local Full_Stack_Test_Task.pdf, [Playwright CI guidance](https://playwright.dev/docs/ci), and [Vite static deployment guidance](https://vite.dev/guide/static-deploy.html).

## Phase 4 implementation

The engineer chose the original Phase 4 after discussing a smaller alternative. AI retained the full agreed scope: browser verification, production containers, Nginx/Compose delivery, HTTP/HTTPS configuration, container smoke coverage, and GitHub Actions. The earlier simplification recommendation was not adopted.

### Assistance and engineering decisions

- Added Playwright with a single Chromium project and six browser scenarios. Tests use the built frontend, owned backend/preview processes, a generated secret, and a randomly named real MongoDB test database. Server expiry and delayed lookups use fixture IPC rather than adding production debug endpoints. Test traces/screenshots are ignored by Git and formatting/lint tools.
- Added validated `HOST` configuration: direct execution stays on loopback and containers explicitly listen on all container interfaces. Added a tooling-only preview proxy target for the separately owned browser backend. Browser test files participate in root strict type checking.
- Added multi-stage Node/backend and Node/Nginx/frontend Dockerfiles with non-root runtime users. Docker build context excludes secrets, TLS key/certificate bundles, dependencies, generated outputs, PDFs, repository metadata, and local tools. TLS material is also ignored by Git. Dependencies are selected by workspace, and backend nested workspace dependencies are retained in the runtime copy.
- Compose publishes only Nginx. API and MongoDB are private; MongoDB has an isolated database network and a least-privilege application account distinct from its bootstrap administrator. Persistent container data uses a separate volume/project from the unauthenticated development MongoDB service so initialization cannot accidentally reuse its data.
- Local HTTP and production HTTPS use explicit Compose overrides. Production Nginx terminates TLS and overwrites forwarded headers before the API's single trusted proxy hop. Certificate/key mounts are read-only. Production cookies keep the `__Host-`/Secure policy. Local Swagger retains its required inline-script behavior by using backend Helmet headers on proxied API responses instead of the static frontend CSP.
- Nginx serves SPA deep links and fingerprinted assets, applies frontend security headers, and provides sanitized JSON errors for oversized bodies and an unavailable upstream. Request access logs are disabled. API diagnostic logging remains sanitized in Winston.
- The container smoke command generates its own secrets/certificate, checks networking and non-root identities, restarts database/API to verify persistence, then tests actual HTTPS browser authentication. Cleanup is restricted to its randomly named project/volume. No real repository secrets are printed or injected into tests.
- Added one read-only-permission GitHub Actions workflow for clean installation, checks, builds, existing tests, Chromium, and the full container smoke command. It uses Node 24 and a MongoDB service, with no deployment or image publication.

### Verification work and corrections

- Chromium was downloaded and executed successfully. All six browser scenarios passed, including real refresh/cookies, protected navigation, server expiry, failure recovery, late logout responses, and mobile focus/overflow checks. Desktop and mobile screenshots were inspected visually.
- An initial browser run hit a slow request and the temporary MongoDB process later stopped. The database was restored. Signup setup now waits for the ready form and captures the screenshot without redundant navigation; the browser suite uses explicit assertion timeouts rather than automatic retries.
- Compose HTTP/HTTPS configurations passed static validation using the available legacy Compose tool. Workflow YAML parsed successfully. These checks do not establish container or GitHub runtime success.
- Docker daemon access was denied even with elevated execution, and the installed Docker CLI lacks Compose v2. The container smoke command was attempted and correctly failed its tooling prerequisite. No Docker image build or full container smoke pass is claimed.
- To verify proxy/TLS behavior independently, an Ubuntu Nginx package was downloaded and extracted under /tmp without installing a system service. Adapted temporary paths/ports permit checking the repository's Nginx directives with native processes; this is separate from verifying the Alpine image or Docker networking.

References checked included [Playwright CI](https://playwright.dev/docs/ci), the [official Nginx image](https://hub.docker.com/_/nginx), [Compose networking](https://docs.docker.com/compose/how-tos/networking/), and the [official MongoDB entrypoint](https://github.com/docker-library/mongo/blob/master/8.0/docker-entrypoint.sh).

### Final local verification and review status

- A clean `npm ci` in a temporary copy passed and reported zero known vulnerabilities. Strict lint/type/format checks and both production builds passed in that copy; private environment files and working dependency folders were not copied or modified.
- The final regression run passed 32 backend tests (including container binding/HTTPS validation), 13 frontend component tests, and the real frontend/API integration test. The six Chromium tests also passed, for 52 automated tests across these suites.
- Native Nginx syntax and actual HTTPS browser checks passed against compiled frontend assets and the real API/MongoDB. Checks included SPA deep links/reload, CSP-compatible assets, Secure/HttpOnly/SameSite host-only production cookies, signup/logout, readiness/HSTS, production Swagger exclusion, and JSON body-limit errors. Only temporary filesystem paths, certificate paths, MIME definitions, and upstream/listen addresses were adapted; this does not validate the Alpine image or container networking.
- That independent check found that opening `/dev/stderr` through Node's socket-backed child-process stream fails. The configuration now uses Nginx's supported `stderr` destination directly. MongoDB's health probe now authenticates as the application user so readiness does not precede account initialization.
- HTTP and HTTPS Compose merges passed static validation. Workflow YAML structure validated locally. Actual GitHub Actions execution remains pending a push by the engineer.
- Full Docker image builds and `npm run test:containers` remain unverified because Docker daemon access is denied and Compose v2 is unavailable. The smoke command failed the tooling prerequisite before starting any containers. Run it on a Docker-capable machine or the prepared GitHub runner before marking runtime verification complete.

The original Phase 4 implementation is ready for code/configuration review, with container verification outstanding. Phase 5 and public publication have not started. No commit or push was performed.
