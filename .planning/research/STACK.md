# Stack Research

**Domain:** Personnel work-schedule planning web app — Excel planning upload → web calendar (NestJS 11 API + React 19/Vite 8 webapp + shared TS package, Node 22, flat-file storage, Keycloak OIDC, PWA)
**Researched:** 2026-08-24
**Confidence:** HIGH for versions (verified against npm registry, NestJS source, Context7 docs); MEDIUM for pattern recommendations (cross-checked across multiple sources)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `exceljs` (keep) | ^4.4.0 (latest on npm) | Server-side `.xlsx` parsing | Already in the codebase, MIT, installable from npm, read API fully sufficient for the layout-encoded parser. Still the standard read/write xlsx library in Node. Verify facts: still the latest published version (Oct 2023) — project is in maintenance mode, so *do not* expect new features, but for a fixed layout it is stable and battle-tested. [HIGH] |
| `Intl.DateTimeFormat` (built-in) | ECMA-402, every Node 22 + browser | French month names + any instant rendering | The one built-in that handles named IANA zones correctly (`timeZone` option) and handles the `fr-FR` locale. Zero deps, replaces the hard-coded French month-name constant. Keep the UTC instant everywhere; let Intl do localization at the edge. [HIGH] |
| Local-time `Date` getters/constructors (built-in) | ES2022 (already the TS target) | Date-only calendar math in `shared/` | For pure date arithmetic, `new Date(y, m-1, d)` + `getFullYear/getMonth/getDate/getDay` are deterministic and host-timezone independent *when constructor and getters are paired consistently* (local+local or UTC+UTC). The bug class in this repo is mixing: computing "today" (`new Date()`) with **UTC getters** in `webapp/src/utils/dates.ts` — between midnight and 02:00 Paris time the displayed month is yesterday's. Fix: read "today" with local getters; keep all pure arithmetic in one convention. [HIGH] |
| Request-id sequencing (no library) | — | Guard against stale async responses in Redux | The canonical Redux pattern (endorsed by RTK maintainers): tag every request with an id, store the latest id in state, ignore any response whose id is stale. Fits the existing `*_REQUESTED → *_START/_SUCCESS/_ERROR` middleware pattern with zero new dependencies. [MEDIUM] |
| `@nestjs/throttler` (new) | ^6.5.0 | Rate limiting | Ecosystem-standard NestJS rate limiter; v6.5.0 peer-compatible with NestJS 11 (`@nestjs/common/core ^7–^11`). In-memory storage is fine for the single-instance deploy. [HIGH] |
| `helmet` (new) | ^8.3.0 | Security headers incl. CSP | Standard Express/NestJS header hardening, MIT, Node ≥ 18 (OK on Node 22). CSP on by default; explicit `worker-src` needed for the PWA service worker. [HIGH] |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@date-fns/tz` | ^1.5.0 | IANA-aware date construction/formatting (`TZDate`, `tz()`) | **Only if** calendar arithmetic grows beyond what pure helpers cover (e.g. DST-crossing shift math). Requires date-fns v4 as peer. Not needed for the current scope. [MEDIUM] |
| `date-fns` | ^4.4.0 | Tree-shakeable functional date helpers | **Only if** the shared date module needs more than ~5 hand-rolled pure functions. The v4 timezone story is first-class via `@date-fns/tz`. [MEDIUM] |
| Multer (bundled) | 2.x inside `@nestjs/platform-express` 11 | Upload handling with `limits` | Already used via `FileInterceptor` (memory storage). Add `limits: { fileSize }` — no new package. [HIGH] |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| npm registry / `npm view <pkg> version` | Verify versions before pinning | The registry is the source of truth; exceljs and throttler versions above were confirmed this way on 2026-08-24. |
| `TZ=Europe/Paris` env in `api/Dockerfile` + compose | Pin the API container's local timezone | Makes local-getter date math deterministic server-side regardless of host. Webapp is browser-side; users are in France, so client-local is correct. |

## Installation

```bash
# New runtime deps (api only) — deliberately small
pnpm --filter @planning-espoir/api add @nestjs/throttler@^6.5.0 helmet@^8.3.0

# No new webapp or shared deps for this milestone:
#  - date math: built-in Date + Intl.DateTimeFormat, pure helpers in shared/
#  - stale-async guard: requestId in action.meta (existing middleware)
#  - upload limits: multer limits option (already present), nginx client_max_body_size
#  - warnings: plain TS types in shared/ (no schema library needed)
```

Everything else is technique applied to existing dependencies. This is the entire dependency footprint of the milestone — that is the point: the fixes are correctness work, not tooling work.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| exceljs ^4.4.0 (keep) | SheetJS CE (`xlsx`) | Never for this project: npm `xlsx` is stuck at 0.18.5 with **CVE-2023-30533** (prototype pollution) and **CVE-2023-22365** (ReDoS); fixed 0.19.3+/0.20.3 ship only as a CDN tarball (`cdn.sheetjs.com`) or via republished packages (`@e965/xlsx`) — supply-chain friction that violates the npm-based minimal-deps philosophy. |
| exceljs ^4.4.0 (keep) | `read-excel-file` (catamphetamine) | Only for a greenfield read-only parser with schema-based row mapping. Here the parser already encodes the sheet layout positionally (row/column groups, merges) and has workbook fixtures + spec coverage; switching parsers re-opens the most fragile surface for no gain. |
| Request-id sequencing | `AbortController` on fetch | Complementary, not a replacement. Abort stops the in-flight network work; the request-id guard is what guarantees state correctness. An aborted fetch *rejects* — the middleware must not dispatch `*_ERROR` for `AbortError`. Use abort only if bandwidth matters (small payloads here — skip). |
| Request-id sequencing | RTK Query / thunks (`takeLatest`) | RTK Query is a different paradigm (slices, cache) and thunks are explicitly disabled in this repo (ADR-0005). The middleware pattern already exists; extend it. |
| `@nestjs/throttler` | `express-rate-limit` | Works, but less Nest-idiomatic (no guard/decorator integration, manual wiring). Throttler is the ecosystem standard for Nest. |
| No date library (Intl + pure helpers) | `luxon` 3.7.2 | Luxon is zone-first and excellent, but ~75 KB and not tree-shakeable — overkill for date-only calendar math. Revisit only if the app gains multi-timezone *instant* semantics. |
| No date library (Intl + pure helpers) | `dayjs` + timezone plugin | ~2 KB core, but the timezone plugin pulls in IANA data and the API style (plugins, chainable) doesn't match the pure-function shared package. exceljs already depends on dayjs internally — do not promote it to a direct dependency. |
| No date library (Intl + pure helpers) | Temporal polyfill (`temporal-polyfill` / `@js-temporal/polyfill`) | Native Temporal ships in **Node 26+** (2026-05-05), Chrome 144, Firefox 139 — **not available on Node 22**, which this project pins. Polyfills exist (temporal-polyfill 19.5 kB min+gzip, stable) but add a dependency whose spec target (Aug 2026) is still moving, for date-only math that Intl handles today. Revisit when the project can move to Node 26 LTS. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| npm `xlsx` (SheetJS) | Stuck at 0.18.5 with two known CVEs (prototype pollution CVE-2023-30533, ReDoS CVE-2023-22365); current releases only via CDN tarball/republish | Keep exceljs ^4.4.0 |
| `date-fns-tz` | Targets date-fns **v3 only**; mixing it with date-fns v4 is a documented source of incorrect conversions | `@date-fns/tz` ^1.5.0 (v4 companion) |
| Temporal on Node 22 | Not implemented natively before Node 26; polyfill adds dependency for marginal gain | `Intl.DateTimeFormat` + local getters; revisit at Node 26 |
| UTC getters for "today" in the webapp | `new Date()` + `getUTCFullYear/getUTCMonth` yield yesterday's month between 00:00–02:00 in France (UTC+1/+2) — the exact bug class this milestone targets | Local getters (`getFullYear/getMonth/getDate`) or pure string math on `YYYY-MM-DD` |
| `multer.diskStorage` | Writes uploads to disk; the API is flat-file and parses in memory; disk storage leaks temp files on parse failure | Keep `multer.memoryStorage()` (already in use) |
| `ThrottlerModule.forRoot([{ ttl, limit }])` array form | That is the **v5** API; v6 (current) uses the object form with a `throttlers` key | `ThrottlerModule.forRoot({ throttlers: [{ ttl, limit }] })` |
| Helmet default CSP without `worker-src` | Service-worker registration falls back to `script-src`; tightening `script-src` later silently breaks the PWA | Set `worker-src 'self'` explicitly; `connect-src` must include `'self'` (nginx-proxied API) and the Keycloak origin for OIDC token endpoints |

## Stack Patterns by Variant

**If the API container's timezone is not pinned (`TZ` not set in Dockerfile/compose):**
- Use string-based date math on `YYYY-MM-DD` in `shared/` (no `Date` instant for pure arithmetic), and only use `Date` at the boundary ("today", formatting).
- Because the Docker host TZ is then undefined, local-getter math could disagree with the webapp's browser-local math. Pinning `TZ=Europe/Paris` removes the ambiguity; string math removes it entirely.

**If an upload ever needs to exceed ~10 MB:**
- Raise `limits.fileSize` *and* `client_max_body_size` in `webapp/nginx.conf` together (they must match dev/prod behavior — a mismatch yields 413 in prod, silent success in dev).
- Keep memory storage only while files stay small; switch to a temp-dir + `diskStorage` + cleanup if the limit grows past tens of MB.

**If the app ever moves to multiple instances:**
- `@nestjs/throttler`'s in-memory store becomes per-instance; switch to `ThrottlerStorage` backed by Redis (the package exposes the interface) — not before.

**If the project upgrades to Node 26 LTS (next major milestone):**
- Re-evaluate native `Temporal` for the shared date module — `PlainDate` maps exactly to this domain's date-only semantics and removes the local/UTC pairing hazard entirely. This is a *future* recommendation; do not polyfill now.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@nestjs/throttler` 6.5.0 | `@nestjs/core`/`@nestjs/common` ^7–^11 (peerDeps) | Verified against NestJS 11.1.x in use. v6 API: object config with `throttlers` key. |
| `helmet` 8.3.0 | Node ≥ 18 | Verified against Node 22 in use. CSP enabled by default; configure via `helmet({ contentSecurityPolicy: { directives } })`. |
| `exceljs` 4.4.0 | Node ≥ 8.3 | Latest on npm (published 2023-10); maintenance mode — no new features expected. Pulls `dayjs ^1.8.34` transitively (already in the lockfile tree). |
| `@date-fns/tz` 1.5.0 | date-fns v4 (peer) | Do NOT pair with date-fns v3 / `date-fns-tz`. |
| Multer 2.x | `@nestjs/platform-express` 11 (bundled), Express 5 | `LIMIT_FILE_SIZE` → Nest `PayloadTooLargeException` (HTTP 413); other `LIMIT_*` → `BadRequestException` (400) — verified in Nest source `multer.utils.ts`. |
| Temporal (native) | Node 26+ only | Stage 4, shipped Node 26 on 2026-05-05; absent from Node 22. |

## Sources

- Context7 `/exceljs/exceljs` — reading workbooks, `ValueType` enum, formula cells (result not evaluated, cached value only), streaming `WorkbookReader`, pivot-table read stubbed [MEDIUM]
- npm registry (`registry.npmjs.org/exceljs/latest`, `.../@nestjs/throttler/latest`, `.../helmet/latest`, `.../@date-fns/tz/latest`) — authoritative current versions, fetched 2026-08-24 [HIGH]
- Context7 `/nestjs/docs.nestjs.com` — `FileInterceptor`, `ParseFilePipe` + `MaxFileSizeValidator`/`FileTypeValidator`, `MulterModule.register` [MEDIUM]
- NestJS source `packages/platform-express/multer/multer/multer.utils.ts` — multer error → HTTP exception mapping (413/400) [HIGH]
- Context7 `/nestjs/throttler` — v6 config (`throttlers` key), `ThrottlerGuard` via `APP_GUARD`, `@Throttle`, `@SkipThrottle`, `skipIf` [MEDIUM]
- Express multer docs — `limits` option keys and defaults (`fileSize` default Infinity) [HIGH]
- tc39/proposal-temporal + fullcalendar/temporal-polyfill README — Temporal Stage 4, Node 26/Chrome 144/Firefox 139 shipping; polyfill sizes and spec dates [MEDIUM, cross-checked]
- openreplay.com + codecudos.com + clockorbit.com date-library comparisons (2026) — date-fns v4 + `@date-fns/tz` vs Luxon vs Day.js guidance; `Intl.DateTimeFormat` primacy for named zones [MEDIUM, cross-checked]
- SheetJS docs/CDN + GitHub issue #2831 — npm `xlsx` 0.18.5 stuck with CVE-2023-30533 / CVE-2023-22365; 0.20.3 via CDN only [MEDIUM, cross-checked]
- redux-toolkit issue #1117 (RTK maintainer) + netguru "Race Conditions in Redux" — request-id sequencing as the canonical stale-response guard; "ignore, don't cancel" [MEDIUM, cross-checked]
- Repo code (`webapp/src/utils/dates.ts`, `api/src/planning/date-rotation.ts`, `api/src/planning/parser.ts`) — grounded the UTC-getter "today" bug and the existing middleware/action pattern [HIGH]

---
*Stack research for: Planning Espoir — robustness & correctness milestone*
*Researched: 2026-08-24*
