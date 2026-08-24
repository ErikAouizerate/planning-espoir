# Pitfalls Research

**Domain:** Personnel work-schedule planning web app (Excel planning upload → web calendar)
**Researched:** 2026-08-24
**Confidence:** HIGH (cross-checked web findings); MEDIUM for library-specific API details (NestJS/exceljs docs)

## Critical Pitfalls

### Pitfall 1: Excel date/time cells shift when parsed through JS `Date` on the server

**What goes wrong:**
exceljs returns date- or time-formatted cells as JS `Date` objects built as if the Excel serial were a UTC instant. The server then reads local-time getters (`getHours`, `getDate`…), so a "08:00" shift cell parsed on a French-hosted API becomes `10:00` (+2h in summer), and a midnight date cell becomes the previous day. Known exceljs issue #2353 reports exactly this: reading a datetime cell shows the value shifted by the server's offset ("+2 hours added", GMT+2 server — the France case); issue #486 documents the same class of bug on write. The app then displays wrong shift hours or a shift on the wrong day, silently.

**Why it happens:**
Excel stores dates as timezone-less serial numbers; exceljs materializes them as `Date` (a UTC instant, per JS semantics). Any code that reads with local getters interprets the instant in the host timezone. Two timezone models collide: Excel's wall-clock intent vs. JS's instant semantics. The server's TZ (or the CI host's TZ) decides the bug's presence.

**How to avoid:**
Establish one rule: **Excel cell values are wall-clock values; never read them through timezone-aware getters.** When `cell.type === Date`, extract components with `getUTC*` (exceljs anchors the serial at UTC, so UTC getters recover the wall-clock value), or convert the raw serial yourself with a timezone-free algorithm (epoch 1899-12-30, or 1904-01-01 when `workbook.properties.date1904`, + fractional day). Never round-trip through `Date.parse`/`toISOString()` in the parsing path. Add a parser unit test with a fixture time cell (e.g. "08:00" → `{h:8,m:0}`) and run CI with `TZ=Europe/Paris` so any shift fails loudly.

**Warning signs:**
Parser output times consistently offset by the server's UTC offset (+1/+2h); tests pass in a UTC CI but fail on a Paris-hosted dev machine; `toISOString()` or `Date.parse` appearing anywhere in the parse path.

**Phase to address:**
Phase "parser robustness" (numeric/time cell handling) — the first robustness phase.

---

### Pitfall 2: Numeric time cells silently dropped (cell type is Number, not Date)

**What goes wrong:**
A day cell holding `9.5` with no time format is indistinguishable from any other number to exceljs — it stays `cell.type === Number`. A parser that only handles `Date` and `string` values turns it into `{type:'none'}` with no warning, so the person's shift silently disappears from the calendar. The existing warning loop only inspects string values, so nothing is ever reported.

**Why it happens:**
Excel's "is this a date?" answer lives in the cell's **number format** (`numFmt`), not in the value — change the format to General and a date shows its raw serial. When a user types a time as a plain number (or the sheet predates time formatting), the parser receives a Number and must decide: time-of-day serial fraction (value < 1), hours-like value (e.g. 9.5), or a raw number that isn't a time.

**How to avoid:**
Handle `number` values explicitly in the time parser: value < 1 → pure time (fraction × 24h); small values → interpret per a documented policy (serial fraction vs. hours). For any numeric cell the parser does not interpret, emit a `ParsingWarning` naming the cell — never silently produce "no content". Add a workbook fixture with numeric time cells and assert either a parsed HH:MM or a warning.

**Warning signs:**
Calendars where some people's shifts are missing while others show; parser specs with no numeric-cell case; warning counters that never fire in production.

**Phase to address:**
Phase "parser robustness" — numeric time handling + the warning plumbing (warnings surfaced in the UI after upload).

---

### Pitfall 3: Silent row-drop / identity shift when week-block row counts drift from S1

**What goes wrong:**
Person identity is positional (row index within the S1 block). If a later week block has *more* rows than S1, the extra rows are dropped silently; if *fewer*, S1 people get empty cells for that week. Either way, a row inserted/removed mid-file shifts everyone below it — all subsequent people silently display each other's shifts (off-by-one) with zero feedback. The failure is invisible until a user notices "that's not my shift".

**Why it happens:**
Positional identity was chosen because name spellings vary across weeks (ADR-0004), and the parser's `forEach((rp, i) => people[i] …)` silently skips out-of-range indexes instead of reporting the drift. Row-count drift is the one signal that positional identity is breaking down — and it is currently swallowed. The role-detection regex (`/^(ES|TISF|Educ)/i`) adds a second silent-drop path: a person named "Estelle" is eaten as a role row.

**How to avoid:**
Count rows per week block and compare against S1; emit a `ParsingWarning` naming the week and the count delta, and show warnings in the UI after upload. Cross-check identity by canonicalized name matching (normalize accents/case) between S1 and each block, warning on any person whose name doesn't match the S1 roster — this catches mid-file insertions even when counts match. Keep row-index identity as the key (per ADR-0004) but treat mismatch warnings as review-blocking, not silent data.

**Warning signs:**
Week blocks with different row counts in the fixture; `defaultNames` auto-selection picking wrong people after an upload; a user reporting "I see X's schedule under my name" right after an upload with roster changes.

**Phase to address:**
Phase "parser robustness" — row-count validation + role-regex/name-collision warnings.

---

### Pitfall 4: Impossible start dates brick the whole schedule endpoint

**What goes wrong:**
`extractStartDate` validates day ≤ 31 and month name but not day-in-month, so a sheet named "…31 février…" stores `2026-02-31`. Every schedule request then computes `Date.parse('2026-02-31T00:00:00Z')` → `NaN` → `weekIndexForDate` → `NaN` → `weeks[NaN]` → `undefined` → uncaught `TypeError` → 500 on **all** schedule requests until someone hand-edits the config.

**Why it happens:**
Day-of-month validity is a *calendar* property (depends on month and year) that a "day ≤ 31 + month name" check cannot see. The parser validates format, not existence; the service stores the value without a round-trip check. `Date.parse` returning `NaN` is then an unhandled path.

**How to avoid:**
Validate by round-trip: build a date from components and check the components come back unchanged (an `isValidDateKey` helper — already exists in the webapp; move it to `shared/`). Reject the upload with a French error message (or store `startDate: null` + surface a warning + ConfigModal prompt) instead of persisting an impossible value. Add unit tests for each overflow case (Feb 29/30/31, Apr 31, non-leap year). Fail fast at upload, never at schedule-read time.

**Warning signs:**
Any `Date.parse`/`new Date(dateKey)` whose `NaN` result is handled nowhere; no test named after impossible dates; a 500 on `GET /api/planning/schedule` that started "after an upload".

**Phase to address:**
Phase "parser robustness" — start-date validation at upload.

---

### Pitfall 5: UTC-based "today" and month keys show the wrong day/month in France

**What goes wrong:**
`currentMonthKey()`/`todayKey()` use `getUTC*`, and `ConfigModal` uses `new Date().toISOString()`. In France (UTC+1, CEST UTC+2), between 00:00–02:00 local the app highlights the previous day as "today" and, on the 1st of the month, opens the previous month — exactly the hours shift workers check their schedule.

**Why it happens:**
`toISOString()` is always UTC (MDN), and date-only keys derived from it are off by the local offset. Classic "JS `Date` has no timezone, only an instant" trap: the same code shows the right day on a UTC host and the wrong day on a Paris host. The duplicated date helpers (api `date-rotation.ts` + webapp `utils/dates.ts`) make it worse — one copy can be fixed and the other not.

**How to avoid:**
Decide that the domain is **wall-clock dates in Europe/Paris**. Compute "today" and month keys from local components (`getFullYear/getMonth/getDate`) — never `toISOString()`; never parse a naive `YYYY-MM-DD` key with `new Date(key)` (date-only forms parse as UTC midnight, a spec quirk kept for web compat; date-time forms without offset parse as local — same-looking strings, different semantics). Put all date-key math in one module in `shared/`, consumed by both api and webapp, and run CI tests with `TZ=Europe/Paris` **and** `TZ=UTC` to prove host-independence.

**Warning signs:**
A test asserting "today" that passes on only one host; `toISOString()` or `getUTC*` in app code (vs. only at the API transport edge); the app opening yesterday's month when opened at 00:30 local.

**Phase to address:**
Phase "shared calendar math" (dedupe into `shared/` + local-time semantics) — must land before further date features.

---

### Pitfall 6: Week-rotation math computed through `Date` drifts across DST boundaries

**What goes wrong:**
The S1–S6 rotation maps a date to a template week by Euclidean modulo from `startDate`. If the day-diff between two dates is computed by subtracting `Date` instants, or by walking with 24h steps, the DST transitions (France: last Sunday of March 02:00→03:00, last Sunday of October 03:00→02:00) make some days 23h/25h long: a 24h step lands on the wrong wall-clock day, and week assignment is off by one from that point on.

**Why it happens:**
"Add 24 hours" ≠ "add one calendar day" in a DST zone. Any rotation implemented as `new Date(start).getTime() + n * 86400000` or via `Date.parse` differences inherits the bug; component-based day counting does not.

**How to avoid:**
Compute day differences on **components, not instants**: convert each naive date key to a day number via `Date.UTC(y, m-1, d) / 86400000` (pure integer math, TZ-free) or an explicit day-number formula, then Euclidean-mod. Never add hours to a `Date` to walk the calendar. Since this logic must be identical in api and webapp, keep it in `shared/` with tests covering a March and an October boundary date.

**Warning signs:**
Week badge (S1–S6) on a Sunday disagreeing with the rotation by exactly one week after a DST weekend; rotation tests that never cross March/October; any `86400000` constant in date code.

**Phase to address:**
Phase "shared calendar math" — rotation helpers moved to `shared/` with DST-crossing fixtures.

---

### Pitfall 7: Stale schedule responses overwrite a newer month (out-of-order fetches)

**What goes wrong:**
Rapid month navigation fires overlapping `SCHEDULE_FETCH_REQUESTED`; responses resolve out of order; the older month's `days` land in state and render under the newer month's label. A failed fetch keeps the previous `days` on screen with an error banner — mismatched month label vs. content.

**Why it happens:**
Network responses have no ordering guarantee. The middleware dispatches `*_SUCCESS` unconditionally, and the reducer overwrites `days` with whatever arrives last. There is no notion of "which month does this response belong to, and is it still the latest request?" — the canonical problem solved by the requestId-sequencing pattern (redux-toolkit issue #1117).

**How to avoid:**
Request sequencing in the middleware: keep a monotonic sequence counter (or compare the requested month key); drop any `*_SUCCESS`/`*_ERROR` that doesn't match the latest request. Ignoring stale responses is sufficient — aborting the in-flight fetch (AbortController) is optional since payloads are small (maintainer guidance: ignore-not-cancel is the 99% solution). Also clear `days`/`sundayWeeks` on `*_ERROR` so an error never renders stale data under a wrong label. Add middleware unit tests that resolve responses in reverse order.

**Warning signs:**
A calendar showing month A's data under month B's header after clicking ‹ › fast; flaky reproductions on slow networks; middleware tests that only ever resolve one request.

**Phase to address:**
Phase "webapp async robustness" (middleware sequencing + error-state clearing) — before any caching feature, which would hide the bug.

---

### Pitfall 8: Upload size enforcement bypassed or dev/prod mismatched

**What goes wrong:**
`FileInterceptor` uses multer memory storage with no `limits` — any client can POST an unbounded file and exhaust API RAM (memory storage buffers the whole file in RAM; the size limit is a cap, not a streaming guard). In the Docker deploy, nginx's default `client_max_body_size` (1 MB) incidentally returns bare 413s, so dev accepts 50 MB while prod rejects >1 MB — behavior diverges, and real plannings with embedded content fail cryptically in prod only.

**Why it happens:**
Limits are enforced by two independent layers (nginx + multer) that default differently and are configured in different files (`nginx.conf` vs. controller options); neither was set explicitly, so each layer's default applies.

**How to avoid:**
Set both layers explicitly and equal: `FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } })` (NestJS maps `LIMIT_FILE_SIZE` → `PayloadTooLargeException`, HTTP 413) and `client_max_body_size 10m;` in nginx. Add `ParseFilePipe` with `MaxFileSizeValidator` + `FileTypeValidator` (mimetype/extension) as defense-in-depth — noting `fileFilter` rejection does *not* throw, so also check `req.file` presence. Surface a French error for 413 in the upload UI. Test both layers: an API e2e posting an oversized buffer, and a check that the nginx config matches.

**Warning signs:**
`FileInterceptor` called with no options anywhere; `client_max_body_size` absent from `nginx.conf`; uploads that work in dev and 413 in prod; no test asserting the limit.

**Phase to address:**
Phase "upload + security hardening" — the API and nginx limits must land in the same commit, or dev/prod divergence is reintroduced.

---

### Pitfall 9: CSP without `'unsafe-inline'` silently kills calendar cell colors

**What goes wrong:**
Adding a strict CSP (`style-src 'self'`) to harden the webapp breaks rendering: React inline `style` attributes (per-person calendar cell colors) are blocked by `style-src` and **cannot** be allowed via nonce or hash — hashes do not apply to style attributes (MDN), so `'unsafe-inline'` (or `'unsafe-hashes'`, poorly supported) is required. Dev mode additionally injects a `<style>` element (Vite), which `'self'` doesn't allow. Result: the app loads but every colored cell disappears, or dev styles vanish — invisible at build time.

**Why it happens:**
CSP `style-src` covers both `<style>` blocks and inline style attributes; the "secure" instinct is to omit `'unsafe-inline'`, which is exactly what inline-style-heavy React apps need. The tradeoff only surfaces at runtime in the browser console.

**How to avoid:**
Decide consciously: either (a) ship `style-src 'self' 'unsafe-inline'` — acceptable for an internal tool (style injection is a low-severity vector) paired with `default-src 'self'`, `script-src 'self'`, `frame-ancestors 'none'`, `img-src 'self' data:`, `connect-src 'self'`; or (b) refactor inline styles (cell colors) to Tailwind utility classes and then ship a strict `style-src 'self'` (Tailwind prod builds emit a static CSS file, allowed by `'self'`). Audit `style={{` usages before writing the header; verify in a real browser session + e2e screenshot test after shipping.

**Warning signs:**
A CSP header added in the same commit as "security hardening" with no visual verification; any `style={{` in components; "Refused to apply inline style" in the browser console.

**Phase to address:**
Phase "upload + security hardening" — CSP must be planned with a style-source audit first.

---

### Pitfall 10: Health endpoint behind auth / CORS left wide open

**What goes wrong:**
`APP_GUARD` is global, so `GET /api/health` 401s monitors and load balancers that don't hold tokens — uptime checks fail and deploy verification false-negatives. Meanwhile `enableCors()` with no origin restriction lets any website call the API: mostly mitigated by bearer auth, but if `AUTH_ENABLED=false` in any deployment, any origin can read schedules and overwrite the planning.

**Why it happens:**
The guard is registered globally for convenience and no route opts out; CORS was enabled for dev convenience (Vite on :5174) and never restricted when prod (same-origin nginx proxy) made it unnecessary.

**How to avoid:**
Add the documented `@Public()` decorator (`SetMetadata('isPublic', true)` + `Reflector.getAllAndOverride` check in the guard) and mark the health controller public. For CORS: restrict `origin` to the deployed webapp origin, or drop CORS entirely in prod since nginx proxies same-origin (keep it only in dev with the Vite origin). Never assume `AUTH_ENABLED=false` deployments are unreachable.

**Warning signs:**
`curl /api/health` without a token returns 401; `Access-Control-Allow-Origin: *` in prod responses; CI deploy verification that never actually hits the health endpoint.

**Phase to address:**
Phase "upload + security hardening" — with a post-deploy verification step that polls the public health endpoint.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Duplicate date helpers in api + webapp | No shared-package rebuild dance | One copy fixed for local time, the other not → divergent calendars | Never — move to `shared/` (its stated purpose) |
| Identity by raw row index with silent `forEach` skip | Simple parser, no name normalization | Off-by-one person shifts with zero feedback | Never — always warn on count drift |
| `readJson` swallowing all errors | No crash on corrupt file | Corrupted planning silently reads as "no planning uploaded" | Never — log + startup corruption check |
| Relying on nginx's default 1 MB body limit | Zero config | Dev/prod divergence; bare 413s; not a real policy | Never — set both layers explicitly and equal |
| `style={{…}}` for cell colors | Fast to write | Blocks strict CSP; forces `'unsafe-inline'` forever | MVP only; refactor to classes before hardening |
| No request sequencing in middleware | Simpler middleware | Intermittent stale-month display bugs | Never — sequencing is ~10 lines |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| exceljs date cells | Reading `Date` values with local getters (or `cell.text`) | Extract via `getUTC*` (wall-clock intent) or manual serial conversion; no `toISOString()` in the parse path |
| exceljs numeric cells | Assuming time cells are always `Date` | Handle `Number` (serial fraction) explicitly; warn when uninterpretable |
| Excel 1904 date system | Hard-coding the 1899-12-30 epoch | Check `workbook.properties.date1904` and offset by 1462 days (legacy Mac workbooks still circulate) |
| multer + nginx | Configuring only one layer | Set `limits.fileSize` in `FileInterceptor` AND `client_max_body_size` in nginx to the same value |
| multer `fileFilter` | Expecting rejection to throw | `cb(null, false)` silently skips the file — the controller must check for a missing `req.file` and respond 400 |
| Keycloak JWKS issuer | Leaving the `http://localhost:8080/...` default in prod | Validate the issuer is `https://` at startup; fail fast with a clear message |
| PWA service worker + uploads | `NetworkFirst` cache with 24h `maxAgeSeconds` serving stale planning after another device uploads | Cap `maxAgeSeconds` to minutes or bypass the cache for `/api/planning` GETs; invalidate on upload |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded upload (memory storage) | API RAM climbs per upload; OOM under concurrency | multer `fileSize` limit + nginx cap | A single large/zip-bomb file; 2–3 concurrent uploads |
| O(people × days) schedule payload, full person objects per day | Sluggish month navigation with 50+ people | Server-side `?people=` filter or cell-index refs instead of repeated name/color objects | ~50 people × 31 days already borderline on mobile |
| Cell-by-cell `getCell` scanning | Slow parses on styled/empty-heavy sheets | `eachRow`/`getSheetValues` once | Sheets > ~1k rows with styled empties |
| Ignored-not-cancelled stale fetches | Wasted bandwidth on rapid month clicks | Sequencing (ignore) is enough; abort only if payloads grow | Only if payloads reach MBs |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| No upload size limit | Memory-exhaustion DoS (authenticated or not) | `FileInterceptor` limits + `ParseFilePipe` (size + type) + matching nginx cap |
| Open CORS (`enableCors()` with no origin) | Any origin can call the API when auth is off; schedule reads/writes exposed | Restrict origin to the deployed app; drop CORS in prod (same-origin proxy) |
| CSP with `style-src 'self'` while inline styles exist | Calendar colors silently disappear; dev styles break | Audit `style={{…}}` first; ship the `'unsafe-inline'` tradeoff or refactor to classes |
| Health behind the global auth guard | Monitors/LB probes 401; deploy verification blind | `@Public()` decorator + Reflector check in the guard |
| JWKS fetched over `http://` | MITM can substitute keys and forge tokens | Validate the issuer scheme at startup; fail closed |
| No rate limiting on upload | Disk fill / CPU exhaustion via repeated uploads | `@nestjs/throttler` on upload + config routes (or nginx `limit_req`) |
| Runtime image with devDependencies | Bigger attack surface (ts-node, jest, CLI in prod) | `yarn install --production` in the runtime stage |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent parser drops (rows, numeric cells, role-collision names) | "My shift disappeared" or someone else's schedule under my name — no explanation | Upload result screen listing `ParsingWarning`s in French, naming the week/cell |
| Impossible start date accepted | Whole calendar 500s until a manual config fix | Reject at upload with a French message; offer ConfigModal pre-filled |
| 413 from nginx surfacing as a raw error | "Importer" fails cryptically; user retries the same big file | French error message with the size limit; client-side pre-check of file size |
| "Today" wrong between 00:00–02:00 | Night-shift worker sees yesterday highlighted | Local-time date keys from `shared/` helpers |
| Stale month under a wrong label after fast navigation | User reads the wrong week's schedule | Sequencing in the middleware + clear `days` on error |
| Keycloak outage at boot | Blank page; schedule unreadable despite the PWA | Loading shell + timeout; auth-degraded read mode |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Parser warnings:** Row-count/role-collision warnings *exist* — verify they actually reach the UI after upload (not just the console), and that every silent-drop path emits one
- [ ] **Start-date validation:** "31 février" rejected — verify with a unit test, not a manual curl; also verify "29 février" in a non-leap year
- [ ] **Numeric time cells:** Handling exists — verify a `9.5` cell produces a shift or a warning, never silent `{type:'none'}`
- [ ] **Local-time dates:** Verify on a `TZ=Europe/Paris` CI job *and* a `TZ=UTC` job; verify at 00:30 local (in a test, not manually)
- [ ] **Shared date math:** Verify api and webapp both import from `@planning-espoir/shared` (grep for duplicated helpers) and `shared` is rebuilt before tests
- [ ] **Upload limits:** API `fileSize` and nginx `client_max_body_size` match — verify with an e2e oversized upload and a prod-config check; 413 must be user-friendly in French
- [ ] **CSP:** Header shipped — verify the calendar still shows colors in a real browser and dev mode still styles; check the console for "Refused to apply"
- [ ] **Health endpoint:** Verify `GET /api/health` returns 200 without a token with `AUTH_ENABLED=true`
- [ ] **Race handling:** Verify with a middleware test that resolves responses in reverse order; verify `*_ERROR` clears `days`
- [ ] **Docker pruning:** Verify the runtime image's `node_modules` lacks devDeps (e.g. `docker run … ls node_modules | grep jest` fails)

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Impossible startDate bricking the schedule endpoint | MEDIUM | ConfigModal fix is the workaround; permanent fix = reject at upload; until then, make `getSchedule` degrade to warnings instead of 500 |
| Corrupt `planning.json` | MEDIUM | Keep last-good JSON (A/B rotation or backup); startup check that logs and restores; the current silent "no planning" is the worst outcome |
| Stale month displayed | LOW | Reload fixes it; sequencing fix is small; add the middleware test before shipping |
| Cell colors disappear after CSP | LOW | Remove/relax `style-src` or add `'unsafe-inline'` — then verify with a screenshot test next time |
| Off-by-one person shifts from row drift | HIGH | Cannot be reconstructed from parsed JSON (identity was lost); recovery = re-upload the original file with warnings on; prevention is the only real fix |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| TZ-shifted exceljs dates | Phase "parser robustness" | Fixture time cell parses to `{h:8,m:0}` under both `TZ=Europe/Paris` and `TZ=UTC` |
| Numeric time cells dropped | Phase "parser robustness" | `9.5` cell → parsed HH:MM or visible warning; unit test |
| Silent row-drop / identity shift | Phase "parser robustness" | Row-count mismatch + name-collision fixtures produce warnings; UI shows them |
| Impossible start dates | Phase "parser robustness" | "31 février" upload rejected with a French message; no 500 on schedule |
| UTC "today"/month keys | Phase "shared calendar math" | `todayKey()` returns the local day at 00:30 Paris in a test |
| DST week-rotation drift | Phase "shared calendar math" | Rotation fixtures crossing March/October DST boundaries |
| Stale async responses | Phase "webapp async robustness" | Middleware test with reversed resolution order; `*_ERROR` clears `days` |
| Upload limits bypass/mismatch | Phase "upload + security hardening" | e2e oversized upload → 413 with a French message; nginx config equals the API limit |
| CSP breaking inline styles | Phase "upload + security hardening" | Style-source audit first; browser/screenshot check after the header ships |
| Health/CORS misconfig | Phase "upload + security hardening" | `curl /api/health` without a token → 200; no CORS wildcard in prod responses |

## Sources

- Microsoft Support — "Date systems in Excel" (1900/1904 epochs, 1462-day difference) — HIGH
- openpyxl `utils/datetime` docs (WINDOWS_EPOCH 1899-12-30, `from_excel` divmod conversion) — HIGH
- `xls` (Rust) crate docs — date serials, Lotus 1-2-3 leap-year bug (serial 60 = 1900-02-29) — HIGH
- libxlsxwriter — "Working with Dates and Times" (fractional day, Excel dates carry no timezone, 1 ms resolution) — HIGH
- unexcel vignette — "excel-date-systems" (cell value vs. `numFmt` decides date-ness; built-in date format ids 14–22, 45–47) — HIGH
- MDN — `Date`, `Date.parse()` (date-only form = UTC, spec quirk), CSP `style-src` (inline style attributes; hashes don't apply to them) — HIGH
- yutils — "Timezone Pitfalls in JavaScript" (UTC instants, DST 23/25h days, IANA zones) — HIGH
- OpenReplay blog — "Handling Time Zones in JavaScript" (store UTC, convert at display) — HIGH
- exceljs issues #486, #1404, #2353 + StackOverflow 67332651 (Date values shifted by host TZ; "+2 hours" on a GMT+2 server) — HIGH (multiple reports agree)
- reduxjs/redux-toolkit issue #1117 (requestId sequencing; ignore-not-cancel guidance from maintainers) — HIGH
- Netguru blog — "A Way of Dealing With Race Conditions in Redux" (request ID counter pattern) — HIGH
- NestJS docs — file upload (FileInterceptor options, ParseFilePipe validators); authentication/authorization (`@Public()` + `SetMetadata` + `Reflector.getAllAndOverride`); `multer.utils.ts` source (`LIMIT_FILE_SIZE` → `PayloadTooLargeException` 413) — MEDIUM (library docs)
- Tailwind discussion #13326 + shadcn-ui issue #4461 (inline styles vs. strict CSP; prod builds emit static CSS) — HIGH
- Project-internal: `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md` (verified against code, 2026-08-24) — HIGH

---
*Pitfalls research for: Planning Espoir (Excel planning → web calendar)*
*Researched: 2026-08-24*
