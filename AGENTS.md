# Planning Espoir

Single-page app that uploads an Excel planning document and displays a person's work schedule on a calendar. The upload is re-parsed on each update so the displayed schedule always matches the latest document.

Communication with the user is in French; all code, documentation, and tests in English.

## Repo layout

Yarn workspaces monorepo, three packages:

- `shared/` — `@planning-espoir/shared`, domain types only. Consumed from `dist/` (`main: dist/index.js`), so **rebuild it after any edit** (`yarn workspace @planning-espoir/shared build`) or api/webapp typecheck and tests will use stale types. All root scripts build it first.
- `api/` — `@planning-espoir/api`, NestJS. Global prefix `/api`, port 3000. No database: flat files under `DATA_DIR` (default `<cwd>/data`, i.e. `api/data/` in dev — gitignored, real local data lives there). One planning at a time: `planning.xlsx` (raw), `planning.json` (normalized), `config.json` (`startDate`, `defaultName`, `fileName`).
- `webapp/` — `@planning-espoir/webapp`, React 19 + Vite SPA, port 5174, proxies `/api` → `localhost:3000`.

## Commands (from repo root)

- `yarn dev` — builds shared, then api (`nest start --watch`) + webapp (`vite`) concurrently.
- `yarn build` / `yarn test` / `yarn lint` / `yarn typecheck` — orchestrate all workspaces.
- `yarn format` — Prettier write. **Lint enforces formatting** (`prettier/prettier: error` in both eslint configs), so run this when lint fails on style.
- Single API unit test: `yarn workspace @planning-espoir/api test -- parser` (jest `--runInBand`).
- API e2e: `yarn workspace @planning-espoir/api test:e2e` — self-contained (sets `AUTH_ENABLED=false`, temp `DATA_DIR`), no external services needed.
- Single webapp test: `yarn workspace @planning-espoir/webapp test -- src/utils/dates.spec.ts` (vitest).

## Env and auth

- **One root `.env` for both apps**: the API reads `../.env` (`ConfigModule envFilePath`) and Vite reads it via `envDir: '..'`. `.env.example` at the root documents both sets of variables; there are no per-package `.env` files.
- Auth is Keycloak OIDC. Dev without Keycloak: `AUTH_ENABLED=false` + `VITE_AUTH_ENABLED=false` → mock user `test-user`, guard off. Otherwise the API verifies bearer tokens against the realm JWKS and requires the `app-planning-espoir` group.
- `VITE_*` vars are **build-time** (inlined by Vite; passed as docker-compose build args), API vars are runtime.

## Frontend constraints (non-negotiable)

- Tailwind CSS v4 (via `@tailwindcss/vite`).
- Redux with **classic reducers and custom middlewares only** — no thunks (explicitly disabled: `thunk: false` in `store.ts`), no slices, no `createReducer`. RTK `configureStore` is used for store setup only. All API calls go through `src/store/apiMiddleware.ts` with a uniform `*_REQUESTED` → `*_START` / `*_SUCCESS` / `*_ERROR` action pattern — follow it for new async flows.

## Workflow (superpowers)

Build feature-by-feature via the superpowers planning loop:

1. Brainstorm the feature with the user (in French).
2. Record each design decision as an ADR in `docs/adr/` (existing: 0001–0005).
3. Write the implementation plan in `docs/superpowers/plans/` (specs in `docs/superpowers/specs/`).
4. Implement and commit incrementally, one plan per commit.
5. Every feature ships with tests and passes lint + typecheck.

Confirm any architecture change with the user before committing to it.

`IMPROVEMENTS.md` lists improvements to plan/spec (delete each entry once handled). `MANUAL_EDITS.md` lists edits the user made by hand — verify them and fold them into the specs, then delete the entry.

## Deploy

GitLab CI (`.gitlab-ci.yml`): install → lint ∥ build → test → deploy. Deploy is a curl POST to `DEPLOY_WEBHOOK_URL`, `main` only. Docker: `docker-compose.yml` builds api + webapp (nginx, host port 8083), API data persisted in the `api-data` volume.

## Key domain facts (details in `docs/adr/`)

- The Excel sheet has 6 template weeks `S1`–`S6`; a real date maps to a week by Euclidean modulo from `config.json.startDate` (pre-filled from sheet name + upload filename, user-correctable).
- Person identity is by **row index within the S1 block**, not by name (spellings vary across weeks); `colorIndex` comes from S1 order.
- The browser never parses Excel — the API parses once per upload with `exceljs` and serves the normalized JSON.

## Docs maintenance

`docs/` and this file are committed alongside the code they document; update them whenever architecture or scope changes.
