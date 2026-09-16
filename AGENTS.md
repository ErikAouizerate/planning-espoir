# Planning Espoir

Single-page app that uploads an Excel planning document and displays a person's work schedule on a calendar. The upload is re-parsed on each update so the displayed schedule always matches the latest document.

Communication with the user is in French; all code, documentation, and tests in English.

## Repo layout

pnpm workspaces monorepo (pnpm only — never npm or yarn; `packageManager` + `pnpm-workspace.yaml`), three packages:

- `shared/` — `@planning-espoir/shared`, domain types only. Consumed from `dist/` (`main: dist/index.js`), so **rebuild it after any edit** (`pnpm --filter @planning-espoir/shared run build`) or api/webapp typecheck and tests will use stale types. All root scripts build it first.
- `api/` — `@planning-espoir/api`, NestJS. Global prefix `/api`, port 3000. No database: flat files under `DATA_DIR` (default `<cwd>/data`, i.e. `api/data/` in dev — gitignored, real local data lives there). One planning at a time: `planning.xlsx` (raw), `planning.json` (normalized), `config.json` (`startDate`, `defaultNames`, `fileName`).
- `webapp/` — `@planning-espoir/webapp`, React 19 + Vite SPA, port 5174. Calls the API cross-origin via `VITE_API_BASE` (no Vite dev proxy).

## Commands (from repo root)

- `pnpm dev` — builds shared, then api (`nest start --watch`) + webapp (`vite`) concurrently.
- `pnpm build` / `pnpm test` / `pnpm lint` / `pnpm typecheck` — orchestrate all workspaces.
- `pnpm format` — Prettier write. **Lint enforces formatting** (`prettier/prettier: error` in both eslint configs), so run this when lint fails on style.
- Single API unit test: `pnpm --filter @planning-espoir/api run test -- parser` (jest `--runInBand`).
- API e2e: `pnpm --filter @planning-espoir/api run test:e2e` — self-contained (sets `AUTH_ENABLED=false`, temp `DATA_DIR`), no external services needed.
- Single webapp test: `pnpm --filter @planning-espoir/webapp run test -- src/utils/dates.spec.ts` (vitest).
- Containerized dev (hot reload, behind Caddy): `docker compose up --build` → `http://planning-espoir.localhost` (webapp) + `http://api.planning-espoir.localhost` (api). `docker-compose.override.yml` is auto-merged; requires the external `local-proxy` network (see Deploy).

## Env and auth

- **One root `.env` for both apps**: the API reads `../.env` (`ConfigModule envFilePath`) and Vite reads it via `envDir: '..'`. `.env.example` at the root documents both sets of variables; there are no per-package `.env` files.
- Auth is Keycloak OIDC. Dev without Keycloak: `AUTH_ENABLED=false` + `VITE_AUTH_ENABLED=false` → mock user `test-user`, guard off. Otherwise the API verifies bearer tokens against the realm JWKS and requires the `app-planning-espoir` group.
- `VITE_*` vars are **build-time** (inlined by Vite; passed as docker-compose build args), API vars are runtime.
- `VITE_API_BASE` (absolute API origin, `/api` suffix included) makes the webapp call the API cross-origin; empty/absent → relative `/api` (production behind nginx). Local native dev sets `VITE_API_BASE=http://localhost:3000/api`, the container override sets `http://api.planning-espoir.localhost/api`.
- `CORS_ORIGINS` (comma-separated) is the API's allowed browser origins; when set the API enables CORS. Required for cross-origin dev: `http://localhost:5174` (native) and/or `http://planning-espoir.localhost` (container).

## Frontend constraints (non-negotiable)

- Tailwind CSS v4 (via `@tailwindcss/vite`).
- Redux with **classic reducers and custom middlewares only** — no thunks (explicitly disabled: `thunk: false` in `store.ts`), no slices, no `createReducer`. RTK `configureStore` is used for store setup only. All API calls go through `src/store/apiMiddleware.ts` with a uniform `*_REQUESTED` → `*_START` / `*_SUCCESS` / `*_ERROR` action pattern — follow it for new async flows.

## Workflow (superpowers)

Build feature-by-feature via the superpowers planning loop:

1. Brainstorm the feature with the user (in French).
2. Record each design decision as an ADR in `docs/adr/` (existing: 0001–0010).
3. Write the implementation plan in `docs/superpowers/plans/` (local only) with specs in `docs/superpowers/specs/` (committed, authoritative).
4. Implement and commit incrementally, one plan per commit.
5. Every feature ships with tests and passes lint + typecheck.

Confirm any architecture change with the user before committing to it.

`IMPROVEMENTS.md` lists improvements to plan/spec (delete each entry once handled). `MANUAL_EDITS.md` lists edits the user made by hand — verify them and fold them into the specs, then delete the entry.

## Deploy

GitLab CI (`.gitlab-ci.yml`): install → lint ∥ build → test → deploy. Deploy is a curl POST to `DEPLOY_WEBHOOK_URL`, `main` only. Docker: `docker-compose.yml` builds api + webapp (nginx) and is deployed as-is by Dokploy — services use `expose` (never `ports`), the built-in Traefik proxy routes internally; API data persisted in the `api-data` volume.

Local dev: `docker-compose.override.yml` (auto-merged by `docker compose up`) runs hot-reload `dev` targets behind the shared Caddy proxy (`localhost-reverse-proxy` on the external `local-proxy` network) and publishes nothing but `127.0.0.1` ports. Prerequisite: `docker network create local-proxy` (or start the `localhost-reverse-proxy` stack). The Caddy site labels must stay scheme-qualified (`http://...`). Keycloak redirect URIs for the client must include `http://planning-espoir.localhost/*`.

## Key domain facts (details in `docs/adr/`)

- The Excel sheet has 6 template weeks `S1`–`S6`; a real date maps to a week by Euclidean modulo from `config.json.startDate` (pre-filled from sheet name + upload filename, user-correctable).
- Person identity is by **row index within the S1 block**, not by name (spellings vary across weeks); `colorIndex` comes from S1 order.
- The browser never parses Excel — the API parses once per upload with `exceljs` and serves the normalized JSON.

## Docs maintenance

`docs/` and this file are committed alongside the code they document; update them whenever architecture or scope changes.
