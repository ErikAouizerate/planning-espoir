# External Integrations

**Analysis Date:** 2026-08-24

## APIs & External Services

**Identity / Auth (the only external service):**
- Keycloak (OIDC provider, default realm `gateway`) — used by both apps:
  - API verifies bearer tokens: `createRemoteJWKSet` at `${KEYCLOAK_ISSUER}/protocol/openid-connect/certs`, then `jwtVerify` enforcing `issuer` and requiring `groups` claim to include `KEYCLOAK_APP_GROUP` (default `app-planning-espoir`); username from `preferred_username` claim (`api/src/auth/auth.guard.ts`). JWKS is fetched remotely on demand.
  - Webapp: `keycloak-js` 26.2.4 — `init({ onLoad: 'login-required' })`, `login()`, `logout({ redirectUri: window.location.origin })`; token attached as `Authorization: Bearer` on every API call (`webapp/src/auth/keycloak.ts`, `webapp/src/api/client.ts`)
  - Auth: `KEYCLOAK_ISSUER` + `KEYCLOAK_APP_GROUP` (API runtime), `VITE_KEYCLOAK_URL` + `VITE_KEYCLOAK_REALM` + `VITE_KEYCLOAK_CLIENT_ID` (webapp build-time)
- Gateway (external auth gateway / reverse proxy): on HTTP 403, webapp redirects the browser to `VITE_GATEWAY_URL` (`webapp/src/api/client.ts:26-29`) — the gateway is expected to handle the access-denied flow.

## Data Storage

**Databases:**
- None. No DB client in either package. Persistence is flat files under `DATA_DIR` (default `<cwd>/data`, i.e. `api/data/` in dev — gitignored):
  - `planning.xlsx` — raw uploaded file
  - `planning.json` — normalized parse result (`people`, `warnings`)
  - `config.json` — `startDate`, `defaultNames`, `fileName`
  - Written atomically (tmp file + rename) by `api/src/planning/storage.ts`; directory created on demand.

**File Storage:**
- Local filesystem only (no S3/object storage). In Docker, the `api-data` volume is mounted at `/data` (`docker-compose.yml`).

**Caching:**
- None server-side.
- Client-side: Workbox runtime cache for GET `/api/planning(/schedule|/config)?` — `NetworkFirst`, max 16 entries, 24 h TTL, 10 s network timeout (`webapp/vite.config.ts:43-59`).

## Authentication & Identity

**Auth Provider:**
- Keycloak OIDC (JWT bearer). Global `APP_GUARD` via `AuthGuard` (`api/src/app.module.ts:16`). Group-based authorization via the `groups` JWT claim.
- Disabled mode (dev): `AUTH_ENABLED=false` / `VITE_AUTH_ENABLED=false` → guard off, mock user `test-user` (`api/src/auth/identity.ts`, `webapp/src/auth/keycloak.ts`).
- Implementation: `jose` on the API (no `@nestjs/jwt` or passport), `keycloak-js` SPA adapter on the webapp. Session state lives in Keycloak's browser storage; the API is stateless.

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry/LogRocket/etc.).

**Logs:**
- API: NestJS built-in console logger (no custom logging). Webapp: `redux-logger` in development mode only (`webapp/src/store/store.ts:10-16`).

## CI/CD & Deployment

**Hosting:**
- Self-hosted Docker via `docker-compose.yml`: api (node:22-alpine) + webapp (nginx:alpine, host port 8083); nginx proxies `/api` → `api:3000` (`webapp/nginx.conf`). API data persisted in `api-data` volume.

**CI Pipeline:**
- GitLab CI (`.gitlab-ci.yml`): `node:22-alpine`, cache on the pnpm store (`.pnpm-store/`); stages: install (`pnpm install --frozen-lockfile`) → lint ∥ build → test → deploy (`main` only).
- Deploy trigger: curl POST to `DEPLOY_WEBHOOK_URL` (GitLab CI variable) with a simulated GitLab push-hook JSON payload (`.gitlab-ci.yml:63-68`).

## Environment Configuration

**Required env vars:** (documented in `.env.example`)
- API (runtime): `AUTH_ENABLED`, `KEYCLOAK_ISSUER`, `KEYCLOAK_APP_GROUP`, `DATA_DIR`, `PORT`
- Webapp (build-time): `VITE_AUTH_ENABLED`, `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID`, `VITE_GATEWAY_URL`, `VITE_APP_GROUP`
- CI-only: `DEPLOY_WEBHOOK_URL` (not in `.env.example`)

**Secrets location:**
- Single root `.env` (gitignored, present locally) consumed by both apps; docker-compose uses `env_file: .env` for the api and passes `VITE_*` vars as webapp build args.

## Webhooks & Callbacks

**Incoming:**
- None — the API exposes no webhook endpoints.

**Outgoing:**
- CI deploy stage POSTs a fake GitLab push-hook payload to `DEPLOY_WEBHOOK_URL` on `main` (`api` has no app-level outgoing webhooks).

---

*Integration audit: 2026-08-24*
