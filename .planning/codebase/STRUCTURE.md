# Codebase Structure

**Analysis Date:** 2026-08-24

## Directory Layout

```
planning-espoir/
├── package.json            # Root: packageManager pin + orchestration scripts
├── pnpm-workspace.yaml     # pnpm workspaces (shared, api, webapp) + supply-chain settings
├── tsconfig.base.json      # Shared TS compiler options (ES2022, strict, commonjs)
├── pnpm-lock.yaml
├── .env                    # Single root env for BOTH apps (gitignored; see .env.example)
├── .env.example            # Documents API + VITE_* variables
├── .gitlab-ci.yml          # CI: install → lint ∥ build → test → deploy (curl webhook)
├── docker-compose.yml      # api (DATA_DIR volume) + webapp (nginx, host port 8083)
├── AGENTS.md / CLAUDE.md / opencode.json
├── .planning/              # GSD workflow state (incl. this codebase map)
├── .superpowers/           # Superpowers workflow state
│
├── shared/                 # @planning-espoir/shared — domain types only
│   ├── package.json        # main/types → dist/
│   ├── tsconfig.json
│   └── src/
│       ├── types.ts        # Slot, DayCell, Person, ScheduleMonth, Config, warnings…
│       └── index.ts        # barrel: `export * from './types'`
│
├── api/                    # @planning-espoir/api — NestJS backend, port 3000
│   ├── package.json
│   ├── nest-cli.json
│   ├── tsconfig.json / tsconfig.build.json
│   ├── eslint.config.mjs
│   ├── jest.config.ts
│   ├── Dockerfile
│   ├── ARCHITECTURE.md     # package-level doc
│   ├── data/               # RUNTIME state, gitignored (planning.xlsx, planning.json, config.json)
│   ├── test/               # e2e specs (jest-e2e.json)
│   │   └── helpers/planning-workbook.ts   # builds .xlsx fixtures for e2e
│   └── src/
│       ├── main.ts         # bootstrap: prefix /api, CORS, PORT
│       ├── app.module.ts   # root module + APP_GUARD
│       ├── app.controller.ts            # GET /api/health
│       ├── planning/       # feature module
│       │   ├── planning.module.ts       # controller + service + Storage factory (DATA_DIR)
│       │   ├── planning.controller.ts   # /api/planning* routes (upload, get, schedule, config)
│       │   ├── planning.service.ts      # orchestration + validation
│       │   ├── parser.ts                # exceljs → Person[] + warnings (pure)
│       │   ├── date-rotation.ts         # weekIndexForDate, weekdayIndex, monthDays (pure)
│       │   ├── storage.ts               # flat-file persistence (atomic writes)
│       │   ├── multer-file.ts           # MulterFile type
│       │   └── *.spec.ts                # colocated unit tests
│       └── auth/           # feature module
│           ├── auth.module.ts           # AuthGuard factory from ConfigService
│           ├── auth.guard.ts            # JWKS bearer verification / mock mode
│           ├── auth.controller.ts       # GET /api/auth/me
│           ├── identity.ts              # MOCK_USERNAME + resolveUsername
│           └── *.spec.ts
│
└── webapp/                 # @planning-espoir/webapp — React 19 + Vite SPA, port 5174
    ├── package.json
    ├── vite.config.ts      # proxy /api→:3000, envDir '..', tailwind, PWA, vitest config
    ├── tsconfig.json
    ├── eslint.config.mjs
    ├── index.html          # entry HTML (lang="fr", #root)
    ├── nginx.conf          # served at host port 8083
    ├── Dockerfile          # VITE_* build args, nginx runtime
    ├── ARCHITECTURE.md     # package-level doc
    ├── pwa-assets.config.ts
    ├── public/
    │   ├── favicon.svg
    │   └── manifest.webmanifest
    └── src/
        ├── main.tsx        # bootstrap: keycloak init → Provider → App
        ├── App.tsx         # layout, initial dispatches, error/warning banners
        ├── index.css       # Tailwind v4 import + @theme fonts + animations
        ├── colors.ts       # PALETTE + colorFor()
        ├── vite-env.d.ts
        ├── components/     # PascalCase .tsx, colocated *.spec.tsx
        │   ├── Header.tsx  ├── MonthCalendar.tsx  ├── DayCell.tsx
        │   ├── Legend.tsx  ├── UploadButton.tsx   ├── PersonDropdown.tsx
        │   ├── PersonMultiSelect.tsx  ├── ConfigModal.tsx  └── PWAUpdatePrompt.tsx
        ├── store/          # Redux (classic reducers + custom middleware)
        │   ├── store.ts        # configureStore, thunk: false, redux-logger (dev)
        │   ├── actions.ts      # constants + action creators
        │   ├── reducers.ts     # 6 slices: planning, schedule, config, selection, colors, auth
        │   ├── apiMiddleware.ts # all async flows: *_REQUESTED → *_START/_SUCCESS/_ERROR
        │   ├── types.ts        # RootState + per-slice state types
        │   └── *.spec.ts
        ├── api/
        │   └── client.ts   # fetch wrapper + typed endpoint functions
        ├── auth/
        │   ├── keycloak.ts # KeycloakApi interface, enabled/disabled factories
        │   ├── config.ts   # authConfig from VITE_* env
        │   └── username.ts # MOCK_USERNAME
        ├── utils/
        │   └── dates.ts    # month grid, labels (French), shiftMonth, today helpers
        ├── hooks/
        │   └── useClickOutside.ts
        └── test/
            ├── setup.ts    # vitest setup (@testing-library/jest-dom)
            └── store.ts    # test store factory
```

## Directory Purposes

**`shared/`:**
- Purpose: Cross-package domain types, the only shared code between api and webapp
- Contains: `types.ts` + barrel `index.ts`
- Key files: `shared/src/types.ts` — all domain models consumed from `dist/`

**`api/src/planning/`:**
- Purpose: The planning feature — upload, parse, store, schedule projection, config
- Contains: Nest module/controller/service + pure helpers + storage + specs
- Key files: `planning.module.ts`, `planning.controller.ts`, `planning.service.ts`, `parser.ts`, `date-rotation.ts`, `storage.ts`

**`api/src/auth/`:**
- Purpose: Keycloak OIDC auth — global guard, /me endpoint, mock identity
- Contains: guard, controller, module, identity helpers
- Key files: `auth.guard.ts`, `auth.module.ts`

**`api/test/`:**
- Purpose: Self-contained e2e tests (temp `DATA_DIR`, `AUTH_ENABLED=false`)
- Contains: `*.e2e-spec.ts`, `jest-e2e.json`, `helpers/planning-workbook.ts`
- Key files: `api/test/planning.e2e-spec.ts`, `api/test/helpers/planning-workbook.ts`

**`api/data/`:**
- Purpose: Runtime state — one planning at a time
- Contains: `planning.xlsx` (raw), `planning.json` (normalized + warnings), `config.json` (`startDate`, `defaultNames`, `fileName`)
- Gitignored (`.gitignore` → `data/`); in Docker it is the `api-data` volume mounted at `/data`

**`webapp/src/components/`:**
- Purpose: All React components, connected directly to the store via hooks
- Contains: calendar, header, dropdowns, modal, upload, legend, PWA prompt
- Key files: `MonthCalendar.tsx`, `ConfigModal.tsx`, `Header.tsx`

**`webapp/src/store/`:**
- Purpose: Redux state — actions, classic reducers, single API middleware, store factory
- Contains: 6 slices with `idle|loading|loaded|error` statuses
- Key files: `apiMiddleware.ts`, `actions.ts`, `reducers.ts`, `store.ts`, `types.ts`

**`webapp/src/api/`, `webapp/src/auth/`, `webapp/src/utils/`, `webapp/src/hooks/`:**
- Purpose: Non-component support code — HTTP client, keycloak wrapper + config, date helpers, shared hooks
- Key files: `api/client.ts`, `auth/keycloak.ts`, `utils/dates.ts`

**`docs/`:**
- Purpose: Architecture decision records + superpowers plans/specs (committed alongside code)
- Contains: `docs/adr/0001-0007-*.md`, `docs/superpowers/plans/`, `docs/superpowers/specs/`

## Key File Locations

**Entry Points:**
- `api/src/main.ts`: NestJS bootstrap (global prefix `/api`, CORS, port 3000)
- `webapp/src/main.tsx`: React bootstrap (keycloak init → Provider → App)
- `webapp/index.html`: HTML entry (`/src/main.tsx` module script)

**Configuration:**
- `package.json` (root): workspaces + orchestration scripts (`dev`, `build`, `test`, `lint`, `typecheck`, `format`)
- `tsconfig.base.json`: shared TS options; overridden per package (`api/tsconfig.json` commonjs + decorators, `webapp/tsconfig.json` ESNext + bundler)
- `webapp/vite.config.ts`: proxy `/api` → `localhost:3000`, `envDir: '..'`, Tailwind v4, PWA plugin, vitest jsdom config
- `api/src/app.module.ts`: `ConfigModule.forRoot({ envFilePath: '../.env' })`
- `api/src/planning/planning.module.ts`: `Storage` factory from `process.env.DATA_DIR`
- `docker-compose.yml` / `api/Dockerfile` / `webapp/Dockerfile`: deployment topology

**Core Logic:**
- `api/src/planning/parser.ts`: Excel → normalized model
- `api/src/planning/date-rotation.ts`: calendar ↔ template-week math
- `api/src/planning/planning.service.ts`: request orchestration
- `webapp/src/store/apiMiddleware.ts`: all async flows
- `webapp/src/store/reducers.ts`: state transitions
- `webapp/src/components/MonthCalendar.tsx`: calendar rendering + month nav

**Testing:**
- `api/src/**/*.spec.ts`: colocated unit tests (jest)
- `api/test/*.e2e-spec.ts`: API e2e (supertest, temp DATA_DIR)
- `webapp/src/**/*.spec.ts(x)`: colocated vitest tests
- `webapp/src/test/setup.ts`, `webapp/src/test/store.ts`: test harness

## Naming Conventions

**Files:**
- React components: PascalCase `*.tsx` — `MonthCalendar.tsx`, `ConfigModal.tsx`
- Spec files: colocated `*.spec.ts` / `*.spec.tsx` next to the code they test
- Nest feature modules: lowercase `*.module.ts`, `*.controller.ts`, `*.service.ts` in a lowercase feature dir — `api/src/planning/planning.module.ts`
- Pure helper modules: kebab-case — `date-rotation.ts`, `multer-file.ts`, `useClickOutside.ts`, `apiMiddleware.ts`
- Store modules: lowercase — `actions.ts`, `reducers.ts`, `store.ts`, `types.ts`
- Shared types: single `types.ts` (no per-type files)

**Directories:**
- API feature dirs: lowercase singular (`planning/`, `auth/`)
- Webapp dirs: lowercase functional (`components/`, `store/`, `api/`, `auth/`, `utils/`, `hooks/`, `test/`)

**Functions:**
- camelCase; action creators follow `<domain><Verb><Status>` — `planningFetchRequested()`, `scheduleFetchSuccess()`, `configUpdateError()`

**Types:**
- PascalCase interfaces (`Person`, `ScheduleMonth`, `RootState`, `PlanningState`, `AuthGuardOptions`)
- Action type constants: SCREAMING_SNAKE_CASE with the uniform shape `<DOMAIN>_<VERB>_<REQUESTED|START|SUCCESS|ERROR>` — `PLANNING_UPLOAD_SUCCESS`

## Where to Add New Code

**New API endpoint:**
- Route: `api/src/planning/planning.controller.ts` (or a new `api/src/<feature>/<feature>.controller.ts` + `<feature>.module.ts` registered in `api/src/app.module.ts`)
- Logic: `api/src/planning/planning.service.ts` (or the new feature's service); pure math/parsing goes in a plain module like `api/src/planning/date-rotation.ts`
- Tests: colocated `*.spec.ts` (unit) + `api/test/*.e2e-spec.ts` (e2e)

**New frontend async flow:**
- Action constants + creators: `webapp/src/store/actions.ts` (follow the 4-part `*_REQUESTED/_START/_SUCCESS/_ERROR` pattern)
- Side effects: `webapp/src/store/apiMiddleware.ts` (new `case` calling a function from `webapp/src/api/client.ts`)
- State: extend `webapp/src/store/types.ts` + `webapp/src/store/reducers.ts`
- Tests: `webapp/src/store/apiMiddleware.spec.ts` (existing pattern)

**New React component:**
- Implementation: `webapp/src/components/<Name>.tsx` (PascalCase), connected via `useSelector`/`useDispatch`
- Tests: colocated `webapp/src/components/<Name>.spec.tsx`
- Generic interactions (e.g. click-outside): `webapp/src/hooks/`

**New shared domain type:**
- Add to `shared/src/types.ts`, then **rebuild** — `pnpm --filter @planning-espoir/shared run build` — because api/webapp consume `dist/`; stale types otherwise break typecheck/tests

**New utility function:**
- Frontend-only: `webapp/src/utils/` (date/format helpers like `webapp/src/utils/dates.ts`)
- Calendar math shared with the API: prefer `api/src/planning/date-rotation.ts` or move into `shared/` — do not duplicate (see ARCHITECTURE.md anti-patterns)

**New config/env var:**
- Add to root `.env.example`; API-side read via `ConfigService`/`process.env`, webapp-side via `import.meta.env.VITE_*` (build-time; add as Docker build arg in `webapp/Dockerfile` + `docker-compose.yml`)

## Special Directories

**`api/dist/`, `webapp/dist/`, `shared/dist/`:**
- Purpose: TypeScript/Vite build output; `shared/dist` is the consumption surface for the other packages
- Generated: Yes
- Committed: No (gitignored via `dist/`)

**`api/data/`:**
- Purpose: Runtime flat-file state (planning.xlsx, planning.json, config.json)
- Generated: Yes (runtime)
- Committed: No (gitignored via `data/`)

**`webapp/public/`:**
- Purpose: Static assets copied as-is to the build (`favicon.svg`, `manifest.webmanifest`)
- Generated: No
- Committed: Yes

**`docs/`:**
- Purpose: ADRs + superpowers plans/specs, committed alongside the code
- Generated: No
- Committed: Yes

**`.planning/`:**
- Purpose: GSD planning workflow state (roadmap, phases, codebase map)
- Generated: Yes (workflow)
- Committed: Yes (GSD convention)

---

*Structure analysis: 2026-08-24*
