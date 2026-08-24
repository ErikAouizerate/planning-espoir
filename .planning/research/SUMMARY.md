# Project Research Summary

**Project:** Planning Espoir
**Domain:** Personnel work-schedule planning web app (French social-care team; Excel planning upload → web calendar)
**Researched:** 2026-08-24
**Confidence:** MEDIUM-HIGH

## Executive Summary

Planning Espoir is an internal consultation tool for a French social-care team: an Excel work-planning document (6 template weeks S1–S6) is uploaded, parsed once server-side with `exceljs`, normalized to JSON, and rendered as a month calendar with per-person colored cells, on any device (PWA). The product's entire promise is *"the displayed schedule always matches the latest uploaded planning document"* — a person's shifts are read correctly, no matter how often the Excel changes. Experts build this class of tool as a strict upload→parse→serve pipeline in which the Excel remains the single source of truth: no in-app editing, no multi-planning, no real-time sync, no import wizard (all judged anti-features by research). The maturity play for such an app is trust and correctness: never fail silently, always show the freshest data, and be honest about staleness — this is exactly what the milestone targets.

This milestone is a robustness + security hardening pass over an existing brownfield monorepo (NestJS 11 + React 19/Redux + shared TS package, Node 22, flat-file storage, Keycloak OIDC, PWA). Research converges on a deliberately minimal approach: **two new runtime dependencies total** (`@nestjs/throttler ^6.5.0`, `helmet ^8.3.0`) — everything else is technique applied to existing code: a shared pure date module over `YYYY-MM-DD` string keys (with `Intl.DateTimeFormat` at the France "today" boundary), request-id sequencing in the existing custom API middleware (no thunks, per ADR-0005), layered upload limits (multer + nginx + client pre-check), and defense-in-depth security (CORS whitelist, CSP after a style-source audit, public `/api/health`, proxy-aware rate limiting).

The dominant risks are all **silent** failures: parser paths that drop rows or time cells or shift dates by timezone (exceljs `Date` cells read through local getters), impossible start dates that brick the schedule endpoint with 500s, stale responses overwriting a newer month, dev/prod upload-limit divergence (nginx 1 MB default vs dev unlimited), and a CSP that kills the calendar's inline-style colors. Every risk has a documented prevention with explicit test vectors (TZ-pinned fixtures, reversed-resolution middleware tests, oversized-upload e2e, round-trip date validation). The top structural mitigation: warnings must be first-class data — persisted in the normalized model and rendered on the calendar page — because uploader and viewer are often different people, and a transient toast at upload time cannot build trust.

## Key Findings

### Recommended Stack

Full detail: [STACK.md](STACK.md). The stack stays almost entirely as-is; the milestone's fixes are correctness work, not tooling work.

**Core technologies:**
- `exceljs` ^4.4.0 (keep): the only parser. Maintenance mode (no new features since Oct 2023) but battle-tested and fully sufficient for the fixed layout; do NOT switch — npm `xlsx` (SheetJS) is stuck at 0.18.5 with unfixed CVEs (prototype pollution, ReDoS)
- `Intl.DateTimeFormat` (built-in): French month names + the zoned "today" boundary (`en-CA` yields `YYYY-MM-DD` in `Europe/Paris`); zero deps
- Local-time `Date` getters/constructors paired consistently (local+local or UTC+UTC): date-only calendar math; never UTC getters for "today" — that is the exact bug class (00:00–02:00 Paris shows yesterday)
- Request-id sequencing (no library): the canonical Redux stale-response guard, fits the existing `*_REQUESTED → *_START/_SUCCESS/_ERROR` middleware pattern
- `@nestjs/throttler` ^6.5.0 (NEW): ecosystem-standard rate limiting; v6 object config (`throttlers` key); needs a proxy-aware guard behind nginx
- `helmet` ^8.3.0 (NEW): security headers incl. CSP; explicit `worker-src 'self'` needed for the PWA service worker
- Multer limits (bundled via `FileInterceptor`): upload size cap; keep `memoryStorage()`

**Critical version details:** ThrottlerModule v6 object form (v5 array form breaks); helmet CSP must include `connect-src`/`frame-src` for the Keycloak origin; multer `fieldSize` default is 1 MB (gotcha when raising `fileSize` alone); pin `TZ=Europe/Paris` in the API Dockerfile; `@date-fns/tz` pairs ONLY with date-fns v4 (`date-fns-tz` is v3-only); Temporal ships natively only on Node 26+ — do not polyfill.

### Expected Features

Full detail: [FEATURES.md](FEATURES.md).

**Must have (table stakes):**
- Upload success/failure feedback with actionable French messages — silence reads as failure; there are silent-drop paths today
- Upload size limit told to the user (friendly 413, not a bare nginx page)
- Warnings for anything the parser couldn't fully trust — no product ships silent data loss
- Already shipped: month calendar Monday-first, per-person colors, week numbers S1–S6, person multi-select, absence badges, month navigation, PWA

**Should have (competitive / differentiators):**
- **Persistent upload health report on the calendar page** — the headline feature: warnings live in the normalized model and render wherever the schedule renders ("⚠ 3 cells in S3 week 2 weren't recognized"). Makes the tool trustworthy vs raw Excel; competitors (Skello-class) have no equivalent for Excel import
- Stale-response protection — makes "always latest" actually true (request tokens client-side + upload versioning server-side)
- Timezone-naive dates end-to-end (France-correct) — correctness users *feel* as "the right shift on the right day"
- Last-updated indicator, auto-refresh after upload, offline data labeled with sync date (P2)

**Defer (P2/P3):** last-updated indicator, auto-refresh, PWA offline staleness label, color legend (verify it doesn't already exist), 1904 date-system warning; later: week view toggle, print styles, parse event logging.
**Anti-features (deliberately out):** in-app editing, import wizard, multi-planning/history, notifications, employee self-service, payroll/hour totals, print/PDF export, WebSockets, time-of-day scheduling.

### Architecture Approach

Full detail: [ARCHITECTURE.md](ARCHITECTURE.md). Four integration patterns for the brownfield monorepo: (1) **shared pure date module** over string keys with zoned "today" at the boundary only — dedupes the two drifted copies (`api/src/planning/date-rotation.ts`, `webapp/src/utils/dates.ts`); (2) **request-sequencing stale guard** in `apiMiddleware.ts` (reducers stay pure, one place for all flows); (3) **layered upload limits** — one `MAX_UPLOAD_BYTES` for multer, nginx `client_max_body_size` strictly larger (multipart overhead), client pre-check; (4) **defense-in-depth security** — CORS whitelist from env, CSP behind nginx, `@Public()` health endpoint via Reflector, throttler keyed on `x-forwarded-for`.

**Major components:**
1. `shared/src/dates.ts` (NEW) — all pure calendar math (`weekIndexForDate`, `monthDays`, `monthGrid`, `shiftMonth`, `isValidMonth`, `isValidDateKey`) + `todayKey`/`currentMonthKey` with injectable `now`; string keys only, no `Date` in signatures; vitest suite pinned `TZ=Europe/Paris`
2. `webapp/src/store/apiMiddleware.ts` (EDIT) — per-flow monotonic sequence counter; drop stale `*_SUCCESS`/`*_ERROR` before dispatch
3. `api/src/common/multer-exception.filter.ts` (NEW) — `MulterError` → 413 with a French message (without it, oversized uploads surface as 500)
4. `api/src/common/throttler-behind-proxy.guard.ts` (NEW) — reads first `x-forwarded-for` value (base guard keys everyone to the nginx IP)
5. `api/src/auth/auth.guard.ts` (EDIT) — `@Public()` metadata check via `Reflector` so `/api/health` bypasses auth
6. `api/src/main.ts` (EDIT) — restricted CORS from `CORS_ORIGINS` env instead of bare `enableCors()`
7. `webapp/nginx.conf` (EDIT) — CSP header, `client_max_body_size`, `X-Forwarded-For`; all `add_header` at server level (location-level drops them)
8. `webapp/src/api/client.ts` (EDIT) — 413 mapping to French message + pre-upload `file.size` check

### Critical Pitfalls

Full detail: [PITFALLS.md](PITFALLS.md). Top 5:

1. **Excel date/time cells shift when parsed through JS `Date` on the server** — exceljs materializes Excel serials as UTC instants; reading with local getters adds the host offset (+2h summer in France). Avoid: extract with `getUTC*` or manual serial conversion in the parse path (never `toISOString()`/`Date.parse`); TZ-pinned fixtures ("08:00" → `{h:8,m:0}` under both TZ settings).
2. **Numeric time cells silently dropped** — date-ness lives in `numFmt`, not the value, so a `9.5` cell arrives as `Number`; uninterpreted numbers currently become silent `{type:'none'}`. Avoid: handle numbers explicitly (serial fraction vs hours policy); warn on anything uninterpreted.
3. **Silent row-drop / identity shift when week-block row counts drift from S1** — identity is positional (ADR-0004); a row inserted mid-file shifts everyone below it silently. Avoid: count rows per block vs S1, warn on delta; cross-check canonicalized names against the S1 roster (catches insertions even when counts match).
4. **Impossible start dates brick the whole schedule endpoint** — "31 février" passes format validation, `Date.parse` → NaN → 500 on ALL schedule requests. Avoid: round-trip validation (`isValidDateKey` in shared/), reject at upload with a French 4xx, previous planning stays intact; never fail at schedule-read time.
5. **UTC "today"/month keys show the wrong day in France** — `getUTC*`/`toISOString()` between 00:00–02:00 Paris highlights yesterday and opens the previous month — exactly when shift workers check. Avoid: wall-clock Europe/Paris semantics; local getters or `Intl` zoned key; single shared module; CI tests under `TZ=Europe/Paris` AND `TZ=UTC`.

Also critical: DST week-rotation drift (component day numbers, never 24h steps), stale responses overwriting a newer month (sequencing; clear `days` on error), upload limits dev/prod mismatch (both layers explicit and equal), CSP without `'unsafe-inline'` killing calendar colors (style audit first), health behind auth / open CORS (`@Public()` + origin whitelist).

## Implications for Roadmap

Suggested phase structure — **4 phases**, ordered by dependency (matches the pitfall-to-phase mapping and the architecture build order):

### Phase 1: Shared Calendar Math
**Rationale:** the foundation every other change composes with; dedupes the two drifted date-helper copies into the shared package's stated purpose; unblocks timezone-correct "today" and DST-safe week rotation. Self-contained with no upstream dependencies.
**Delivers:** `shared/src/dates.ts` (pure calendar math + zoned `todayKey`/`currentMonthKey` with injectable `now`), vitest suite run `TZ=Europe/Paris` and `TZ=UTC` with DST-boundary fixtures (2026-03-29, 2026-10-25), api + webapp consuming from `dist/` (root scripts already build shared first), `date-rotation.ts` demoted to a thin re-export or deleted.
**Addresses:** FEATURES "timezone-naive dates" + "shared calendar math"; PROJECT.md targets 5 & 7.
**Avoids:** PITFALLS 5 (UTC today/month keys), 6 (DST rotation drift).
**Research flag:** LOW — vitest wiring in the workspace package is standard; skip research-phase or minimal.

### Phase 2: Parser Robustness — Never Silent-Corrupt
**Rationale:** the milestone's headline ("zero silent misparses" is the success metric). Depends on Phase 1 for `isValidDateKey` (start-date validation). The parser is the most fragile surface — every change rides on the existing workbook fixtures + parser specs.
**Delivers:** structured parser warnings (week-block row-count mismatches, role-regex/name collisions, numeric time cells) returned as `{ errors, warnings }` instead of throw-or-drop; numeric/time cells parsed via UTC getters or warned — never silent `{type:'none'}`; impossible start dates rejected at upload with a 4xx French message, previous planning intact; warnings persisted in `planning.json` and served by `GET /schedule` (model/API plumbing for the report).
**Addresses:** FEATURES "structured parser warnings" + the persistence half of "warning report"; PROJECT.md targets 1, 2, 3.
**Avoids:** PITFALLS 1, 2, 3, 4.
**Research flag:** skip — exceljs read API well-documented (Context7) and existing fixtures ground the changes.

### Phase 3: Webapp Async Robustness & Trust UX
**Rationale:** makes the milestone's guarantees *visible*: warnings rendered where the schedule renders, stale responses dropped, upload feedback actionable. Depends on Phase 2 (warnings present in API responses).
**Delivers:** request-sequencing guard in `apiMiddleware` (per-flow counter; drop stale SUCCESS/ERROR; clear `days`/`sundayWeeks` on error), warning banner + collapsible report on the calendar page (French messages naming week/cell), upload success/failure feedback with actionable messages.
**Addresses:** FEATURES "warning report UI" (the differentiator), "stale-response protection", "upload success/failure feedback" (table stakes).
**Avoids:** PITFALLS 7 (stale responses overwrite newer month) and the UX-pitfall family (silent drops invisible to users).
**Research flag:** skip — request-id sequencing is the canonical Redux pattern (RTK requestId semantics, netguru writeup).

### Phase 4: Upload Limits + Security Hardening
**Rationale:** everything here touches the deploy surface (nginx.conf, .env, Dockerfile) — deliberately last. The nginx edits for body limits AND security must land in one phase to avoid double-touching `nginx.conf` (architecture's explicit merge recommendation).
**Delivers:** multer `limits.fileSize` + `MulterExceptionFilter` (413 French) + nginx `client_max_body_size` + client pre-check/413 mapping; CORS restricted to `CORS_ORIGINS`; CSP headers after a `style={{` audit (`script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `worker-src`, Keycloak origins in `connect-src`/`frame-src`); public `/api/health` via `@Public()` + post-deploy verification step; `ThrottlerBehindProxyGuard` + nginx `X-Forwarded-For`; Docker runtime image pruned of devDependencies; dead code removed (`colorsReducer`, `resolveUsername`).
**Addresses:** FEATURES "upload size limits", "security hardening", "dead code/Docker pruning"; PROJECT.md targets 6, 8, 9, 10.
**Avoids:** PITFALLS 8 (limits bypass/mismatch), 9 (CSP kills colors), 10 (health behind auth / open CORS).
**Research flag:** validation-at-implementation, not research — CSP directives need the REAL Keycloak origin + deployment origin from `.env`, and the inline-style audit results, before finalizing the header; throttler limits (120/min, 10/min upload) are starting points to tune.

### Phase Ordering Rationale

- **Dependency chain:** shared dates (foundation) → parser robustness (uses `isValidDateKey`, produces warnings) → webapp trust UX (renders warnings, drops stale responses) → security/infra (nginx + env + deploy surface last, so earlier phases' behavior is already proven before the edge changes).
- **Grouping:** upload limits and security share the `nginx.conf` edit → one phase (ARCHITECTURE's "merge 3+4" advice, now folded as phase 4); dead code + Docker pruning are cheap housekeeping bundled with hardening.
- **Pitfall avoidance:** each phase has explicit prevention AND verification vectors — TZ-pinned parser/date tests, reversed-resolution middleware test, oversized-upload e2e, style audit before CSP, `curl /api/health` without a token → 200.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4:** no research-phase needed, but the plan must list concrete deployment values before implementation — Keycloak realm origin (CSP `connect-src`/`frame-src`, issuer scheme https check), deployment origin (CORS), inline-style audit results. CSP is the easiest thing to get subtly wrong (nginx `add_header` inheritance, Vite dev styles).

Phases with standard, well-documented patterns (skip research-phase):
- **Phase 1:** shared-package vitest wiring is standard workspace mechanics.
- **Phase 2:** exceljs read API + existing fixtures/specs cover the changes.
- **Phase 3:** request-id sequencing is the canonical Redux pattern (RTK #1117/#3180, netguru).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified against npm registry (2026-08-24) and NestJS source (`multer.utils.ts`); pattern recommendations MEDIUM but cross-checked across sources |
| Features | MEDIUM | Web sources cross-checked (import UX, upload UX, PWA freshness, competitors); local codebase facts HIGH (ADR-0001–0007, PROJECT.md) |
| Architecture | MEDIUM | NestJS/nginx/Redux patterns well-documented (Context7 + official docs + source); CSP and throttler-proxy details verified; some values deployment-dependent |
| Pitfalls | HIGH | exceljs timezone bugs confirmed by multiple issue reports (#486/#1404/#2353); Excel serial facts from primary docs (Microsoft, openpyxl, libxlsxwriter); grounded in repo code |

**Overall confidence:** MEDIUM-HIGH — stack and pitfalls are solid; feature prioritization and exact security values (CSP header, CORS origins, throttler limits) need validation against the real deployment.

### Gaps to Address

- **Color legend existence:** FEATURES flags "verify a legend exists" on the calendar — check during Phase 3 planning; the P2 legend item drops if present.
- **"Today" highlight existence:** table-stakes item — verify the month grid highlights today (fix cheaply if missing, likely in Phase 3).
- **CSP exact values:** need real Keycloak origin + prod origin + `style={{` audit results before Phase 4 planning finalizes the header.
- **Warnings schema:** persisting warnings in `planning.json` requires a shared-types change (parser result type `{ errors, warnings }`) — plan the schema inside the Phase 2 parser refactor, and remember the shared rebuild-before-test dance.
- **PWA cache window vs "always latest":** the NetworkFirst 24h `maxAgeSeconds` decision (PROJECT.md ⚠️ revisit) interacts with freshness UX — the offline staleness label (P2) is the mitigation, not a fix; decide the cache policy with Phase 3.
- **Throttler limits:** 120/min default + 10/min upload are starting points — tune with real team usage after deploy.
- **Docker pruning approach:** depends on the current Dockerfile's multi-stage structure — inspect at Phase 4 planning.
- **1904 date-system:** warn (P2, cheap insurance) vs hard-fail — decide during the Phase 2 parser refactor while touching cell-type handling.
- **Timezone test matrix:** all date/parser tests should run under both `TZ=Europe/Paris` and `TZ=UTC` in CI — make this an explicit CI job change in Phase 1.

## Sources

### Primary (HIGH confidence)
- npm registry (`registry.npmjs.org`) — exceljs 4.4.0, @nestjs/throttler 6.5.0, helmet 8.3.0 versions, fetched 2026-08-24
- NestJS source `packages/platform-express/multer/multer/multer.utils.ts` — MulterError → 413/400 exception mapping
- Microsoft Support "Date systems in Excel" + openpyxl datetime docs — 1900/1904 epochs, serial conversion, Lotus bug
- MDN — `Date.parse` UTC-midnight quirk; CSP `style-src` (inline attributes, hashes don't apply)
- reduxjs/redux-toolkit issues #1117, #3180 — requestId sequencing, ignore-not-cancel guidance
- exceljs issues #486, #1404, #2353 — Date values shifted by host timezone (multiple independent reports)
- Repo code + `.planning/codebase/CONCERNS.md` + PROJECT.md — grounded the UTC "today" bug, silent-drop paths, middleware pattern

### Secondary (MEDIUM confidence)
- Context7 `/nestjs/docs.nestjs.com` — FileInterceptor, ParseFilePipe, @Public() + Reflector, CORS
- Context7 `/nestjs/throttler` — v6 config, guard, proxy-aware tracker pattern
- Context7 `/exceljs/exceljs` — ValueType enum, date1904, streaming/read API
- nginx docs + Netdata + GetPageSpeed — `client_max_body_size` default 1 MB, inheritance traps, multi-layer 413
- vitest issue #1575 — TZ must be set before startup (`test.env`/`setupFiles` too late)
- Netguru "Race Conditions in Redux" — request-id counter pattern
- Timezone guides (yutils, devgex, herodevs) — DST 23/25h days, IANA zones, UTC-midnight parsing
- Import/upload UX sources (smart-interface-design-patterns, eleken, uxpatterns, pencilandpaper) — actionable warnings, size limits, error modalities
- Competitor feature pages (Skello, ShiftApp, When2Work, Express Schedule) — feature presence only, marketing sources
- eslint-plugin-nestjs-security — `no-permissive-cors`

### Tertiary (LOW confidence)
- SheetJS issue #1804 — Excel serial conversion timezone/DST bugs (primary for that specific bug, single-source for details)
- Tailwind discussion #13326 + shadcn-ui #4461 — inline styles vs strict CSP practice
- Community date-library comparisons (OpenReplay, ClockOrbit, codecudos) — date-fns v4/@date-fns/tz vs Luxon vs Day.js guidance

---
*Research completed: 2026-08-24*
*Ready for roadmap: yes*
