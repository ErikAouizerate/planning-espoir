# Technology Stack

**Analysis Date:** 2026-08-24

## Languages

**Primary:**
- TypeScript ~5.9.3 — entire codebase: `shared/src/`, `api/src/`, `webapp/src/`, plus all configs (`webapp/vite.config.ts`, `api/jest.config.ts`, `webapp/pwa-assets.config.ts`, eslint configs)

**Secondary:**
- CSS (Tailwind v4 style) — single stylesheet `webapp/src/index.css`
- HTML — `webapp/index.html`, `webapp/public/manifest.webmanifest`, `webapp/public/favicon.svg`
- YAML — `.gitlab-ci.yml`, `docker-compose.yml`

## Runtime

**Environment:**
- Node.js 22 (LTS) — pinned via `node:22-alpine` in `.gitlab-ci.yml`, `api/Dockerfile`, `webapp/Dockerfile`. No `.nvmrc` / `.node-version` in repo. Types target `@types/node ^26` (api devDependencies).

**Package Manager:**
- pnpm 11 (pinned via `packageManager: pnpm@11.18.0` in root `package.json`) — `pnpm-lock.yaml` + `pnpm-workspace.yaml` at the repo root (`shared`, `api`, `webapp`), with supply-chain settings (`minimumReleaseAge`, `strictDepBuilds`, `allowBuilds`).

## Frameworks

**Core:**
- NestJS ^11.1.28 — API framework (`api/package.json`): `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/config` 4.0.4
- React ^19.2.8 + `react-dom` ^19.2.8 — webapp UI
- Vite ^8.2.0 — webapp build/dev server (`webapp/vite.config.ts`)
- Redux stack — `@reduxjs/toolkit` 2.12.0 (only `configureStore`; thunk explicitly disabled), `redux` ^5.0.1, `react-redux` ^9.3.0
- Tailwind CSS ^4.3.3 — via `@tailwindcss/vite` plugin, theme in `webapp/src/index.css` (`@theme` block)
- PWA — `vite-plugin-pwa` ^0.21.1 + `@vite-pwa/assets-generator` ^1.0.0 (`webapp/vite.config.ts`, `webapp/pwa-assets.config.ts`)

**Testing:**
- API: Jest ^29.7.0 + `ts-jest` + `supertest` (unit `*.spec.ts`, e2e `api/test/*.e2e-spec.ts`)
- Webapp: Vitest ^4.1.10 + `jsdom` ^26.1.0 + Testing Library (`@testing-library/react` ^16.3.2, `jest-dom`, `user-event`, `dom`)

**Build/Dev:**
- `@nestjs/cli` ^11.0.24 — `nest build` / `nest start --watch`
- `concurrently` ^10.0.4 — root `pnpm dev` runs api + webapp together (root `package.json`)
- ESLint ^9 (flat config) + `typescript-eslint` ^8.65.0 + `eslint-plugin-prettier` — separate configs `api/eslint.config.mjs`, `webapp/eslint.config.mjs`
- Prettier 3.9.6 — formatting enforced via `prettier/prettier: error`; root `pnpm format`
- TypeScript config: shared base `tsconfig.base.json` (target ES2022, module commonjs, strict)

## Key Dependencies

**Critical:**
- `exceljs` ^4.4.0 — API parses uploaded `.xlsx` planning files (`api/src/planning/parser.ts`)
- `jose` 6.2.8 — API JWT verification + remote JWKS fetch (`api/src/auth/auth.guard.ts`)
- `keycloak-js` 26.2.4 — webapp OIDC login flow (`webapp/src/auth/keycloak.ts`)
- `@planning-espoir/shared` — internal workspace package with domain types (`shared/src/types.ts`); consumed from `dist/`, rebuilt before api/webapp builds

**Infrastructure:**
- `@nestjs/config` 4.0.4 — env loading (`api/src/app.module.ts`)
- Multer — file upload via `FileInterceptor` (memory storage) (`api/src/planning/planning.controller.ts`, `@types/multer` dev dep)
- `@fontsource/merriweather-sans` 5.3.0, `@fontsource/nunito` 5.3.0 — self-hosted fonts imported in `webapp/src/index.css`
- `reflect-metadata` ^0.2.2, `rxjs` ^7.8.1 — NestJS runtime prerequisites
- `redux-logger` 3.0.6 — dev-only middleware (`webapp/src/store/store.ts`)

## Configuration

**Environment:**
- One root `.env` shared by both apps: API reads `../.env` via `ConfigModule.forRoot({ isGlobal: true, envFilePath: '../.env' })` (`api/src/app.module.ts`); Vite reads it via `envDir: '..'` (`webapp/vite.config.ts`). `.env.example` at root documents both sets; `.env` present locally but gitignored. No per-package env files. (`.env.prod.example` is referenced in `.gitignore` but does not exist.)
- API (runtime) vars: `PORT` (default 3000), `DATA_DIR` (default `<cwd>/data`, i.e. `api/data/` in dev), `AUTH_ENABLED`, `KEYCLOAK_ISSUER`, `KEYCLOAK_APP_GROUP`
- Webapp (build-time, inlined by Vite, passed as docker-compose build args) vars: `VITE_AUTH_ENABLED`, `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID`, `VITE_GATEWAY_URL`, `VITE_APP_GROUP`

**Build:**
- `api/nest-cli.json`, `api/tsconfig.json`, `api/tsconfig.build.json`
- `shared/tsconfig.json` (emits `dist/`)
- `webapp/tsconfig.json`, `webapp/vite.config.ts`, `webapp/pwa-assets.config.ts`, `webapp/nginx.conf` (production proxy)
- Root orchestration: `package.json` scripts (dev/build/test/lint/typecheck/format)

## Platform Requirements

**Development:**
- Node.js 22 + pnpm 11; `pnpm dev` builds `shared` first, then runs api (port 3000, `--watch`) and webapp (port 5174) concurrently. The webapp calls the API cross-origin via `VITE_API_BASE` (no Vite dev proxy); containerized dev runs behind Caddy (`docker-compose.override.yml`)
- Keycloak optional: `AUTH_ENABLED=false` + `VITE_AUTH_ENABLED=false` yields mock user `test-user` with guard off

**Production:**
- Docker Compose (`docker-compose.yml`): `api` container (node:22-alpine, `DATA_DIR=/data`, `api-data` volume) + `webapp` container (nginx:alpine, host port 8083, `/api` proxied to `api:3000` via `webapp/nginx.conf`)
- GitLab CI (`.gitlab-ci.yml`): `node:22-alpine`, stages install → lint/build → test → deploy (curl POST to `DEPLOY_WEBHOOK_URL`, `main` only)

---

*Stack analysis: 2026-08-24*
