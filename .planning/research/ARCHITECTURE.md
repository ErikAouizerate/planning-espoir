# Architecture Research

**Domain:** Personnel work-schedule planning web app (Excel upload → web calendar), NestJS + React/Redux monorepo
**Researched:** 2026-08-24
**Confidence:** MEDIUM

## Scope

Four integration patterns for the existing brownfield monorepo (`shared/` types-only package, `api/` NestJS with pure helper modules `parser.ts` + `date-rotation.ts` + flat-file storage, `webapp/` React + Redux with one custom API middleware, no thunks):

1. Sharing pure date/calendar math between API and webapp (timezone-correct local-time helpers + deterministic tests)
2. Guarding against out-of-order async responses in the custom middleware (request-id/sequence vs AbortController)
3. Upload pipeline: multer limits + nginx `client_max_body_size` consistency
4. Security layers: CORS restriction, CSP behind nginx, public health endpoint, rate limiting

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                         webapp/ (React 19 + Vite SPA)              │
│  components/ ─► store/apiMiddleware.ts ─► api/client.ts            │
│      │                                  │                          │
│      │ (1) shared/src/dates.ts: pure calendar math, consumed       │
│      │     from dist/ by BOTH webapp and api — single source of    │
│      │     truth for week rotation, month grids, date keys         │
│      └─────────────────────────┬───────────────────────────────────┘
│                                │ HTTP /api/* same-origin           │
│                                ▼ (Vite dev proxy :5174 → :3000)    │
├────────────────────────────────────────────────────────────────────┤
│                     nginx (prod, host :8083)                       │
│  serve webapp/dist  •  proxy /api/ → api:3000                      │
│  CSP header         •  client_max_body_size ≥ multer limit         │
│  add X-Forwarded-For (feeds rate limiter)                          │
│                                │                                   │
│                                ▼                                   │
├────────────────────────────────────────────────────────────────────┤
│                          api/ (NestJS, :3000)                      │
│  ThrottlerGuard (proxy-aware) ─► AuthGuard (global, @Public()      │
│  health) ─► planning.controller ─► planning.service                │
│  ─► parser.ts │ date-rotation.ts (→ moves to shared) │ storage.ts  │
│  MulterExceptionFilter: MulterError → 413 (friendly message)       │
└────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `shared/src/dates.ts` (NEW) | All pure calendar/date math used by both packages: `weekIndexForDate`, `weekdayIndex`, `monthDays`, `monthGrid`, `shiftMonth`, `isValidMonth`, `isValidDateKey`, `mondaysInMonth`, plus zoned "today" helpers | Plain exported functions over `YYYY-MM-DD` / `YYYY-MM` string keys; never `Date` objects in signatures; `now` injected as parameter for testability |
| `webapp/src/store/apiMiddleware.ts` | Single async orchestrator; gains a per-flow request-sequencing guard so stale responses are dropped before `*_SUCCESS` dispatch | Monotonic counter per flow (or latest-requested-key compare); middleware-side check, reducers stay pure |
| `api/src/planning/planning.controller.ts` | Upload endpoint; gains explicit multer `limits` (`fileSize`, `files: 1`) | `FileInterceptor('file', { limits })` + `ParseFilePipe` or exception filter mapping `MulterError` → 413 |
| `api/src/common/multer-exception.filter.ts` (NEW) | Map multer `LIMIT_FILE_SIZE` (and friends) to `PayloadTooLargeException` (413) with a user-visible French message | `@Catch(MulterError)` exception filter; without it Nest returns 500 for oversized uploads |
| `api/src/auth/auth.guard.ts` | Global guard; gains `@Public()` metadata check via `Reflector` so `/api/health` bypasses auth | `reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, class])` early-return |
| `api/src/common/throttler-behind-proxy.guard.ts` (NEW) | Rate limiting keyed on real client IP, not the nginx proxy IP | Extend `ThrottlerGuard`, read `x-forwarded-for` first value (requires nginx to forward it) |
| `api/src/main.ts` | Bootstrap; gains restricted CORS instead of bare `enableCors()` | `enableCors({ origin: [...], credentials: true })` from `CORS_ORIGINS` env |
| `webapp/nginx.conf` | Prod edge; gains CSP header, `client_max_body_size`, `X-Forwarded-For` | `add_header Content-Security-Policy ...; client_max_body_size 11m;` at server level |
| `webapp/src/api/client.ts` | Fetch wrapper; gains 413 mapping to a French message + pre-upload `file.size` check | Check size client-side before POST; parse `message` from error body |
| `shared/package.json` | Gains a test runner (vitest) for the pure date math | Smallest runner that works in a workspace; root `pnpm test` already builds shared first |

## Recommended Project Structure (deltas only)

```
shared/
├── src/
│   ├── dates.ts          # NEW: pure calendar math (moved from api + webapp, deduplicated)
│   └── index.ts          # barrel now also exports dates.ts
├── test/ or src/*.spec.ts # NEW: vitest suite for dates (TZ=Europe/Paris)
api/src/
├── common/
│   ├── multer-exception.filter.ts   # NEW: MulterError → 413
│   └── throttler-behind-proxy.guard.ts  # NEW: X-Forwarded-For aware
├── auth/auth.guard.ts    # EDIT: @Public() metadata check (Reflector)
└── main.ts               # EDIT: restricted CORS from env
webapp/
├── src/store/apiMiddleware.ts  # EDIT: request sequencing guard
├── src/api/client.ts           # EDIT: 413 handling + size pre-check
└── nginx.conf                  # EDIT: CSP, client_max_body_size, X-Forwarded-For
```

### Structure Rationale

- **`shared/src/dates.ts`:** the codebase map already found `monthDays`/`weekdayIndex` duplicated in `api/src/planning/date-rotation.ts` and `webapp/src/utils/dates.ts`. The week rotation (`weekIndexForDate`) that must stay consistent lives only in the API. One module in the already-existing shared package removes the drift risk and follows the existing "dist consumption" convention (rebuild after edit — root scripts already build shared first). Keep the API's `date-rotation.ts` as a thin re-export or delete it after the move; do not keep two copies.
- **Middleware-side stale guard:** the action contract (`*_REQUESTED → *_START/_SUCCESS/_ERROR`) and classic reducers are non-negotiable. Putting the staleness check in the middleware keeps reducers pure and centralizes the guard for all flows (schedule, config, planning) in one place — consistent with the existing "one custom middleware" pattern.
- **`common/` folder in api:** multer filter and throttler guard are cross-cutting concerns, not planning-domain; a small `common/` folder matches NestJS conventions without adding a module.

## Architectural Patterns

### Pattern 1: Shared pure date module over string keys (timezone-safe)

**What:** All calendar math operates on `YYYY-MM-DD`/`YYYY-MM` strings and integer components; no `Date` objects cross function boundaries. "Today" helpers take an injectable `now: Date` and convert to the France timezone only at the boundary via `Intl.DateTimeFormat`.

**When to use:** Any app where calendar dates are business data and must not shift with the server/CI timezone (this app's whole correctness story is "the displayed schedule matches the document").

**Trade-offs:** String math is slightly more verbose than Temporal; but Temporal is not viable on Node 22 (the project's runtime) without a ~50 KB polyfill, and browser support is ~69% (Safari missing) as of mid-2026 — a polyfill in both runtimes for date-only math is not worth it. Revisit when the API moves to Node 24/26 LTS and Safari ships Temporal.

**Key facts driving the design:**
- `new Date('YYYY-MM-DD')` parses as **UTC midnight** per spec, while `new Date('YYYY/MM/DD')` parses as **local** — the same-looking string can differ by a day depending on separator and host timezone. The existing code already avoids this trap (`${date}T00:00:00Z` + `getUTC*` getters); keep that discipline in shared.
- Date-only math on UTC midnights is DST-immune (no 23/25-hour days in UTC). Day arithmetic via `ms / 86_400_000` is only safe on UTC midnights of date-only keys.
- The **only** places the local timezone (Europe/Paris) matters are `todayKey()` and `currentMonthKey()` — the "what is today" boundary used to select the initial month. Everything else is pure date-key math.

**Example:**
```typescript
// shared/src/dates.ts
const DAY_MS = 86_400_000;
const WEEK_COUNT = 6;
export const FRANCE_TIME_ZONE = 'Europe/Paris';

/** Calendar-day key for an instant in a named zone (en-CA yields YYYY-MM-DD). */
export function zonedDateKey(now: Date, timeZone = FRANCE_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}

/** Injectable-clock variants — the only functions that read the current time. */
export function todayKey(now: Date = new Date()): string {
  return zonedDateKey(now);
}
export function currentMonthKey(now: Date = new Date()): string {
  return todayKey(now).slice(0, 7);
}

/** Pure calendar math — unchanged from today's date-rotation.ts, just relocated. */
export function weekIndexForDate(startDate: string, date: string): number { /* ... */ }
export function weekdayIndex(date: string): number { /* ... */ }
export function monthDays(month: string): string[] { /* ... */ }
export function shiftMonth(month: string, delta: number): string { /* ... */ }
export function monthGrid(month: string): (string | null)[][] { /* ... */ }
export function isValidMonth(month: string): boolean { /* ... */ }
export function isValidDateKey(dateKey: string): boolean { /* ... */ }
```

**Deterministic tests** (vitest in `shared/`):
- Run the suite with the process timezone pinned **before startup** — `TZ=Europe/Paris vitest` in the script, or `globalSetup` setting `process.env.TZ` (works in vitest; `test.env` config, `setupFiles`, and `vi.stubEnv` are **too late** — vitest issue #1575). `vi.setSystemTime` freezes the clock but does **not** change the timezone.
- Assert against fixed instants around DST transitions: `2026-03-29T01:30:00Z` (Europe/Paris spring-forward, day is 23 h) and `2026-10-25T01:30:00Z` (fall-back) — `todayKey` must still return the right local date. Never compute expected offsets with the helper under test.
- Pure functions take `now` as a parameter → tests pass fixed dates, no fake timers needed for the calculation path.

### Pattern 2: Request-sequencing stale-response guard in the custom middleware

**What:** Each async flow gets a monotonically increasing request id (module-level counter). The middleware records the id when a request starts and only dispatches `*_SUCCESS`/`*_ERROR` if the response still corresponds to the latest request. Stale responses are silently dropped — the reducer never sees them.

**When to use:** This is the canonical Redux pattern for overlapping fetches (RTK `createAsyncThunk` `requestId` semantics, netguru race-conditions writeup). It directly fixes the documented anti-pattern: rapid month navigation fires overlapping `SCHEDULE_FETCH_*` requests and a slow older response overwrites the newer month.

**Trade-offs:** "Ignore the result" vs "abort the request" — per the RTK maintainers, ignoring has the same user-visible effect as aborting and is much simpler; aborting only saves network work. For this app's small JSON payloads, ignoring is sufficient. Do **not** rely on `AbortController` alone: abort does not guarantee a rejected action arrives before the next pending action (RTK issue #3180) — ordering must be enforced by the id check regardless.

**Example:**
```typescript
// webapp/src/store/apiMiddleware.ts — extract from the switch
const flowSeq = new Map<string, number>(); // 'schedule' | 'config' | 'planning' | 'auth'

function latest(flow: string): number {
  return flowSeq.get(flow) ?? 0;
}

case SCHEDULE_FETCH_REQUESTED: {
  const month = typed.payload as string;
  const seq = latest('schedule') + 1;
  flowSeq.set('schedule', seq);
  store.dispatch(scheduleFetchStart(month));
  api.fetchSchedule(month)
    .then((data) => {
      if (latest('schedule') !== seq) return; // stale — drop
      store.dispatch(scheduleFetchSuccess(data));
    })
    .catch((err: Error) => {
      if (latest('schedule') !== seq) return;
      store.dispatch(scheduleFetchError(err.message));
    });
  break;
}
```

Simpler alternative that is sufficient for the schedule flow: before dispatching `scheduleFetchSuccess`, compare `data.month` against `store.getState().schedule.month` (the codebase map's suggestion). The sequence counter is strictly more general (covers same-month re-fetches, config, planning) for almost the same code — prefer the counter.

### Pattern 3: Layered upload size limits with one source of truth

**What:** A single `MAX_UPLOAD_BYTES` constant enforced by multer at parse time (authoritative, works identically in dev and prod), an nginx `client_max_body_size` that is **strictly larger** (multipart overhead: boundaries + fields, tens of KB), and client-side pre-checks for instant feedback.

**When to use:** Any upload pipeline behind a reverse proxy. The classic failure is dev/prod divergence: today the app has **no** nginx body limit, so nginx's default `1m` rejects in prod what dev happily accepts.

**Key facts driving the design:**
- nginx default `client_max_body_size` is **1m**; oversize → nginx returns 413 itself **before the upstream sees the body** (static HTML page the browser can't render nicely). The client must handle 413.
- Raising nginx without raising the app limit (or vice versa) is the canonical multi-layer bug (netdata guide): the failure just moves deeper.
- Multer default `fieldSize` is 1 MB — a gotcha when raising `fileSize` alone (fields count toward limits too; be explicit).
- A `MulterError` (`LIMIT_FILE_SIZE`) thrown by `FileInterceptor` is **not** mapped to 413 by Nest's built-in filter — unrecognized exceptions become **500**. Without an exception filter, an oversized upload surfaces as "Internal server error".

**Example:**
```typescript
// api/src/planning/planning.controller.ts
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024);

@Post()
@UseInterceptors(FileInterceptor('file', {
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fieldSize: 1024 * 1024 },
}))
upload(@UploadedFile() file: Express.Multer.File) { /* ... */ }
```
```nginx
# webapp/nginx.conf — server level (location-level overrides are an inheritance trap)
client_max_body_size 11m;          # > multer 10 MB: multipart overhead
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;  # feeds the rate limiter
```
```typescript
// api/src/common/multer-exception.filter.ts
@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const status = exception.code === 'LIMIT_FILE_SIZE' ? HttpStatus.PAYLOAD_TOO_LARGE : HttpStatus.BAD_REQUEST;
    const message = exception.code === 'LIMIT_FILE_SIZE'
      ? 'Le fichier est trop volumineux (10 Mo maximum).'
      : 'Téléversement invalide.';
    host.switchToHttp().getResponse().status(status).json({ statusCode: status, message });
  }
}
```
Client: check `file.size > MAX` in `UploadButton` before POST; in `client.ts`, map HTTP 413 to the same French message. Dev (Vite proxy, no nginx) and prod (nginx) then reject at the same boundary: multer.

### Pattern 4: Defense-in-depth security layers (CORS, CSP, health, throttling)

**What:** Four independent layers with different jobs — CORS restricts *browser-readable* responses, CSP blocks injected content, a public health endpoint gives ops a probe without credentials, throttling bounds abuse.

**When to use:** Always, but sized to an internal team tool. Note the honest CORS caveat (express docs): **CORS is not access control** — the server still processes every request; only browsers honor the headers. The real gate is the existing Keycloak auth. CORS restriction is hardening, not protection.

**Key facts and decisions:**
- **CORS:** the browser talks to `/api` **same-origin** in both dev (Vite proxy) and prod (nginx proxy) — the browser never makes a cross-origin request. Restrict `enableCors()` to an explicit origin list from a `CORS_ORIGINS` env (deployment origin + `http://localhost:5174`), `credentials: true`. Bare `enableCors()` is flagged by `eslint-plugin-nestjs-security` (`no-permissive-cors`) — a good lint rule to adopt.
- **CSP:** static CSR site → nonces are not possible (they need per-request generation). Tailwind v4 (`@tailwindcss/vite`) compiles to a static `.css` → `style-src 'self'` covers the stylesheet. But React **inline style attributes** (the calendar's per-person colors via `style={{...}}`) are blocked without `'unsafe-inline'` — so `style-src 'self' 'unsafe-inline'` (or the narrower `style-src-attr 'unsafe-inline'`). `script-src 'self'` works because Vite emits external JS (keycloak-js is bundled). `connect-src 'self' <keycloak-url>` and `frame-src <keycloak-url>` are required when auth is enabled (token refresh + possible silent-check iframe). Set the header at server level with `add_header ... always`; beware the nginx quirk that a location block with its own `add_header` **drops** all server-level headers — keep locations free of `add_header` (the current config is already structured this way).
- **Public health:** `@Public()` decorator (`SetMetadata('isPublic', true)`) + the existing global `AuthGuard` checks `reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, class])` and returns early — the documented NestJS pattern. This lets docker healthchecks and CI post-deploy probes hit `GET /api/health` without a token.
- **Rate limiting:** `@nestjs/throttler` v6 (official NestJS module). `ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }, { name: 'upload', ttl: 60_000, limit: 10 }])`; register the guard globally via `APP_GUARD` and tighten the upload route with `@Throttle({ upload: ... })`. **Critical proxy detail:** the base guard tracks by `req.ip` — behind nginx every user shares the proxy IP and the whole team gets throttled together. Extend `ThrottlerGuard` to read `x-forwarded-for` (first value), and add `proxy_set_header X-Forwarded-For` to nginx. In-memory storage is fine: single API instance, flat-file app, no horizontal scaling.

**Example:**
```typescript
// api/src/common/throttler-behind-proxy.guard.ts
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const xff = req.headers?.['x-forwarded-for'];
    return typeof xff === 'string' ? xff.split(',')[0].trim() : req.ip;
  }
}
```
```typescript
// api/src/app.module.ts — provider order: throttler first, auth second (both APP_GUARD)
providers: [
  { provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard },
  { provide: APP_GUARD, useClass: AuthGuard },
]
```
```nginx
# webapp/nginx.conf (server level)
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://${KEYCLOAK_HOST}; frame-src https://${KEYCLOAK_HOST}; worker-src 'self'; manifest-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';" always;
```
Throttle the health endpoint off (`@SkipThrottle()` on it) so monitoring probes never trip the limiter.

## Data Flow

### Request Flow (upload, hardened)

```
UploadButton (client-side size pre-check)
    ↓ planningUploadRequested(file)
store/apiMiddleware.ts  (records upload seq)
    ↓ api.uploadPlanning(file)
POST /api/planning (multipart)            [nginx: size gate → 413 before API if > 11m]
    ↓
Multer parse (limits: fileSize 10 MB)     [MulterError → MulterExceptionFilter → 413 FR message]
    ↓
AuthGuard (@Public? no) + ThrottlerGuard (upload limiter, X-Forwarded-For key)
    ↓
PlanningService.upload → parser → storage (atomic writes)
    ↓
200 {planning, warnings} → middleware dispatches PLANNING_UPLOAD_SUCCESS
    → re-dispatches configFetchRequested + scheduleFetchRequested(month) (seq-guarded)
```

### State Management (stale-guarded)

```
dispatch(SCHEDULE_FETCH_REQUESTED(month))
    ↓ middleware: seq = ++latest('schedule'); dispatch START(month)
    ↓ fetch /api/planning/schedule?month=…
    ├─ resolve: latest('schedule') === seq ? dispatch SUCCESS : drop (stale)
    └─ reject:  latest('schedule') === seq ? dispatch ERROR   : drop
Reducer: schedule slice { month, data, status } — never sees stale payloads
```

### Key Data Flows

1. **Shared date math:** both `PlanningService.getSchedule` (API) and `MonthCalendar`/`utils/dates` (webapp) import `weekIndexForDate`, `monthDays`, `shiftMonth`, `monthGrid` from `@planning-espoir/shared` — one implementation, zero drift. The API keeps computing `sundayWeeks` (ADR-0007); the webapp keeps formatting (labels stay webapp-only, they are presentation).
2. **Zoned "today":** `currentMonthKey()` / `todayKey()` in shared take an injectable `now` and resolve the France date via `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' })` — used by the webapp's initial month selection; the API stays zone-free (all its inputs are explicit date keys).
3. **Health probe:** docker healthcheck / CI post-deploy curl → `GET /api/health` → `@Public()` → `{ status: 'ok' }` without a token.
4. **Rate limit signal:** nginx adds `X-Forwarded-For: <client>` → API `ThrottlerBehindProxyGuard` keys per-user → 429 on upload flood → `client.ts` shows the message.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–1k users (this app: an internal team of dozens) | Current design is right: flat-file storage, single API instance, in-memory throttler, nginx edge. No changes. |
| 1k–100k users | Real bottleneck is not traffic but **storage**: flat files with last-write-wins uploads and no locking. A DB (ADR-0002 deliberately deferred) or per-writer lockfile would come first. In-memory throttler per instance is still fine single-instance. |
| 100k+ users | Multi-instance API: throttler needs shared storage (`ThrottlerStorage` interface exists); uploads need object storage; this app will never get here. |

### Scaling Priorities

1. **First bottleneck:** storage correctness under concurrent uploads (last-write-wins, 3-file sequence not transactional). Fix within the current architecture: a small write-lock around the upload persist sequence — not a database.
2. **Second bottleneck:** none foreseeable for the team size; do not over-engineer.

## Anti-Patterns

### Anti-Pattern 1: Duplicated date math with UTC/local mixing
**What people do:** copy `monthDays`/`weekdayIndex` into both packages (already happened — the two copies differ in exports), or "fix" the timezone by adding `getTimezoneOffset()` adjustments.
**Why it's wrong:** copies drift silently; offset math breaks at DST transitions (SheetJS issue #1804 documents exactly this bug: dates off by one hour/day around DST).
**Do this instead:** single `shared/src/dates.ts`; date-only string keys; UTC-midnight math; named-zone conversion only at the "today" boundary.

### Anti-Pattern 2: AbortController as the only stale-response guard
**What people do:** abort the previous fetch on new navigation and assume ordering is fixed.
**Why it's wrong:** abort does not guarantee the rejected action lands before the next pending action (RTK #3180); reducers can still receive out-of-order completions.
**Do this instead:** request-id sequencing in the middleware (drop stale), abort optionally as a bandwidth optimization only.

### Anti-Pattern 3: nginx and multer limits out of sync
**What people do:** raise `client_max_body_size` to 100 MB "to be safe", or forget it entirely (today: default 1m in prod, unlimited in dev).
**Why it's wrong:** prod rejects files dev accepts (or the reverse); the failure moves one layer deeper and the user sees a raw 413 HTML page or a 500.
**Do this instead:** one `MAX_UPLOAD_BYTES` env for multer, nginx set to limit + overhead, 413 handled in `client.ts` with a French message, CI e2e asserting the 413 path.

### Anti-Pattern 4: Bare `enableCors()` on a public network path
**What people do:** `app.enableCors()` with no origin (current state) — reflects any origin.
**Why it's wrong:** permissive CORS lets any site's JS read API responses in browsers where auth is bypassed (it is not access control, but it widens the blast radius; flagged by `no-permissive-cors`).
**Do this instead:** `CORS_ORIGINS` whitelist from env (prod origin + dev origin), `credentials: true`.

### Anti-Pattern 5: CSP that breaks the app (or never gets added)
**What people do:** set `style-src 'self'` and the calendar colors vanish (inline style attributes blocked); or put `add_header` in a `location` block and silently lose server-level headers (nginx inheritance quirk); or skip CSP entirely because "it's an internal tool".
**Why it's wrong:** either the app looks broken or the XSS mitigation is absent.
**Do this instead:** `style-src 'self' 'unsafe-inline'` (Tailwind CSS file is `'self'`; inline style attributes need `'unsafe-inline'`), all `add_header` at server level, include the Keycloak origin in `connect-src`/`frame-src`, verify the header in the prod smoke check.

### Anti-Pattern 6: Rate limiting keyed on the proxy IP
**What people do:** register `ThrottlerGuard` unchanged behind nginx.
**Why it's wrong:** every user shares the API's view of one client IP — one person's burst throttles the whole team, or the limit is raised so high it is meaningless.
**Do this instead:** `ThrottlerBehindProxyGuard` reading `x-forwarded-for` + nginx forwarding the header.

### Anti-Pattern 7: Oversized upload surfaces as 500
**What people do:** rely on `FileInterceptor` limits and watch `LIMIT_FILE_SIZE` become "Internal server error" (Nest's built-in filter only maps `HttpException`).
**Why it's wrong:** the user cannot distinguish "file too big" from "server broke".
**Do this instead:** `MulterExceptionFilter` → 413 with a French message; client pre-check for instant feedback.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Keycloak (OIDC) | Bearer JWT verified via JWKS; CSP `connect-src`/`frame-src` must include the realm origin | Already integrated; CSP is the new coupling point |
| nginx (prod edge) | Serves SPA, proxies `/api`; carries CSP, body-size gate, `X-Forwarded-For` | All three settings must be kept in sync with the API (multer limit, throttler) |
| Docker healthcheck / CI probe | `GET /api/health` without token via `@Public()` | Also used by the planned post-deploy verification in CI |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| webapp ↔ shared | ESM imports from `@planning-espoir/shared` (built `dist/`) | Rebuild shared after edits; root scripts already order this |
| api ↔ shared | CJS imports from the same built package | Value imports (not just types) now — build order is a hard dependency |
| middleware ↔ reducers | Actions only; staleness decided in middleware, reducers stay pure | Preserves the `*_REQUESTED → *_START/_SUCCESS/_ERROR` contract |
| nginx ↔ api | HTTP proxy; `X-Forwarded-For` set by nginx, consumed by throttler | If nginx stops forwarding, throttling silently keys everyone to one IP |

## Suggested Build Order (dependencies between components)

```
Phase 1: shared/src/dates.ts + vitest suite (TZ=Europe/Paris)
   → moves date-rotation.ts logic + webapp utils/dates.ts math into shared
   → unblocks timezone-correct todayKey/currentMonthKey for the webapp
   → nothing else depends on it; everything else can follow in any order
Phase 2: stale-response guard in apiMiddleware.ts (webapp-only)
   → depends on nothing new; touches the same middleware as Phase 3's error handling
Phase 3: upload pipeline (multer limits + MulterExceptionFilter + client 413 + pre-check)
   → Phase 4 shares the nginx.conf edit; do both nginx changes together
Phase 4: security layers (CORS, CSP, @Public health, throttler + nginx X-Forwarded-For)
   → nginx.conf edited here AND in Phase 3 → merge them in one phase to avoid double-touch
```

**Recommended merge:** Phase 3 + Phase 4 in one security/infra phase (both edit `webapp/nginx.conf` and `client.ts`), or strictly sequence 3 before 4 with the nginx changes accumulated. Ordering rationale: shared dates first because it is the foundation every other change composes with; the stale guard second because it is self-contained; upload + security last because they touch the deploy surface (nginx, env) and benefit from the earlier groundwork.

**Research flags:** Phase 1 needs exact test-runner wiring for the shared package (vitest in a workspace with dist-consumed types) — standard, low risk. Phase 4's CSP values (Keycloak origin, inline-style needs) must be validated against the real deployment domain at implementation time — plan should list the concrete Keycloak URL from `.env` before finalizing the header.

## Sources

- NestJS docs — file upload / multer options, ParseFilePipe, exception filters, CORS, authentication (@Public pattern): https://docs.nestjs.com/techniques/file-upload, https://docs.nestjs.com/security/cors, https://docs.nestjs.com/security/authentication (MEDIUM, Context7)
- @nestjs/throttler README + autodocs — config, guard, proxy-aware tracker: https://github.com/nestjs/throttler (MEDIUM, Context7)
- exceljs README/MODEL — ValueType enum, date1904, cell value types: https://github.com/exceljs/exceljs (MEDIUM, Context7)
- nginx ngx_http_core_module — `client_max_body_size` default 1m: https://nginx.org/en/docs/http/ngx_http_core_module.html (MEDIUM)
- Netdata — multi-layer body-size limits, 413 pipeline: https://www.netdata.cloud/guides/nginx/nginx-413-request-entity-too-large/ (MEDIUM)
- GetPageSpeed — client_max_body_size inheritance traps: https://www.getpagespeed.com/server-setup/nginx/nginx-client_max_body_size-inheritance (MEDIUM)
- multer issue #562 — fieldSize default 1 MB gotcha: https://github.com/expressjs/multer/issues/562 (MEDIUM)
- RTK createAsyncThunk docs + issues #3180/#1117 — requestId, ignore-vs-abort: https://redux-toolkit.js.org/api/createAsyncThunk, https://github.com/reduxjs/redux-toolkit/issues/3180 (MEDIUM)
- Netguru — race conditions in Redux, request-id counter: https://www.netguru.com/blog/frontend-tips-11-race-conditions-in-redux (MEDIUM)
- MDN Date constructor + style-src — UTC-midnight parsing, inline-style CSP: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date, https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src (MEDIUM)
- dev.to "Your JS Date Is Lying to You" (2026-07) — date-string pitfalls, DST, Temporal guidance: https://dev.to/gkoos/your-js-date-is-lying-to-you-20n2 (MEDIUM)
- SheetJS issue #1804 — Excel serial conversion timezone/DST bugs: https://github.com/SheetJS/sheetjs/issues/1804 (MEDIUM)
- openpyxl docs + integrate.io + libxlsxwriter — Excel serial epoch 1899-12-30, 1900/1904 systems, Lotus bug (MEDIUM)
- vitest issue #1575 + QASkills vitest timezone guide (2026-07) + SO — TZ must be set pre-start, fake timers don't change TZ: https://github.com/vitest-dev/vitest/issues/1575, https://qaskills.sh/blog/vitest-mock-date-timezone-consistently (MEDIUM)
- lilting.ch (2026-05) + @js-temporal/polyfill + fullcalendar/temporal-polyfill — Temporal: Node 26 unflagged, Node 22/24 not, browser ~69%, polyfill sizes (MEDIUM)
- MUI + CyberArk + Radix #3063 — CSP style-src vs CSS-in-JS/inline styles, static sites cannot nonce (MEDIUM)
- eslint-plugin-nestjs-security no-permissive-cors: https://eslint.interlace.tools/docs/security/plugin-nestjs-security/rules/no-permissive-cors (MEDIUM)
- boyd999/starter-react-nest + atjsh/yarn-berry-pnp-monorepo + naturalprogrammer/np-nest-react-sample — monorepo shared-package build-order patterns (MEDIUM)

---
*Architecture research for: Planning Espoir (robustness milestone)*
*Researched: 2026-08-24*
