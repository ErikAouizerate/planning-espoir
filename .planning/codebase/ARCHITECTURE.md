# Architecture

**Analysis Date:** 2026-08-24

## System Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│                        webapp/ (React 19 + Vite SPA)              │
│  components/  ──►  store/ (reducers + apiMiddleware)              │
│  ──► api/client.ts (fetch + bearer token)   auth/keycloak.ts      │
└───────────────────────────┬──────────────────────────────────────┘
                            │ HTTP /api/*  (Vite dev proxy :5174→:3000)
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                          api/ (NestJS, port 3000)                 │
│  AuthGuard (global) ─► planning.controller ─► planning.service    │
│  ──► parser.ts (exceljs)  │  date-rotation.ts                     │
└───────────────────────────┬──────────────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│               Storage: flat files under DATA_DIR (api/data/)      │
│   planning.xlsx (raw) │ planning.json (normalized) │ config.json  │
└──────────────────────────────────────────────────────────────────┘
```

Browser never parses Excel. The API parses once per upload and serves the
normalized model; GET endpoints are cheap reads of the stored JSON.

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| AppModule | Root NestJS module: global ConfigModule (`../.env`), registers APP_GUARD AuthGuard, imports Planning + Auth modules | `api/src/app.module.ts` |
| AppController | `GET /api/health` | `api/src/app.controller.ts` |
| PlanningController | REST surface: upload (multipart), get planning, get schedule for month, get/update config | `api/src/planning/planning.controller.ts` |
| PlanningService | Orchestrates upload (parse → persist → config update), schedule projection, config validation | `api/src/planning/planning.service.ts` |
| Parser (pure) | Excel → normalized `Person[]` + warnings + startDate; S1..S6 blocks, row-identity, RH/off cells, slot times | `api/src/planning/parser.ts` |
| Date rotation (pure) | `weekIndexForDate` (Euclidean mod 6), `weekdayIndex` (Monday-first), `monthDays`, month/date validation | `api/src/planning/date-rotation.ts` |
| Storage | Flat-file persistence: atomic JSON writes (tmp+rename), xlsx write, typed config load | `api/src/planning/storage.ts` |
| AuthGuard | Global guard: Keycloak OIDC bearer verification via JWKS (jose), `app-planning-espoir` group check, mock mode when `AUTH_ENABLED=false` | `api/src/auth/auth.guard.ts` |
| AuthController | `GET /api/auth/me` → username | `api/src/auth/auth.controller.ts` |
| main.tsx | Webapp bootstrap: optional keycloak init, Redux Provider + App render | `webapp/src/main.tsx` |
| App.tsx | Top-level layout: initial data dispatches, error/warning banners, calendar + legend | `webapp/src/App.tsx` |
| api/client.ts | Fetch wrapper: base `/api`, bearer token injection, 401→keycloak.login, 403→gateway redirect, error message extraction | `webapp/src/api/client.ts` |
| store/apiMiddleware.ts | Single custom middleware: uniform `*_REQUESTED` → `*_START`/`*_SUCCESS`/`*_ERROR` for every async flow | `webapp/src/store/apiMiddleware.ts` |
| store/reducers.ts | Classic switch-based reducers: planning, schedule, config, selection, colors, auth | `webapp/src/store/reducers.ts` |
| store/actions.ts | Action type constants (SCREAMING_SNAKE) + typed action creator functions | `webapp/src/store/actions.ts` |
| keycloak.ts | `KeycloakApi` interface with enabled/disabled factory implementations | `webapp/src/auth/keycloak.ts` |
| MonthCalendar | Grid render: month nav, per-day filtered person cells, Sunday week-number badges | `webapp/src/components/MonthCalendar.tsx` |
| shared types | Cross-package domain types consumed by both api and webapp from `dist/` | `shared/src/types.ts` |

## Pattern Overview

**Overall:** Layered client–server monorepo: a thin REST API (NestJS feature
modules: controller → service → pure helpers + storage) behind a global auth
guard, and a Redux-driven SPA that talks to it through one custom middleware.
Both packages consume a single source of truth for domain types.

**Key Characteristics:**
- Feature modules in the API (`planning`, `auth`) each own their controller, service, pure logic, and specs — no shared service layer.
- All API state is disk-backed (no database); one planning at a time.
- All async frontend flows follow the same `*_REQUESTED` → `*_START`/`*_SUCCESS`/`*_ERROR` action pattern through `webapp/src/store/apiMiddleware.ts`.
- Pure date/parsing logic is separated from NestJS concerns as plain exported functions (`parser.ts`, `date-rotation.ts`) — unit-tested without Nest.
- Domain types live once in `shared/src/types.ts`; api and webapp import from `@planning-espoir/shared` (built `dist/`).

## Layers

**shared (domain types):**
- Purpose: Single source of truth for the normalized planning model shared across packages
- Location: `shared/src/types.ts`
- Contains: `Slot`, `DayCell` (discriminated union `shift`/`off`/`none`), `Person` (`weeks: DayCell[][6][7]`, `colorIndex`), `PersonDay`, `ScheduleMonth`, `PlanningData`, `Config`, `ParsingWarning`, `ParsedPlanning`
- Depends on: nothing
- Used by: `api/src/**` and `webapp/src/**` (via `dist/`, so it must be rebuilt after edits)

**api — transport layer (controllers + guard):**
- Purpose: HTTP surface, auth enforcement, multipart handling
- Location: `api/src/planning/planning.controller.ts`, `api/src/app.controller.ts`, `api/src/auth/auth.controller.ts`, `api/src/auth/auth.guard.ts`
- Contains: route decorators, `FileInterceptor` upload, global `AuthGuard`
- Depends on: PlanningService, Storage (via module factory)
- Used by: webapp `api/client.ts` and any HTTP client

**api — service layer:**
- Purpose: Orchestrates upload/read flows, validates input, maps storage → shared types
- Location: `api/src/planning/planning.service.ts`
- Contains: `upload`, `getPlanning`, `getSchedule`, `getConfig`, `updateConfig`
- Depends on: `parser.ts`, `date-rotation.ts`, `Storage`, shared types
- Used by: PlanningController

**api — domain/pure layer:**
- Purpose: Excel parsing and calendar math with no Nest dependencies
- Location: `api/src/planning/parser.ts`, `api/src/planning/date-rotation.ts`
- Contains: `parsePlanning`, `PlanningFormatError`, `weekIndexForDate`, `weekdayIndex`, `monthDays`, validators
- Depends on: `exceljs`, shared types
- Used by: PlanningService (and specs directly)

**api — persistence layer:**
- Purpose: Flat-file read/write under `DATA_DIR`
- Location: `api/src/planning/storage.ts`
- Contains: `Storage` class — `planning.xlsx`, `planning.json`, `config.json`; atomic writes via `.tmp` + rename
- Depends on: `fs`, shared types
- Used by: PlanningService, PlanningModule (factory: `new Storage(process.env.DATA_DIR ?? <cwd>/data)`)

**webapp — state layer (Redux):**
- Purpose: All app state and async orchestration
- Location: `webapp/src/store/` (`store.ts`, `actions.ts`, `reducers.ts`, `apiMiddleware.ts`, `types.ts`)
- Contains: `configureStore` (RTK, `thunk: false`), classic reducers, one API middleware, action creators
- Depends on: `webapp/src/api/client.ts`, shared types, `webapp/src/colors.ts`
- Used by: `main.tsx` (Provider), all components via `useSelector`/`useDispatch`

**webapp — API client layer:**
- Purpose: HTTP wrapper + auth token plumbing
- Location: `webapp/src/api/client.ts`
- Contains: `request<T>` (fetch, bearer header, 401/403 handling, error extraction), typed endpoint functions
- Depends on: `webapp/src/auth/keycloak.ts`, `webapp/src/auth/config.ts`
- Used by: `store/apiMiddleware.ts`

**webapp — UI layer (components):**
- Purpose: Render calendar, header, modals, legends
- Location: `webapp/src/components/` (`Header.tsx`, `MonthCalendar.tsx`, `DayCell.tsx`, `Legend.tsx`, `UploadButton.tsx`, `PersonDropdown.tsx`, `PersonMultiSelect.tsx`, `ConfigModal.tsx`, `PWAUpdatePrompt.tsx`)
- Contains: presentational + connected components (direct `useSelector`/`useDispatch`)
- Depends on: store, `utils/dates.ts`, `colors.ts`, `hooks/useClickOutside.ts`
- Used by: `App.tsx`

## Data Flow

### Primary Request Path — boot & initial load

1. `webapp/src/main.tsx` — optional `keycloak.init()` (login-required when enabled), then renders `<Provider store={store}><App /></Provider>`
2. `webapp/src/App.tsx:22-30` — dispatches `planningFetchRequested()`, `scheduleFetchRequested(currentMonthKey())`, `authFetchRequested()`; `configFetchRequested()` fires when `planning.people?.length` changes
3. `webapp/src/store/apiMiddleware.ts` — each `*_REQUESTED` dispatches `*_START` (status → `loading`), calls the matching `api/client.ts` function, then dispatches `*_SUCCESS` or `*_ERROR`
4. `webapp/src/store/reducers.ts` — updates slices; `App.tsx` renders error banners or `<MonthCalendar />` + `<Legend />` once `planning.status === 'loaded'`

### Schedule display flow

1. `MonthCalendar` nav buttons dispatch `scheduleFetchRequested(shiftMonth(month, ±1))` (`webapp/src/components/MonthCalendar.tsx:24,35`)
2. Middleware → `GET /api/planning/schedule?month=YYYY-MM` (`webapp/src/api/client.ts:57`)
3. `PlanningService.getSchedule` (`api/src/planning/planning.service.ts:66`) — validates month, loads `planning.json` + `config.json`, and for each day of the month computes `week = weekIndexForDate(startDate, date)` (Euclidean mod 6) and `day = weekdayIndex(date)` (Monday-first), building `PersonDay[]` per date plus `sundayWeeks` (1-based S1..S6 badge shown on Sundays)
4. `MonthCalendar` builds the month grid (`utils/dates.ts` `monthGrid`) and renders only people in `state.selection.names`, colored via `colors.ts` `colorFor(colorIndex, palette)`

### Upload flow (re-parse on each update)

1. `UploadButton` hidden file input → `planningUploadRequested(file)` (`webapp/src/components/UploadButton.tsx:25`)
2. Middleware → `POST /api/planning` multipart with `file` (`webapp/src/api/client.ts:51`)
3. `PlanningController.upload` with `FileInterceptor('file')` → `PlanningService.upload` (`api/src/planning/planning.service.ts:30`)
4. `parsePlanning(file.buffer, file.originalname)` (`api/src/planning/parser.ts:179`) — finds sheet with S1..S6 labels, parses S1 block for person identity (row order → `colorIndex`), fills `weeks[week-1]` per block, extracts startDate from sheet name + filename year
5. Storage persists `planning.xlsx`, `planning.json` (`{people, warnings}`), and updates `config.json` (`fileName`, `startDate` if parsed) — `api/src/planning/storage.ts`
6. On success the middleware also re-dispatches `configFetchRequested()` and `scheduleFetchRequested(currentMonth)` so the display matches the new document (`webapp/src/store/apiMiddleware.ts:59-63`)

### Config flow

1. `ConfigModal` → `configUpdateRequested({ startDate, defaultNames })` (`webapp/src/components/ConfigModal.tsx:125`)
2. Middleware → `PUT /api/planning/config` (`webapp/src/api/client.ts:65`); service validates `startDate` (YYYY-MM-DD) and `defaultNames` (string array) and persists (`api/src/planning/planning.service.ts:94`)
3. On success the middleware re-fetches the schedule for the current month
4. On `CONFIG_FETCH_SUCCESS`, names listed in `config.defaultNames` are auto-added to the selection (`webapp/src/store/apiMiddleware.ts:82-87`) — the only automatic pre-selection

### Auth flow

1. Webapp: token from `keycloak.getToken()` attached as `Authorization: Bearer` in every request (`webapp/src/api/client.ts:18-21`); 401 → `keycloak.login()`, 403 → redirect to gateway URL
2. API: global `AuthGuard` (`api/src/app.module.ts:16`) — when `AUTH_ENABLED=false` injects mock user `test-user`; otherwise verifies the JWT against the realm JWKS (`jose` `createRemoteJWKSet`) and requires the `app-planning-espoir` group; username from `preferred_username` (`api/src/auth/auth.guard.ts:40-76`)
3. `GET /api/auth/me` returns the resolved username (`api/src/auth/auth.controller.ts`)

**State Management:**
- Redux with classic reducers and one custom middleware; `configureStore` from RTK used only for store setup with `thunk: false` (`webapp/src/store/store.ts:21-22`)
- Six slices in `webapp/src/store/reducers.ts`: `planning`, `schedule`, `config`, `selection` (names), `colors` (static palette), `auth`
- Each async slice carries `status: 'idle' | 'loading' | 'loaded' | 'error'` + `error: string | null` (`webapp/src/store/types.ts`)
- API-side state is entirely the flat files in `DATA_DIR` — no in-memory cache or DB

## Key Abstractions

**DayCell (discriminated union):**
- Purpose: One calendar day cell for one person: `{type:'shift', slots}` | `{type:'off', label}` | `{type:'none'}`
- Examples: `shared/src/types.ts:6-7`; consumed by parser, service, and `DayCell.tsx` component
- Pattern: Discriminated union — exhaustively switched on `type` in `webapp/src/components/DayCell.tsx`

**Person identity by S1 row order:**
- Purpose: Persons are identified by row index within the S1 block, not by name (spellings vary across weeks); `colorIndex` comes from S1 order
- Examples: `api/src/planning/parser.ts:198-205` (`colorIndex: i`), `webapp/src/components/DayCell.tsx` color via `colorFor(colorIndex, palette)`
- Pattern: Positional identity, stable across the 6 template weeks

**Week rotation (`weekIndexForDate`):**
- Purpose: Any real date maps to a template week 0..5 via Euclidean modulo from `config.json.startDate`
- Examples: `api/src/planning/date-rotation.ts:17-23`; used in `PlanningService.getSchedule`
- Pattern: Pure function, UTC date math, `((diffDays/7) % 6 + 6) % 6`

**Storage class:**
- Purpose: Encapsulate flat-file persistence with atomic JSON writes (write `.tmp`, then rename)
- Examples: `api/src/planning/storage.ts`; instantiated via factory in `api/src/planning/planning.module.ts:12-14`
- Pattern: Constructor-injected `dataDir`, one instance per module via `useFactory`

**KeycloakApi interface + factories:**
- Purpose: Isolate keycloak-js behind an interface with a no-op disabled implementation, so the app runs without an IdP
- Examples: `webapp/src/auth/keycloak.ts` (`createEnabled()` / `createDisabled()`, exported singleton `keycloak`)
- Pattern: Strategy via factory; module-level singleton selection based on `authConfig.enabled`

**Action contract (`Action<T, P>` + creators):**
- Purpose: Uniform action shape for all async flows; every flow has 4 constants + 4 creator functions
- Examples: `webapp/src/store/actions.ts` (e.g. `PLANNING_FETCH_REQUESTED`/`_START`/`_SUCCESS`/`_ERROR`)
- Pattern: String constants + typed creator functions; consumed by `apiMiddleware.ts` and `reducers.ts`

## Entry Points

**API bootstrap:**
- Location: `api/src/main.ts`
- Triggers: `nest start` / `node dist/main.js` (Docker `CMD ["node", "api/dist/main.js"]`)
- Responsibilities: create Nest app, `setGlobalPrefix('api')`, `enableCors()`, listen on `PORT` (default 3000)

**Webapp bootstrap:**
- Location: `webapp/src/main.tsx`
- Triggers: `vite` / static nginx serving `webapp/dist` (host port 8083 via `docker-compose.yml`)
- Responsibilities: keycloak init (when enabled), Redux Provider, React 19 `createRoot` render

**API routes:**
- `GET /api/health` — `api/src/app.controller.ts`
- `POST /api/planning` (multipart `file`) — upload
- `GET /api/planning` — current planning
- `GET /api/planning/schedule?month=YYYY-MM` — month projection
- `GET /api/planning/config` / `PUT /api/planning/config` — config read/update
- `GET /api/auth/me` — current username

## Architectural Constraints

- **Threading:** Node single-threaded event loop; no worker threads, queues, or job scheduling. Excel parsing runs inside the upload request handler; concurrent uploads are last-write-wins with no locking across the 3-file persistence sequence (`api/src/planning/planning.service.ts:41-51`).
- **Global state:** No API-side global mutable state (Storage is DI-injected). Webapp: module-level `redirecting` flag in `webapp/src/api/client.ts:15`; module-level `keycloak` singleton in `webapp/src/auth/keycloak.ts:53`; static `PALETTE` in `webapp/src/colors.ts`.
- **Circular imports:** None detected. Dependency direction is one-way: components → store → api client → auth; api modules → service → pure helpers/storage.
- **Shared types are built artifacts:** `shared` is consumed from `dist/` (`main: dist/index.js`), so any edit to `shared/src/types.ts` requires `yarn workspace @planning-espoir/shared build` before api/webapp typecheck or tests (all root scripts build it first).
- **Single root `.env`:** API reads `../.env` (`api/src/app.module.ts:11`), Vite reads it via `envDir: '..'` (`webapp/vite.config.ts:8`). `VITE_*` vars are build-time (Docker build args, `webapp/Dockerfile`), API vars runtime.
- **Redux constraints (non-negotiable):** no thunks (`thunk: false` in `webapp/src/store/store.ts:22`), no slices, no `createReducer`; follow the `*_REQUESTED → *_START/_SUCCESS/_ERROR` pattern for new async flows.
- **No database:** all persistence is flat files under `DATA_DIR` (`api/data/` in dev, `/data` volume in Docker).
- **Monday-first calendar:** both API (`weekdayIndex`) and webapp (`monthGrid`) use Monday-first week indexing consistently.

## Anti-Patterns

### Stale schedule responses can overwrite newer month data

**What happens:** `SCHEDULE_FETCH_START` records the requested month, but success responses are not correlated to the request. Rapid month navigation (‹ › buttons in `webapp/src/components/MonthCalendar.tsx:24,35`) fires overlapping requests; a slow older response arrives last and `SCHEDULE_FETCH_SUCCESS` overwrites `state.schedule` with the stale month (`webapp/src/store/reducers.ts:102-116`).
**Why it's wrong:** The calendar can silently display the wrong month after quick navigation.
**Do this instead:** Compare `payload.month` against the latest requested month in the middleware (`store.getState().schedule.month`) before dispatching success, or track an in-flight request id and ignore stale responses — same guard applies to config/planning fetches.

### No-op `colorsReducer`

**What happens:** `webapp/src/store/reducers.ts:177-179` returns `initialColors` unconditionally; the `colors` slice has no actions and never changes.
**Why it's wrong:** A dead abstraction — components could read the palette from `webapp/src/colors.ts` directly; the slice adds boilerplate and a misleading "stateful" surface.
**Do this instead:** Remove the slice, or give it real actions (e.g. per-person color override) if the feature is planned.

### Duplicated date utilities across packages

**What happens:** `monthDays` and `weekdayIndex` are implemented twice — `api/src/planning/date-rotation.ts:25-37` and `webapp/src/utils/dates.ts:44-61`.
**Why it's wrong:** The two copies can drift (they already differ in exports), and the week-rotation logic that must stay consistent lives only in the API.
**Do this instead:** Move shared calendar math into `shared/src/` (e.g. `shared/src/dates.ts`) and import from both packages.

### Loosely-typed action payloads

**What happens:** `Action` has `[key: string]: unknown` (`webapp/src/store/actions.ts:37-42`), so reducers and middleware cast payloads with `as` (`webapp/src/store/reducers.ts:69,103`; `apiMiddleware.ts:58,71`).
**Why it's wrong:** Payload/type mismatches are caught at runtime, not compile time — a renamed field breaks silently.
**Do this instead:** Discriminate actions on the `type` literal (action-union pattern) or use typed per-flow payload interfaces in the reducer signatures.

## Error Handling

**Strategy:** API — NestJS exception hierarchy mapped to HTTP statuses; webapp — uniform `*_ERROR` actions with a user-facing message string rendered as banners.

**Patterns:**
- Parser failures: `PlanningFormatError` → `BadRequestException` with the parser's message (`api/src/planning/planning.service.ts:35-39`)
- Missing data: `loadPlanningJson()` returns `null` → `NotFoundException('No planning uploaded yet')` (`api/src/planning/planning.service.ts:61,69`); missing `startDate` → `BadRequestException`
- Input validation: manual regex checks in service (`isValidMonth`, `isValidDateKey`, `defaultNames` array check) — no class-validator/DTOs
- Auth failures: `UnauthorizedException` (missing/invalid token), `ForbiddenException` (group missing), `ServiceUnavailableException` (IdP unreachable) (`api/src/auth/auth.guard.ts:48-75`)
- Webapp HTTP errors: `request<T>` throws `Error` with the API's `message` body when present (`webapp/src/api/client.ts:30-39`); middleware catches and dispatches `*_ERROR` with `err.message`
- Storage read errors are swallowed to `null` (`api/src/planning/storage.ts:54-61`) — a corrupted `planning.json` surfaces as a 404, not a 500

## Cross-Cutting Concerns

**Logging:** No logging statements in API code (Nest default boot logs only). Webapp: `redux-logger` attached in development mode (`webapp/src/store/store.ts:10-16`); `console.log` for SW registration errors in `webapp/src/components/PWAUpdatePrompt.tsx:20`.
**Validation:** Hand-rolled per-endpoint validation in `PlanningService`; multipart presence checked in `upload`. No shared validation layer.
**Authentication:** Global `APP_GUARD` (`api/src/app.module.ts:16`) covering all routes including `/api/health`; webapp attaches bearer tokens and handles 401/403 redirects centrally in `webapp/src/api/client.ts`. PWA service worker runtime-caches `/api/planning*` GETs (NetworkFirst, `webapp/vite.config.ts:44-58`).

---

*Architecture analysis: 2026-08-24*
