# Codebase Concerns

**Analysis Date:** 2026-08-24

## Tech Debt

**Parser row-index identity has silent failure modes:**
- Issue: Person identity is by row index within the S1 block (ADR-0004), but `parsePeopleRows` drops rows silently in two cases: (1) rows beyond the S1 count in later weeks are ignored (`rows.forEach((rp, i) => { const person = people[i]; if (!person) return; ... })` in `api/src/planning/parser.ts:210-214`), and (2) if a later week block has fewer rows than S1, the remaining S1 people keep empty `{type:'none'}` cells for that week with no warning.
- Files: `api/src/planning/parser.ts:207-215`
- Impact: A person added/removed mid-file shifts every row below it — all subsequent people silently display each other's shifts (off-by-one) with zero warnings. Data corruption with no feedback.
- Fix approach: Emit a `ParsingWarning` when week-block row counts differ from S1's; consider matching by name (canonicalized) with row-index fallback.

**Role detection regex collides with real names:**
- Issue: `ROLE_RE = /^(ES|TISF|Educ)/i` (`api/src/planning/parser.ts:12`) is tested against every non-empty name cell. A person whose name starts with "ES", "Educ", or "TISF" (e.g., "Estelle", "Eduardo") is treated as a role row, swallowed as the previous person's role, and dropped from the person list — corrupting the index-based identity for everyone after them.
- Files: `api/src/planning/parser.ts:117-121`
- Impact: Missing persons and shifted schedules, no warning. A real planning with an "Estelle …" entry would silently break.
- Fix approach: Only treat a row as a role when it has no shift content in the day columns, or move role detection to a dedicated column/position.

**Timezone handling is UTC-based for a French-only audience:**
- Issue: `currentMonthKey()` and `todayKey()` use `getUTC*` (`webapp/src/utils/dates.ts:3-13`), and `ConfigModal` uses `new Date().toISOString()` (`webapp/src/components/ConfigModal.tsx:26`). For France (UTC+1/CEST UTC+2), between 00:00–02:00 local time the app highlights the *previous* day as "today", and on the 1st of the month shows the *previous* month until 01:00–02:00.
- Files: `webapp/src/utils/dates.ts:3-13`, `webapp/src/components/ConfigModal.tsx:26`
- Impact: Wrong "today" highlight and wrong initial month for up to 2 hours per day — exactly when shift workers look at their schedule.
- Fix approach: Use local-time getters (`getFullYear`, `getMonth`, `getDate`) or `Intl.DateTimeFormat` with the user's timezone.

**Unvalidated `startDate` from upload can brick the schedule endpoint:**
- Issue: `upload()` stores `parsed.startDate` directly (`api/src/planning/planning.service.ts:48-50`); `extractStartDate` validates day ≤ 31 and month name but not day-in-month (`api/src/planning/parser.ts:164-177`). A sheet named "…31 février…" or "…31 avril…" stores `2026-02-31`. `getSchedule` then computes `Date.parse('2026-02-31T00:00:00Z')` → `NaN` → `weekIndexForDate` returns `NaN` → `p.weeks[NaN]` is `undefined` → uncaught `TypeError` → 500 on every schedule request until the user manually fixes the date in ConfigModal.
- Files: `api/src/planning/parser.ts:164-177`, `api/src/planning/planning.service.ts:46-51`, `api/src/planning/date-rotation.ts:17-23`
- Impact: Whole calendar broken after an upload whose sheet name contains an impossible date; only a manual config correction recovers it.
- Fix approach: Reuse `isValidDateKey` (or `Date.UTC` round-trip) in `extractStartDate`; reject or null the startDate when invalid.

**Year heuristic in `extractStartDate`:**
- Issue: Year is taken from the first `(20\d{2})` match in the upload filename, else current year (`api/src/planning/parser.ts:174-175`). Filenames containing multiple years ("planning_2025_2026.xlsx") or no year pick the wrong one silently.
- Files: `api/src/planning/parser.ts:174-175`
- Impact: Schedule rotated to the wrong week with no warning; ADR-0003 documents the fallback but not the ambiguity.
- Fix approach: Prefer the year closest to "now", or emit a warning when multiple candidates exist.

**Loose action typing across the store:**
- Issue: `Action` has `[key: string]: unknown` (`webapp/src/store/actions.ts:37-42`), the middleware casts `action as { type: string; payload?: unknown }` (`webapp/src/store/apiMiddleware.ts:36`), and every reducer casts payloads with `as` (`webapp/src/store/reducers.ts:69-72`, `99-107`, `138`). Nothing stops a wrong payload type at compile time.
- Files: `webapp/src/store/actions.ts`, `webapp/src/store/apiMiddleware.ts`, `webapp/src/store/reducers.ts`
- Impact: Type-checked refactors can still ship runtime bugs; the `Action` union is effectively untyped `any`-ish.
- Fix approach: Discriminated union on the literal `type` field, or typed action creators + `ReturnType` inference (RTK `prepare`/action creators are already partially there).

**Dead/vestigial code:**
- Issue: `colorsReducer` returns state unchanged (`webapp/src/store/reducers.ts:177-179`); the palette lives only in `webapp/src/colors.ts`; `resolveUsername` in `api/src/auth/identity.ts:3-5` duplicates the `?? MOCK_USERNAME` fallback inline in the guard (`api/src/auth/auth.guard.ts:63`).
- Files: `webapp/src/store/reducers.ts:177-179`, `api/src/auth/identity.ts`
- Impact: Confusing for maintainers; no functional harm.
- Fix approach: Remove the reducer or fold the palette into the reducer state; drop the unused helper.

**Domain logic duplicated outside `shared/`:**
- Issue: `weekdayIndex`/`monthDays` exist in both `api/src/planning/date-rotation.ts:25-37` and `webapp/src/utils/dates.ts:44-61` — the `shared/` package holds only types. Two copies of the same Monday-first logic can drift.
- Files: `api/src/planning/date-rotation.ts`, `webapp/src/utils/dates.ts`, `shared/src/types.ts`
- Impact: Divergent behavior risk (e.g., one copy "fixed" for local time, the other not).
- Fix approach: Move date-rotation helpers into `@planning-espoir/shared` (builds to `dist/`, already consumed by both).

**Docker runtime image ships devDependencies:**
- Issue: The runtime stage copies the full `node_modules` (root and `api/`) from the build stage without a production-only install (`api/Dockerfile`).
- Files: `api/Dockerfile`
- Impact: Larger image (~hundreds of MB), more attack surface (jest, ts-node, nest CLI, typescript in prod).
- Fix approach: a `prod-deps` stage running `pnpm install --frozen-lockfile --prod`, or `pnpm deploy`; copy only the production tree into the runtime stage.

## Known Bugs

**Rapid month navigation can display stale data under the wrong month:**
- Symptoms: Switching months quickly (‹ › buttons in `MonthCalendar`) fires overlapping `SCHEDULE_FETCH_REQUESTED`; responses resolve out of order — the older month's `days` overwrite the newer month's, displayed under the new month label.
- Files: `webapp/src/store/apiMiddleware.ts:68-74`, `webapp/src/components/MonthCalendar.tsx:22-40`, `webapp/src/store/reducers.ts:93-126`
- Trigger: Two month fetches in flight; slow network; the second request resolves first.
- Workaround: None visible to the user — a reload fixes it.
- Fix approach: Track the latest requested month (e.g., a request-sequence counter or AbortController) and ignore stale responses in the middleware.

**Schedule error leaves stale days on screen:**
- Symptoms: `SCHEDULE_FETCH_ERROR` sets `status: 'error'` but keeps the previous `days`/`sundayWeeks` (`webapp/src/store/reducers.ts:117-122`). `MonthCalendar` renders `days` whenever non-null, so the previous month's calendar stays visible with an error banner above it — mismatched month label vs. content.
- Files: `webapp/src/store/reducers.ts:93-126`, `webapp/src/components/MonthCalendar.tsx:16-17`, `webapp/src/App.tsx:41-45`
- Trigger: Any failed schedule fetch after a successful one.
- Fix approach: Clear `days`/`sundayWeeks` on error, or render the error instead of stale data.

**Numeric time cells are silently ignored:**
- Symptoms: A day cell containing a plain Excel number (e.g., `9.5`, no time format) counts as "has content" (`raw.some(...)`) but `timeValueToHhmm` only handles `Date` and `string` (`api/src/planning/parser.ts:58-71`). Result: cell becomes `{type:'none'}` with no warning — the warning loop only checks strings (`parser.ts:152-158`).
- Files: `api/src/planning/parser.ts:58-71, 135-161`
- Trigger: Sheets where some time cells are entered as numbers instead of time-formatted values.
- Fix approach: Handle `number` values (Excel serial fraction → HH:MM) or emit a warning for numeric non-time values.

**`redirecting` flag never resets:**
- Symptoms: `redirecting` (`webapp/src/api/client.ts:15`) is set `true` on the first 401/403 and never reset. In the same page session, any later 401 (e.g., token expires while the app stays open) will not trigger the login redirect again — the user just gets error banners.
- Files: `webapp/src/api/client.ts:22-29`
- Trigger: Token expiry mid-session (access tokens typically last 5 min; keycloak-js refresh failure).
- Fix approach: Reset `redirecting` on success, on visibility change, or after a timeout.

**Config fetch fires twice on startup:**
- Symptoms: `App.tsx` dispatches `configFetchRequested()` once on mount and again when `planning.people?.length` first becomes non-undefined (`webapp/src/App.tsx:28-30`), plus `apiMiddleware` re-fetches config after every upload. Duplicate GETs and duplicated default-name selection side effects.
- Files: `webapp/src/App.tsx:22-30`
- Trigger: Every page load.
- Fix approach: Single effect keyed on `planning.status` transition to `'loaded'`, or fetch config once and refetch only on upload success.

## Security Considerations

**No upload size limit — memory-exhaustion DoS:**
- Risk: `FileInterceptor` uses multer's default memory storage with **no limits** (`api/src/planning/planning.controller.ts:20-24`; no multer options anywhere). Any authenticated user (or unauthenticated, if `AUTH_ENABLED=false`) can POST a huge file and exhaust API RAM; concurrent uploads amplify it. A zip-bomb `.xlsx` also makes `exceljs` parse arbitrarily deep.
- Files: `api/src/planning/planning.controller.ts`, `api/src/planning/planning.service.ts:30-57`
- Current mitigation: None in the API. In the Docker deployment, nginx's default `client_max_body_size` (1 MB) incidentally caps it — with 413 errors.
- Recommendations: Configure `FileInterceptor` limits (`fileSize`, e.g. 5 MB), validate mimetype/extension server-side, and set `client_max_body_size` explicitly in `webapp/nginx.conf` to match.

**CORS wide open:**
- Risk: `app.enableCors()` with no origin restriction (`api/src/main.ts:7`) — every origin can call the API. With bearer-token auth the practical exposure is limited (no cookies are sent automatically), but if `AUTH_ENABLED=false` in any deployment, any website can read schedules and overwrite the planning.
- Files: `api/src/main.ts:7`
- Current mitigation: Auth guard when enabled; same-origin proxying in prod (nginx serves both).
- Recommendations: Restrict `origin` to the deployed webapp origin (or `reflectOrigin` behind nginx), or drop CORS entirely in prod since nginx proxies same-origin.

**No rate limiting on any endpoint:**
- Risk: Upload/config endpoints can be hammered (disk fill via repeated uploads, CPU via repeated parses).
- Files: `api/src/app.module.ts`, `api/src/planning/planning.controller.ts`
- Current mitigation: None.
- Recommendations: `@nestjs/throttler` on the upload route, or nginx `limit_req`.

**Keycloak JWKS fetched over plain HTTP by default:**
- Risk: Default issuer is `http://localhost:8080/realms/gateway` (`api/src/auth/auth.module.ts:14`); if production `.env` leaves `KEYCLOAK_ISSUER` unset or set to `http://…`, the JWKS (public keys) are fetched over cleartext — a MITM can substitute keys and forge tokens. Also `KEYCLOAK_ISSUER` is never validated at startup: with `AUTH_ENABLED=true` and a bad/missing issuer, every request 503s (fail-safe but confusing).
- Files: `api/src/auth/auth.module.ts:12-16`, `api/src/auth/auth.guard.ts:30-38, 55`
- Current mitigation: Fail-safe default (`AUTH_ENABLED` defaults to `true`).
- Recommendations: Validate issuer is `https://` (or localhost) at startup; fail fast with a clear message.

**No security headers / CSP on the webapp:**
- Risk: `webapp/nginx.conf` sets only `Service-Worker-Allowed`; no `Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy`, etc. The app renders only React-escaped content, so exploitability is low, but clickjacking and injected-resource vectors are open.
- Files: `webapp/nginx.conf`
- Recommendations: Add a minimal CSP (`default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'` — required by inline Tailwind styles) and frame-ancestors.

**`/api/health` is behind the auth guard:**
- Risk: `APP_GUARD` is global (`api/src/app.module.ts:16`), so `GET /api/health` requires a bearer token when auth is enabled — load balancers / uptime monitors without tokens get 401.
- Files: `api/src/app.module.ts`, `api/src/app.controller.ts`
- Recommendation: `@Public()` decorator or route-specific exclusion for health.

**No secrets in repo** — `.env` is gitignored (`/.gitignore:7-9`), `.env.example` is committed as documentation. Docker compose reads `env_file: .env` on the host (`docker-compose.yml:6`). No committed credentials found. (Note: `.env` file exists at repo root — contains environment configuration, contents not inspected.)

## Performance Bottlenecks

**Schedule payload is O(people × days) with full person data per day:**
- Problem: `getSchedule` builds `days[date] = stored.people.map(p => ({name, colorIndex, cell}))` (`api/src/planning/planning.service.ts:81-85`) — the same name/color repeated for every person on every day of the month, even unselected people. A 50-person planning × 31 days ≈ 1550 objects per request, re-serialized on every month navigation.
- Files: `api/src/planning/planning.service.ts:73-87`
- Cause: No projection/filtering by selected persons; client re-filters after download (`webapp/src/components/MonthCalendar.tsx:53-54`).
- Improvement path: Accept `?people=` filter server-side, or restructure as `people[]` + `days[date] = cellIndex[]` referencing the person array.

**Excel sheet scan is row-by-row via `getCell`:**
- Problem: `findPlanningSheet`/`findWeekBlocks`/`parsePeopleRows` call `ws.getCell(r, c)` cell-by-cell (`api/src/planning/parser.ts:73-96, 105-126`); `hasWeekLabel` scans every row of every sheet. Fine for typical plannings (<1k rows), quadratic-ish if sheets have many empty styled rows.
- Files: `api/src/planning/parser.ts:73-96`
- Improvement path: Iterate `ws.eachRow` with `row.values` or `getSheetValues()` once; skip blank rows by row index metadata.

**No caching of schedule responses:**
- Problem: Every month navigation re-hits the API; with auth enabled, each request also triggers a JWKS verification (cached by `createRemoteJWKSet`, so this part is cheap).
- Files: `webapp/src/store/apiMiddleware.ts:68-74`
- Improvement path: Client-side cache keyed by month (invalidated on upload/config change), or `Cache-Control` headers.

## Fragile Areas

**Parser heuristics (`api/src/planning/parser.ts`, 229 lines of regex + column-index magic):**
- Files: `api/src/planning/parser.ts`
- Why fragile: The whole format is encoded as hard-coded constants (`DAY_COLUMN_GROUPS` column indexes `2..29`, `WEEK_LABEL_RE`, `TIME_TEXT_RE`, `RH_RE`, `FRENCH_MONTHS`). Any change in the source Excel template (column layout, separators, new day columns) silently misparses. Identity by row index amplifies small errors into whole-column shifts.
- Safe modification: Every parser change needs the workbook fixture (`api/test/helpers/planning-workbook.ts`) + `parser.spec.ts` extended; keep the warning path for unrecognized cells — it is the only user-visible signal.
- Test coverage: Good for the known cases (11 unit tests + e2e), but no tests for role-regex name collisions, row-count mismatch, numeric time cells, or impossible dates.

**Flat-file storage (`api/src/planning/storage.ts`):**
- Files: `api/src/planning/storage.ts`
- Why fragile: `readJson` swallows *all* errors — a corrupted `planning.json`/`config.json` (partial write, manual edit, disk error) silently becomes "no planning uploaded" (`storage.ts:54-61`). No logging. `writeJson` uses tmp+rename (good) but no `fsync` and no backup: a crash between `savePlanningXlsx` and `savePlanningJson` (`planning.service.ts:41-45`) leaves xlsx and json from different uploads. Two concurrent uploads race on the same `planning.json.tmp` name.
- Safe modification: Keep the atomic rename; add error logging and a startup corruption check; consider `A/B` rotation of `planning.json` or a single combined write.

**`DATA_DIR` default depends on process cwd:**
- Files: `api/src/planning/planning.module.ts:13`
- Why fragile: `resolve(process.cwd(), 'data')` — running `node dist/main.js` from the repo root vs. from `api/` uses different data directories; data "disappears" from the app's perspective. Docker sets `DATA_DIR=/data` explicitly (`docker-compose.yml:8`), masking the issue in prod.
- Safe modification: Default to a path relative to the module file (`__dirname`) or require `DATA_DIR` in production.

**Auth bootstrap blocks rendering (`webapp/src/main.tsx`):**
- Files: `webapp/src/main.tsx:11-14`
- Why fragile: `await keycloak.init()` (with `onLoad: 'login-required'`, `webapp/src/auth/keycloak.ts:39`) happens *before* React renders. If Keycloak is unreachable or slow, the user gets a blank page for the timeout duration; if `init()` rejects, the app never renders (unhandled promise rejection).
- Safe modification: Render a loading/error shell first, mount the app with auth-degraded state, or add a timeout + retry with a "Keycloak unavailable" screen.

**Stale `shared/dist` types (workspace build order):**
- Files: `shared/package.json` (`main: dist/index.js`), root `package.json` scripts
- Why fragile: `api`/`webapp` consume `@planning-espoir/shared` from `dist/`; editing `shared/src/types.ts` without rebuilding silently typechecks against stale types (root scripts build first, but `pnpm --filter … run test`/`typecheck` invoked directly do not). Documented in `AGENTS.md`, still a footgun.

**Webapp PWA cache vs. freshness promise:**
- Files: `webapp/vite.config.ts:43-58`
- Why fragile: The service worker caches `/api/planning`, `/api/planning/schedule`, `/api/planning/config` GETs with `NetworkFirst`, `networkTimeoutSeconds: 10`, `maxAgeSeconds: 86400` (`vite.config.ts:43-58`). The product promise (AGENTS.md/ADR-0002) is "the displayed schedule always matches the latest uploaded document": after an upload from another device, a slow network (>10 s) or offline mode silently serves a stale planning for up to 24 h. Workbox never invalidates the `planning-api` cache on `POST /api/planning`.
- Safe modification: Keep the PWA cache but reduce `maxAgeSeconds` to a few minutes, drop `networkTimeoutSeconds`, or bypass the cache for `/api/planning` while keeping it for static assets.

**Nginx default body size conflicts with uploads:**
- Files: `webapp/nginx.conf`
- Why fragile: `client_max_body_size` is unset → nginx default 1 MB. Real plannings with embedded images/history exceed this; uploads fail with a bare 413 (no French error page, no API message). Dev (no nginx) has *no* limit — dev/prod behavior diverges.
- Safe modification: Set `client_max_body_size 10m;` and a matching API-side multer limit.

## Scaling Limits

**Single-planning storage model:**
- Current capacity: One planning at a time — `planning.xlsx`, `planning.json`, `config.json` under `DATA_DIR` (`api/src/planning/storage.ts`). One instance, one volume (`docker-compose.yml:10`).
- Limit: Any second planning (history, multiple teams, versioning) requires a storage redesign. Concurrent uploads race (see Fragile Areas).
- Scaling path: Add an id/timestamp dimension to storage; the API is otherwise stateless and could be horizontally scaled behind nginx with a shared volume.

**Excel parse memory:**
- Current capacity: Bounded only by upload size (unlimited) and exceljs' in-memory model (`parser.ts:180-182`).
- Limit: A large workbook (or zip bomb) can exhaust container RAM; no worker/streaming.
- Scaling path: Multer size limit + exceljs streaming reader (`workbook.xlsx.read` with streams) for large files.

**Deploy pipeline has no post-deploy verification:**
- Files: `.gitlab-ci.yml:56-70`
- Risk: Deploy is a fire-and-forget curl POST to `DEPLOY_WEBHOOK_URL`; a failed deploy (webhook down, build rejected) still exits 0 if curl succeeds; nothing verifies the new version serves `/api/health` or the webapp.
- Fix approach: Poll the deployed `health` endpoint after deploy, or have the webhook receiver return the deploy result and fail the job on non-2xx.

## Dependencies at Risk

**exceljs (^4.4.0):**
- Risk: The library is effectively in maintenance mode (low release cadence); it is the only component parsing untrusted input (`api/src/planning/parser.ts:182`). Any new Excel-format edge or advisory requires a fork or replacement.
- Impact: Parser bugs cannot be fixed upstream; security advisories may go unpatched.
- Migration plan: Keep pinned `^4.4.0`, watch advisories; long-term evaluate `xlsx`/`read-excel-file` or SheetJS (license review needed) if exceljs stalls.

**keycloak-js (26.2.4) and jose (6.2.8):**
- Risk: Low — both actively maintained and pinned. jose is pinned exactly (good). keycloak-js 26 tracks the Keycloak server line; upgrading Keycloak server major versions may require a matching keycloak-js bump.
- Impact: None currently.
- Migration plan: None needed; keep exact pins.

**nginx:alpine / node:22-alpine images:**
- Risk: Untagged floating tags (`api/Dockerfile:1,12`, `webapp/Dockerfile:1,27`) — builds are not reproducible; a base-image update can break the build or change behavior silently.
- Fix approach: Pin digests or minor versions (e.g., `node:22.14-alpine`).

## Missing Critical Features

**Upload progress / size feedback:**
- Problem: `UploadButton` gives no feedback during upload (state shows only a generic "Chargement…"), and a 413 from nginx surfaces as a raw error string. Files over the (implicit) limit fail cryptically.
- Blocks: Users cannot tell a large-file failure from a format failure.
- Files: `webapp/src/components/UploadButton.tsx`, `webapp/src/api/client.ts:30-39`

**Logging / observability:**
- Problem: The API has zero logging (`console` never used in `api/src`); storage failures are silent (`api/src/planning/storage.ts:54-61`), auth failures return generic 503s. No request logging, no error tracking.
- Blocks: Diagnosing production issues requires manual reproduction; the "silent empty state" bugs are invisible in logs.
- Files: `api/src/main.ts`, `api/src/planning/storage.ts`

**Graceful Keycloak outage behavior (webapp):**
- Problem: See Fragile Areas — blank page forever if Keycloak is down at boot (`webapp/src/main.tsx`). No offline/auth-degraded mode despite the PWA.
- Blocks: The app's core value (reading the schedule) is unusable during an IdP outage even though the API data is available.

## Test Coverage Gaps

**Parser edge cases (api):**
- What's not tested: Role-regex collisions with real names ("Estelle…"), week blocks with more/fewer rows than S1, impossible start dates ("31 février"), numeric time cells, multi-year filenames, sheets where a notes sheet contains "S1" in column A.
- Files: `api/src/planning/parser.ts`, `api/src/planning/parser.spec.ts` (11 tests), `api/test/planning.e2e-spec.ts`
- Risk: The silent-corruption paths (row mismatch, role collision) ship without any guard.
- Priority: High

**Request races (webapp):**
- What's not tested: Out-of-order schedule responses, stale-days-on-error rendering, the `redirecting` flag, upload double-submit (two rapid clicks on "Importer").
- Files: `webapp/src/store/apiMiddleware.spec.ts`, `webapp/src/api/client.spec.ts`, `webapp/src/components/MonthCalendar.spec.tsx`
- Risk: Race bugs are intermittent in production and would pass CI undetected.
- Priority: Medium

**Storage failure modes (api):**
- What's not tested: Corrupt `planning.json`/`config.json` (returns null silently), write failure (disk full), concurrent writes, `DATA_DIR` resolution.
- Files: `api/src/planning/storage.spec.ts`
- Risk: Data-loss scenarios have no regression guard.
- Priority: Medium

**PWA service worker behavior:**
- What's not tested: The `planning-api` runtime cache (`webapp/vite.config.ts:43-58`) — no test asserts that uploads invalidate the cache or that offline mode serves within `maxAgeSeconds`.
- Files: `webapp/vite.config.ts`, `webapp/src/components/PWAUpdatePrompt.tsx`
- Risk: Stale-data regression (the product's core promise) ships silently.
- Priority: Medium

---

*Concerns audit: 2026-08-24*
