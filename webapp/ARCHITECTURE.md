# Webapp Architecture

Technical conventions of `@planning-espoir/webapp`, written so another AI agent can modify this package without breaking its invariants. Domain rules (what the app displays, how the business data is modeled) are intentionally out of scope — see the root `AGENTS.md` and `docs/adr/` for those. This document covers **how** the code is organized and must be written.

## Context

- Yarn workspaces monorepo. This package is the browser SPA; sibling packages: `shared/` (types only, consumed from `dist/` — **rebuild it after any type change** or typecheck/tests use stale types) and `api/` (backend, port 3000).
- React 19 + Vite 8 + TypeScript `~5.9`. Dev server on port **5174**, proxying `/api` → `http://localhost:3000` (`vite.config.ts`).
- One `.env` at the **repo root**, shared by all packages; Vite reads it via `envDir: '..'`. `VITE_*` variables are **build-time** constants (inlined; passed as Docker build args). Never introduce per-package env files.
- User-facing strings are in French; code, comments, docs and tests in English.

## Directory layout (`src/`)

```
src/
├── main.tsx            # Bootstrap: auth init, then render <Provider><App/></Provider> in StrictMode
├── App.tsx             # Root component: initial data dispatches, global error/warning banners
├── api/client.ts       # Fetch wrapper + endpoint functions — the ONLY place that calls fetch
├── auth/               # Auth abstraction (config.ts, keycloak.ts, username.ts)
├── store/              # Redux: store.ts, actions.ts, reducers.ts, apiMiddleware.ts, types.ts
├── components/         # Presentational/container components, one file each, named exports
├── hooks/              # Reusable React hooks (e.g. useClickOutside)
├── utils/              # Pure helpers (e.g. dates.ts — UTC-only, ISO "YYYY-MM-DD" keys, Monday-first)
├── test/               # Test setup (setup.ts) and helpers (store.ts)
├── colors.ts           # Shared constants/pure helpers
├── index.css           # Tailwind v4 entry: font imports, @theme tokens, keyframes
└── vite-env.d.ts       # Vite client types
```

## State management — non-negotiable

Redux with **classic reducers and custom middlewares only**. RTK `configureStore` is used for store setup exclusively, with `thunk: false`. No slices, no `createReducer`, no thunks, no RTK Query, no saga/observable.

- **Actions** (`store/actions.ts`): string constants + typed action creators. Every async flow uses the uniform pattern:
  `X_REQUESTED` (dispatched by components, carries input payload) → the middleware dispatches `X_START`, calls `api/client`, then dispatches `X_SUCCESS` (payload) or `X_ERROR` (`error: string`).
  Local UI state changes use plain actions (e.g. `SELECTION_TOGGLE`). A shared `Action<T, P>` interface (`type`, `payload?`, `error?`) types all actions.
- **Reducers** (`store/reducers.ts`): one plain function per slice, combined with `combineReducers`. Async slices share the shape `{ status: 'idle' | 'loading' | 'loaded' | 'error', error: string | null, ...data }`. `START` sets `status: 'loading'` and clears `error`; `SUCCESS` sets `status: 'loaded'` and stores the payload; `ERROR` sets `status: 'error'` and the message. Reducers never cast blindly: payloads are narrowed locally.
- **Middleware** (`store/apiMiddleware.ts`): a single switch on `action.type` over `*_REQUESTED`. It dispatches `START` synchronously, then chains `.then/.catch` on the api promise. Cross-flow orchestration happens here by dispatching further `*_REQUESTED` actions on success (e.g. after a mutation succeeds, re-fetch affected data; after loading a config, apply defaults to local state). Components never await anything — they dispatch and read state.
- **Store setup** (`store/store.ts`): `configureStore({ reducer: rootReducer, middleware: (gDM) => gDM({ thunk: false }).concat(middlewares) })`; `redux-logger` (collapsed) is appended in development only. `AppStore`/`RootState` types exported from here / `types.ts`.
- **Components** use `useSelector((state: RootState) => state.<slice>)` and `useDispatch()` with action creators; no prop-drilling of store data, no local copies of server state.

### Adding a new async flow — checklist

1. Add `X_REQUESTED` / `X_START` / `X_SUCCESS` / `X_ERROR` constants + creators in `actions.ts`.
2. Add the endpoint function in `api/client.ts`.
3. Add a `case X_REQUESTED` in `apiMiddleware.ts` (dispatch START, call api, dispatch SUCCESS/ERROR, chain follow-up REQUESTED dispatches if needed).
4. Handle `X_START`/`X_SUCCESS`/`X_ERROR` in the relevant slice reducer (add a slice in `types.ts` + `reducers.ts` if new).
5. Dispatch `xRequested()` from the component; render from `status`/`error`.
6. Tests: reducer transitions, middleware dispatch sequence (mock `api/client`), component render per status.

## API layer (`api/client.ts`)

- Single private `request<T>(path, init)` wrapper; endpoint functions are thin typed wrappers. Components and middleware never call `fetch` directly.
- Injects `Authorization: Bearer <token>` from the auth module when available.
- Global status handling: `401` → trigger re-login once (module-level `redirecting` latch); `403` → `window.location.assign(gatewayUrl)` (the user is authenticated but not authorized for this app).
- Error convention: non-OK responses throw `Error` with the body’s `message` field when present, else `"Request failed (<status>)"`. The middleware turns `err.message` into the `X_ERROR` action.

## Auth (`auth/`)

- `keycloak-js` OIDC, authorization-code + PKCE, `init({ onLoad: 'login-required' })` **before** the first render (`main.tsx` bootstrap).
- The module exposes a stable `KeycloakApi` interface (`init/login/isEnabled/getToken/getUsername/signout`) with two implementations chosen at import time from `VITE_AUTH_ENABLED`: real Keycloak, or a no-op mock returning the static user `test-user`. All call sites depend on the interface, never on `keycloak-js` directly.
- `auth/config.ts` centralizes every `VITE_*` auth variable with non-empty-string fallbacks (`str()` helper). `VITE_AUTH_ENABLED` defaults to `'true'` — auth is on unless explicitly `'false'`.
- Identity displayed in the UI comes from the API (`GET /api/auth/me`) through the store, not from the token, so mock and real modes behave identically.

## UI conventions

- **Tailwind CSS v4** via `@tailwindcss/vite` (no `tailwind.config.*`). Design tokens live in `index.css` under `@theme`: `--font-sans` (Nunito) and `--font-display` (Merriweather Sans), self-hosted via `@fontsource/*`. Custom keyframes/utilities also live in `index.css`.
- Utility-first styling in JSX; slate-based neutral palette; responsive via `sm:` prefixes (mobile-first, calendar grid uses smaller text below `sm`); colored elements use inline `style` only for dynamic values (hex palette lookup), never dynamic Tailwind class names.
- Components are function components with named exports, one per file, colocated `*.spec.tsx`. Shared interactive primitives are reused (e.g. one multi-select component serves both header and modal); cross-cutting behavior goes in `hooks/`.
- Dates are pure string/UTC helpers in `utils/dates.ts`: keys `"YYYY-MM-DD"` / `"YYYY-MM"`, computed with `Date.UTC`/UTC getters to stay timezone-stable; week grid is Monday-first; French labels are table-driven constants.
- Accessibility/testing hooks: `aria-label` on icon-only buttons, `data-testid="day-<date>"` for cells targeted by tests.

## PWA

- `vite-plugin-pwa` with the default `generateSW` strategy and `registerType: 'autoUpdate'`; static assets are precached.
- Runtime caching: `NetworkFirst` (10 s network timeout, 24 h, max 16 entries) on the read-only GET API routes (`urlPattern` regex in `vite.config.ts`); mutations are never cached.
- `components/PWAUpdatePrompt.tsx` uses `useRegisterSW` from `virtual:pwa-register/react`: toast on `offlineReady` / `needRefresh`, `updateServiceWorker(true)` on accept, hourly `registration.update()`.
- nginx sends `Service-Worker-Allowed: /` so the SW controls the whole origin.

## Testing

- Vitest (jsdom, `globals: true`) configured inside `vite.config.ts`; `src/test/setup.ts` registers `@testing-library/jest-dom/vitest` and stubs `fetch` globally (`vi.stubGlobal`).
- Tests are colocated `*.spec.ts(x)` next to the unit under test. Use Testing Library (`render`, `screen`, role/text queries, `user-event`).
- Store-dependent components render inside `<Provider store={createTestStore(state)}>` — `src/test/store.ts` builds a store with the real `rootReducer`, `preloadedState`, and **no apiMiddleware** (tests drive state directly). Full-state fixtures are built by a local `makeState(overrides)` helper.
- Middleware tests mock `../api/client` (`vi.mock`) and assert the START → SUCCESS/ERROR dispatch sequence; api client tests stub `fetch` responses; pure helpers get plain unit tests.

## Tooling & quality gates

- Scripts: `dev` (vite), `build` (`tsc --noEmit && vite build` — typecheck is part of the build), `test` (`vitest run`), `lint` (`eslint src`), `typecheck`. Root equivalents orchestrate all workspaces (see root `AGENTS.md`).
- ESLint flat config: `typescript-eslint` recommended + `eslint-plugin-prettier` with **`prettier/prettier: error`** — formatting is a lint gate. Run `yarn format` at the repo root when lint fails on style.
- `tsconfig.json` extends `../tsconfig.base.json`: strict, `noUnusedLocals`, `noUnusedParameters`, `isolatedModules`, bundler module resolution, types `vitest/globals` + `@testing-library/jest-dom`.
- Docker: multi-stage `Dockerfile` — node build stage receives each `VITE_*` as `ARG`→`ENV` (they are baked into the bundle), builds `shared` then `webapp`; runtime stage is nginx serving `dist/` with SPA fallback (`try_files … /index.html`) and a `/api/` reverse proxy to the API container.

## References

- Root `AGENTS.md` — monorepo commands, env/auth setup, workflow rules.
- `docs/adr/` — architectural decision records (monorepo layout, frontend state, auth, PWA design spec under `docs/superpowers/specs/`).

Keep this file in sync when conventions change; it is committed alongside the code it documents.
