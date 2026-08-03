# Planning Espoir — Keycloak Auth Design

Date: 2026-08-03
Status: Approved

Add Keycloak OIDC authentication to the Planning Espoir app. Dev-only configuration for now. Authentication can be disabled via an environment variable in a per-package `.env`, in which case the identity is mocked from a static dev user (`test-user`). The webapp header shows the connected user's name and a signout button.

## Context

- Keycloak 26.3 runs on `http://localhost:8080`, realm `gateway` (config maintained manually by the user).
- Realm `gateway` exposes issuer `http://localhost:8080/realms/gateway`, authorization and end-session endpoints, and 2 signing keys at `/realms/gateway/protocol/openid-connect/certs`.
- Client `gateway` (public client, PKCE S256, standard flow). Users `admin@example.com` and `user@example.com` (password `test`). Group `app-planning-espoir`.
- The webapp dev server runs on port **5174**; the user has updated the Keycloak client `redirectUris`/`webOrigins` to `http://localhost:5174/*`.
- Monorepo: `shared/` (types), `api/` (NestJS, port 3000, prefix `/api`), `webapp/` (Vite, port 5174, proxy `/api` → 3000).
- The webapp store uses **plain classic reducers + `combineReducers` + a custom API middleware** (AGENTS.md non-negotiable: no Redux Thunk, no slices, no `createReducer`). The store is created with Redux Toolkit's `configureStore`, but reducers remain plain functions.

## Goals

- Authenticate users against Keycloak (dev realm `gateway`) with the authorization code + PKCE flow.
- Protect the API with JWT validation (dev config); the webapp sends the Bearer token on API calls.
- Disable authentication via a per-package `.env` variable; when disabled, use a static mock user `test-user`.
- Show the connected user's name (`preferred_username`) and a Signout button in the header.

## Non-goals

- No production Keycloak configuration (dev only).
- No group/role-based authorization (the `app-planning-espoir` group is ignored for now).
- No refresh-token background management beyond what `keycloak-js` does by default.
- No user-provisioning or realm import automation (the user maintains the realm).

## Decisions

### D-AUTH-1: End-to-end authentication (front + API validation)

The webapp authenticates with Keycloak and sends `Authorization: Bearer <token>` on every `/api/*` call. The API validates the JWT against the realm's JWKS via a NestJS guard. This is "option B" from the brainstorm.

### D-AUTH-2: `keycloak-js` for the webapp flow

The webapp uses `keycloak-js` with `init({ onLoad: 'login-required' })`: if not authenticated, the user is redirected to the Keycloak login page. Realm `gateway`, client id `gateway`, `redirectUri` resolves to `http://localhost:5174/`.

### D-AUTH-3: Per-package `.env` files (no root `.env`)

- `webapp/.env`: `VITE_AUTH_ENABLED`, `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID`.
- `api/.env`: `AUTH_ENABLED`, `KEYCLOAK_ISSUER`.
- Defaults in code when the variables are absent: `AUTH_ENABLED`/`VITE_AUTH_ENABLED` → `true`, URL → `http://localhost:8080`, realm → `gateway`, client id → `gateway`, issuer → `http://localhost:8080/realms/gateway`.
- The API loads `api/.env` via NestJS `ConfigModule.forRoot({ isGlobal: true })` (which reads `.env` from the current working directory, `api/`). The webapp reads `VITE_*` natively via Vite.

### D-AUTH-4: API guard with `jose` + `jwks-rsa` (no Passport)

A custom NestJS `AuthGuard` validates the Bearer JWT using `jose` (JWT verification with `createRemoteJWKSet` against the realm's JWKS endpoint `KEYCLOAK_ISSUER/protocol/openid-connect/certs`). `jwks-rsa` is not needed: `jose`'s `createRemoteJWKSet` fetches and caches the realm keys directly. No `@nestjs/passport`. This is "approach 1" from the brainstorm.

The guard is registered as a **global guard** (`APP_GUARD`) in `AppModule`; it internally branches on `AUTH_ENABLED` (mock pass-through vs. real validation), so it covers both `/api/auth/me` and all planning routes without per-controller decoration.

### D-AUTH-5: Identity source is the API

`GET /api/auth/me` returns `{ username }`. When auth is enabled, `username` is the token's `preferred_username`; when disabled, it is the static mock `test-user`. The webapp displays this value. The guard and `/me` share the same identity-resolution logic.

### D-AUTH-6: Signout

The Signout button calls `keycloak.logout({ redirectUri })` (full Keycloak end-session flow with `post_logout_redirect_uri` back to the app). In mock mode (auth disabled) the Signout button is disabled.

### D-AUTH-7: Webapp store follows the existing pattern

The `auth` state is a **plain classic reducer** added to the existing `combineReducers` — no `createSlice`, no `createReducer`, no Redux Thunk. Fetching `/api/auth/me` goes through the existing custom API middleware with request/success/error action creators.

### D-AUTH-8: Dev port

The webapp stays on port **5174**. The user updates the Keycloak client `redirectUris`/`webOrigins` accordingly (already done by the user).

### D-AUTH-9: Group-based access control

The API guard authorizes only users belonging to the `app-planning-espoir` Keycloak group. The realm's `groups` protocol mapper puts the group list in the token's `groups` claim; the guard checks that claim contains the configured group and otherwise rejects with **403** (`ForbiddenException`). The required group is read from the `KEYCLOAK_APP_GROUP` env var (`api/.env`, default `app-planning-espoir`). In mock mode (auth disabled), the guard passes regardless of groups. This applies to all API routes via the global guard.

### D-AUTH-10: Gateway redirect on 403

This application is the "gateway frontend" that tells a user which applications they can access. When a logged-in user is rejected by the guard (**403**, not in the required group), the webapp redirects to the gateway URL (`http://localhost:5173`) so the user can see their accessible applications. The gateway URL and the app group name are read from env vars: `VITE_GATEWAY_URL` (default `http://localhost:5173`) and `VITE_APP_GROUP` (default `app-planning-espoir`) in `webapp/.env`. The webapp client performs `window.location.assign(gatewayUrl)` on a 403 when auth is enabled; no redirect in mock mode.

## Architecture

```
webapp (5174)
  keycloak-js init({ onLoad: 'login-required' }, realm 'gateway', client 'gateway')
  ├─ token on every /api/* (Authorization: Bearer)
  ├─ GET /api/auth/me  → { username }
  ├─ 403 (not in app group) → redirect to gateway (VITE_GATEWAY_URL)
  └─ Signout → keycloak.logout({ redirectUri }) → end_session (realm)

api (3000)
  AuthGuard (custom, jose + jwks-rsa)
    AUTH_ENABLED=true  → validate JWT vs realm JWKS
                          → check groups claim contains KEYCLOAK_APP_GROUP (else 403)
                          → request.user = { username }
    AUTH_ENABLED=false → pass, request.user = { username: 'test-user' }
  AuthModule: GET /api/auth/me → { username }
  PlanningModule routes protected by the guard when enabled
```

### Webapp structure

- `webapp/src/auth/keycloak.ts` — keycloak-js wrapper: `isEnabled()`, `init()`, `getToken()`, `getUsername()`, `signout()`. When `VITE_AUTH_ENABLED=false`, no keycloak init; `getUsername()` returns `test-user`.
- `webapp/src/auth/config.ts` — reads `import.meta.env.VITE_*` with defaults.
- `webapp/src/store/authActions.ts` — action creators `authFetchRequested`, `authFetchStart`, `authFetchSuccess`, `authFetchError` (plain action objects, following the existing `actions.ts` pattern).
- `webapp/src/store/reducers.ts` — add `authReducer` to `combineReducers`; new slice type `AuthState { status, username, error }`.
- `webapp/src/store/apiMiddleware.ts` — handle `AUTH_FETCH_REQUESTED`: call `GET /api/auth/me`, dispatch success/error.
- `webapp/src/api/client.ts` — attach `Authorization: Bearer` when a token is available; on 401 and auth enabled, re-init Keycloak (login redirect).
- `webapp/src/main.tsx` — if auth enabled, `await keycloak.init(...)` (ready) before mounting React; in mock mode, mount directly.
- `webapp/src/App.tsx` — dispatch `authFetchRequested()` on mount.
- `webapp/src/components/Header.tsx` — show `auth.username`; Signout button (disabled in mock mode) calling `signout()`.
- `webapp/src/store/types.ts` — add `AuthState` and `auth` to `RootState`.

### API structure

- `api/src/auth/auth.module.ts` — provides `AuthGuard`, `AuthController`, config (issuer).
- `api/src/auth/auth.controller.ts` — `GET /api/auth/me` → `{ username }` (from `request.user`).
- `api/src/auth/auth.guard.ts` — custom `CanActivate` guard registered as `APP_GUARD`: if `AUTH_ENABLED=false`, set `request.user = { username: 'test-user' }` and pass; else validate Bearer JWT via `jose` `createRemoteJWKSet` against `KEYCLOAK_ISSUER/protocol/openid-connect/certs`, set `request.user = { username: preferred_username }`.
- `api/src/auth/identity.ts` — shared helper `resolveUsername(token | null): string` returning `preferred_username` or `test-user`.
- `api/src/app.module.ts` — import `ConfigModule.forRoot({ isGlobal: true })` and `AuthModule`; register `AuthGuard` as `APP_GUARD`.

## Configuration

`webapp/.env`:

```
VITE_AUTH_ENABLED=true
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=gateway
VITE_KEYCLOAK_CLIENT_ID=gateway
VITE_GATEWAY_URL=http://localhost:5173
VITE_APP_GROUP=app-planning-espoir
```

`api/.env`:

```
AUTH_ENABLED=true
KEYCLOAK_ISSUER=http://localhost:8080/realms/gateway
KEYCLOAK_APP_GROUP=app-planning-espoir
```

Realm `gateway` (user-maintained): client `gateway` public, PKCE S256, `redirectUris`/`webOrigins` → `http://localhost:5174/*`; users `admin@example.com` / `user@example.com` (password `test`).

## Error handling

- Enabled auth, missing/invalid/expired token → **401** `{ statusCode, message }`.
- Enabled auth, valid token but user not in the configured group → **403**; the webapp redirects to the gateway URL (`VITE_GATEWAY_URL`).
- Enabled auth, realm/JWKS unreachable or key resolution failure → **503**.
- Webapp client on 401 with auth enabled → re-run keycloak login flow (redirect to Keycloak).
- Mock mode: no token sent, guard passes, identity is `test-user`; no redirect on 403.

## Testing

- **API unit**: `AuthGuard` — enabled with a valid token (mocked JWKS/key verify) in the configured group sets `request.user.username` from `preferred_username`; valid token not in the group → 403; missing `groups` claim → 403; a custom `appGroup` option is honored; invalid/missing token → 401; disabled → passes with `test-user`. `identity` helper: token→`preferred_username`, null→`test-user`.
- **API e2e**: `GET /api/auth/me` with `AUTH_ENABLED=false` → `{ username: 'test-user' }`; with `AUTH_ENABLED=true` and no/invalid token → 401; planning routes 401 when enabled + no token, 200 when disabled.
- **Webapp**: `authReducer` (request/success/error transitions); `Header` shows username and renders a disabled Signout in mock mode; `keycloak.ts` mock-mode behavior (`getUsername()` → `test-user`, `signout()` no-op); client attaches the Bearer header when a token is present and redirects to `authConfig.gatewayUrl` on a 403 when auth is enabled (no redirect when disabled); `authConfig` exposes `gatewayUrl` and `appGroup` with defaults.
- Lint + typecheck on both packages; root command set unchanged.

## Open items

- The realm client config update (`redirectUris` → 5174) is performed manually by the user.
