# Feature Research

**Domain:** Personnel work-schedule planning — Excel planning upload → web calendar consultation (French social-care team)
**Researched:** 2026-08-24
**Confidence:** MEDIUM (web sources cross-checked; local codebase facts HIGH)

## Feature Landscape

Research scope: improvement targets for an existing, deployed app (NestJS 11 + React 19/Vite 8, PWA, Keycloak). The four research questions were: (1) how robust tools surface parse/validation problems, (2) what "displayed schedule always matches the latest document" requires in UX, (3) correct timezone behavior for a France-only audience, (4) table stakes vs differentiators for schedule display.

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete. Items already shipped are marked ✓; the gaps below are where the improvement targets bite.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Month calendar, Monday-first grid ✓ | French calendar convention; the whole product is built on it | — | Shipped (ADR-0005) |
| Per-person colored cells ✓ | Color is the fastest "who works when" signal | — | Shipped; **verify a color legend/key exists** — calendar tools universally provide one (When2Work, Skello) |
| Today highlighted | Any calendar without a today marker feels broken | LOW | Standard calendar affordance; verify it exists in the month grid |
| Day-off/absence badges (RH cells) ✓ | Working/not-working is the #1 question; absence must be visible | — | Shipped as colored badges (ADR-0005) |
| Month navigation (prev/next) ✓ | Consulting next month's planning is the core use case | — | Shipped |
| Week numbers (S1–S6) ✓ | The team reasons in template weeks, not dates | — | Shipped (ADR-0007) |
| Person multi-select, persisted ✓ | Same handful of people consulted daily | — | Shipped (ADR-0006); default selection is an editable preference only |
| **Upload success/failure feedback with actionable message** | Uploading is the only mutation; silence reads as failure | MEDIUM | Today: silent-drop paths exist with zero feedback. Needs: success toast, and on failure a message that says *what* was wrong ("not a valid .xlsx — expected an Excel file starting with PK bytes") |
| **Upload size limit, told to the user** | Users must know the ceiling before hitting it (import-UX consensus: "set sensible size limits and tell users about them") | LOW | Multer `limits.fileSize` + matching nginx `client_max_body_size`; UI shows limit and a friendly 413 message |
| **Warnings for anything the parser couldn't fully trust** | Industry import UX: warnings are orange, errors are red; never fail silently. A planning with an unrecognized cell that displays as empty IS a silent misparse | MEDIUM | The milestone's headline target. See Differentiators — this is simultaneously table stakes (no product ships silent data loss) and this app's competitive edge |
| Mobile-readable calendar (PWA) ✓ | Team consults from phones | — | Shipped; freshness labeling needs work (see below) |

### Differentiators (Competitive Advantage)

Features that set the product apart. Aligned with PROJECT.md's core value: *"The displayed schedule always matches the latest uploaded planning document — a person's shifts are read correctly, on any device, no matter how often the Excel changes."*

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Persistent upload health report (warnings attached to the planning, shown on the calendar page)** | "Zero silent misparses" is the success metric. The uploader and the viewer are often different people, so a transient toast at upload time is useless — warnings must live in the normalized model and render wherever the schedule renders: "⚠ 3 cells in S3 week 2 weren't recognized as shifts". This is the single feature that makes the tool trustworthy vs raw Excel | MEDIUM | Parser returns structured warnings (week-block row-count mismatches, role-regex name collisions, numeric time cells). Stored in `planning.json`, served by GET /schedule, rendered as a banner + collapsible list. Errors (file unreadable, impossible startDate) reject the upload with a 4xx and keep the previous planning intact |
| **"Last updated" indicator on the calendar** | Users verify freshness themselves instead of asking "is this the new planning?" — the trust loop closes | LOW | `uploadedAt` (from the upload) + document `fileName` displayed in the header; also the honest signal for PWA-cached data |
| **Stale-response protection (race safety)** | "Always latest" is a lie if an older response can overwrite a newer month. Request tokens in the apiMiddleware + upload versioning server-side make the promise real | MEDIUM | Client: sequence token per resource; only the latest request's SUCCESS commits. Server: concurrent uploads are last-write-wins — add a monotonically increasing version/`uploadedAt` returned by POST /upload and echoed by GETs so the UI can discard older responses |
| **Auto-refresh after upload** | The gap between "upload done" and "calendar updated" is where users think the app is broken | LOW | On upload SUCCESS, immediately refetch config + schedule for the displayed month (no manual reload) |
| **Timezone-naive date handling (France-correct)** | Dates handled as naive calendar days (YYYY-MM-DD) end-to-end; "today" computed in Europe/Paris. DST (23/25h days), UTC-midnight parsing traps and container-in-UTC drift all disappear. Correctness users *feel* as "the right shift on the right day" | MEDIUM | Shared date math moves to `shared/` (day-diff, week index, Paris-today); server computes month grids in naive days, not UTC instants |
| **Offline data explicitly labeled** | PWA offline consultation is shipped; without a "consultation hors-ligne — données du {date}" badge, offline data is indistinguishable from a stale bug | LOW | NetworkFirst with short timeout is acceptable only if cache-served responses carry the staleness label and the SW revalidates on visibilitychange/focus |
| Week view toggle (day/week/month) | Month cells are cramped on phones; a week view is the natural second lens (Skello: "visualisation par semaines et postes"; ShiftApp: day/week/month) | MEDIUM | Nice-to-have; month-first is the confirmed core. Defer — see anti-features on scope discipline |
| 1904 date-system detection | Excel files from old Mac Excel shift every date by 1462 days; the parser should detect `workbook.properties.date1904` and warn | LOW | France uses Windows Excel (1900 system) — rare, but a silent 4-year date shift is catastrophic; cheap insurance |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Scope discipline is the point of this milestone — PROJECT.md explicitly defers everything below.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| In-app schedule editing (drag-and-drop shifts) | "It would be so convenient to fix the planning here" | Destroys the single-source-of-truth model; every edit creates a merge problem with the next Excel upload; turns a consultation app into a scheduling product | The Excel remains the source of truth; edits happen there, upload re-parses. This is a deliberate product boundary (ADR-0002) |
| Full import wizard (column mapping, preview-and-repair, inline editing) | Import tools market this as best practice | The layout is fixed and known (S1–S6 blocks, hard-coded constants); a mapping/repair wizard is dead UI. The value is in *warning* about deviations, not *repairing* them | Warning report with precise, actionable messages ("Semaine S3 : 12 lignes attendues, 9 trouvées") — the app is a viewer, not an editor |
| Multi-planning / history / versioning | Teams often have several plannings | Requires the storage redesign explicitly deferred (out of scope); conflicts with "one planning at a time" simplicity | Keep one planning; the uploaded file `planning.xlsx` is itself the history if the team keeps files |
| Notifications / shift reminders | "I want to be notified of my next shift" | Requires per-user preferences, push infra, and per-user identity beyond the group check — all out of scope | PWA install prompt + the calendar being the single source of truth |
| Employee self-service (swap requests, availability) | Modern scheduling tools have it | Multi-user workflow product; completely different scope | Excel stays the coordination medium |
| Payroll / hour totals / export to pay software | Skello-class features | Payroll correctness has legal weight; the cells are day-level strings, not auditable hours | Out of scope; the tool answers "who works when", not "how many hours" |
| Print / PDF export of the calendar | Teams print plannings for the wall | A printed schedule is stale the moment the Excel changes — it actively undermines the "always latest" promise; print styles are easy but the *process* is the problem | Rely on the PWA on any device; revisit only if a concrete user need appears |
| Real-time sync / WebSockets | "Always latest" sounds real-time | One planning, low upload frequency, pull-based reparse per upload; WebSockets add infra and failure modes for nothing | NetworkFirst with timeout + refresh on visibilitychange + auto-refetch after upload |
| Time-of-day scheduling (shift start/end times as data) | Cells sometimes contain "8h-16h" | The domain is day-level; parsing times as structured data explodes scope (validation, display, DST). The cell *text* already renders as-is | Warn when a numeric/time cell is encountered (per the improvement target) but keep the day-level model |

## Feature Dependencies

```
[Upload warning report]
    └──requires──> [Structured parser warnings (row counts, name collisions, numeric time cells)]
                       └──requires──> [Normalized model stores warnings (planning.json schema)]
                                          └──requires──> [GET /schedule returns warnings]
                                              └──requires──> [Calendar page renders warning banner + list]

[Impossible start date rejected at upload]
    └──requires──> [Upload validation returning 4xx and keeping previous planning intact]

[Stale-response protection]
    └──requires──> [Request tokens in apiMiddleware]
    └──enhances──> [Upload version/uploadedAt in API responses]

[Auto-refresh after upload] ──requires──> [Upload SUCCESS action triggers schedule/config refetch]

[Last-updated indicator] ──requires──> [uploadedAt stored at upload time]

[Timezone-naive dates] ──requires──> [Shared date math in shared/ (day-diff, week index, Paris-today)]
                                      └──requires──> [shared rebuilt + consumed from dist/ by api and webapp]

[Upload size limits] ──requires──> [Multer limits.fileSize]
    └──requires──> [nginx client_max_body_size matching]   (else nginx 413s before NestJS can give a friendly error)

[Public /api/health] ──requires──> [@Public() decorator + guard Reflector check]

[CSP headers] ──conflicts──> [React inline style attributes (per-person colors)]
    (style-src 'self' only would break the calendar's colors; resolution: script-src strict, style-src 'self' 'unsafe-inline')

[PWA offline label] ──conflicts──> [PWA NetworkFirst cache window] (label is the mitigation, not a fix)

[Week view] ──enhances──> [Month calendar] (independent; P3, separate from this milestone)
```

### Dependency Notes

- **Warning report requires structured parser warnings:** warnings are only as good as the parser's ability to enumerate them; the parser must return `{ errors: [], warnings: [] }` rather than throw-or-drop. This is the core refactor of the milestone.
- **Warnings must persist in the model:** because uploader ≠ viewer, a toast at upload time is not enough — the calendar page itself must show the health of the data it renders.
- **Upload versioning enables stale-response protection:** the client can only discard "old" responses if the API tells it how new each response is (`uploadedAt`/version on GET /schedule).
- **CSP conflicts with per-person colors:** React inline `style` attributes require `'unsafe-inline'` in `style-src` (or nonce/hashes — hashes break on every color change, nonces require SSR). Industry consensus: keep `script-src` strict, allow `style-src 'self' 'unsafe-inline'`; CSS-only attacks are low-risk vs script injection.
- **Size limits are a two-layer problem:** nginx `client_max_body_size` must be ≥ the multer limit, otherwise users get a bare nginx 413 instead of the app's friendly message; dev (no nginx) and prod must behave the same — this is an explicit improvement target.

## Recommended Improvement Scope

Adapted to the subsequent-milestone context: "launch with" = this milestone's targets (P1), then next milestone (P2), later (P3).

### This Milestone (P1)

- [ ] Structured parser warnings — week-block row-count mismatches, role-regex name collisions, numeric time cells parsed-or-warned; never silent-drop
- [ ] Warning report persisted in the model and rendered on the calendar page (banner + actionable list, in French)
- [ ] Impossible start dates rejected at upload (4xx with clear message; previous planning stays intact — no 500 bricking the schedule endpoint)
- [ ] Stale schedule responses never overwrite a newer month (request tokens in apiMiddleware)
- [ ] Timezone-naive date handling (naive YYYY-MM-DD end-to-end; "today" in Europe/Paris; no UTC drift, no DST math)
- [ ] Upload size limits enforced identically dev/prod (multer + nginx aligned, friendly 413 message)
- [ ] Shared calendar math lives in `shared/` (single source of truth, consumed from dist/)
- [ ] Security hardening: CORS restriction, CSP headers (script-src strict, style-src 'unsafe-inline'), public `/api/health`, rate limiting on upload
- [ ] Dead code removed (`colorsReducer`, `resolveUsername`); Docker image pruned of devDependencies

### Next Milestone (P2)

- [ ] "Last updated" + file name indicator on the calendar (closes the freshness trust loop)
- [ ] Auto-refresh of schedule/config after upload SUCCESS
- [ ] PWA offline data labeled with its sync date; SW revalidate on visibilitychange/focus
- [ ] Color legend/key on the calendar (verify it doesn't exist already; if it does, this item drops)
- [ ] 1904 date-system detection warning (cheap insurance against silent 4-year date shifts)

### Later (P3)

- [ ] Week view toggle — trigger: mobile users complain about cramped month cells
- [ ] Print styles — trigger: a concrete request from the team (currently judged an anti-feature)
- [ ] Parse event logging for debugging — trigger: repeated unparseable uploads from users

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Structured parser warnings (no silent drops) | HIGH | MEDIUM | P1 |
| Warning report UI on calendar page | HIGH | MEDIUM | P1 |
| Impossible startDate → clean 4xx rejection | HIGH | LOW | P1 |
| Stale-response protection (race safety) | HIGH | MEDIUM | P1 |
| Timezone-naive dates (France-correct) | HIGH | MEDIUM | P1 |
| Upload size limits (multer + nginx aligned) | MEDIUM | LOW | P1 |
| Shared date math in `shared/` | MEDIUM | LOW | P1 |
| Security hardening (CORS, CSP, health, rate limit) | MEDIUM | LOW-MEDIUM | P1 |
| Dead code / Docker pruning | LOW | LOW | P1 |
| "Last updated" indicator | MEDIUM | LOW | P2 |
| Auto-refresh after upload | MEDIUM | LOW | P2 |
| PWA offline staleness label | MEDIUM | LOW | P2 |
| Color legend (if missing) | MEDIUM | LOW | P2 |
| 1904 date-system warning | LOW | LOW | P2 |
| Week view toggle | MEDIUM | MEDIUM | P3 |
| In-app editing / wizard / payroll / notifications | — | HIGH | Anti-feature |

## Competitor Feature Analysis

| Feature | Skello (FR SaaS) | Shift scheduling tools (ShiftApp/When2Work/Express Schedule) | Excel (the status quo) | Our Approach |
|---------|------------------|---------------------------------------------------------------|------------------------|--------------|
| Month calendar with per-person colors | ✓ week/position views | ✓ day/week/month views | Manual | ✓ shipped; legend to verify (P2) |
| Parse/validation warnings on import | N/A (native editing, no Excel import) | Mostly silent CSV import, generic errors | No feedback at all — the source of the problem | **Persistent warning report on the calendar page — differentiator** |
| "Always latest document" guarantee | N/A (data edited in-app) | N/A | N/A (the document IS the data) | Race-safe responses, auto-refresh, last-updated indicator |
| Upload error UX | N/A | Generic toasts at best | Cryptic Excel errors | Actionable 4xx messages, size limits communicated, previous planning kept on failure |
| Offline/mobile | Native apps | Native apps | N/A | PWA with labeled offline data |
| Week rotation math (S1–S6) | N/A | N/A | Manual correlation | Euclidean-modulo mapping from user-correctable startDate — domain differentiator |
| Editing, payroll, notifications | ✓ full suite | ✓ partial | ✓ (manual) | Deliberately out of scope — Excel remains source of truth |

## Sources

- Import/validation UX patterns (actionable errors, grouping, color coding, preview, partial import, size limits, magic-byte checks): smart-interface-design-patterns.com bulk-import UX (2025-10), importcsv.com data-import UX (2026-01), xlork.com import best practices (2026-03) — MEDIUM (cross-checked)
- Error-feedback modalities (banner/toast/modal/inline, enterprise multi-screen): pencilandpaper.io error UX analysis — MEDIUM
- File-upload UX expectations (dropzone, progress, validation cues, friendly errors, mobile): eleken.co file-upload UI (2026-02), uxpatterns.dev file-input pattern — MEDIUM
- PWA caching strategies & freshness tradeoffs (network-first w/ timeout, stale-while-revalidate serves stale first, network-only for "stale worse than no data"): magicbell.com offline-first PWAs (2026-03), browser-storage.com SW strategies, MDN PWA caching — MEDIUM (cross-checked)
- React/Redux stale-response prevention (ignore flag, AbortController, sequencing, check flags in error handlers too): unwiredlearning.com (2026-02), javascriptbit.com, localcan.com AbortController guide — MEDIUM (cross-checked)
- Excel serial dates (1899-12-30 epoch, fractional time, 1900/1904 systems, timezone-dependent conversion — SheetJS issue #1804): datamatastudios.com, joteo.net, github.com/SheetJS/sheetjs#1804 — MEDIUM (primary source for #1804)
- JS date pitfalls (UTC-midnight parsing of YYYY-MM-DD, getUTC*, DST 23/25h days, IANA names, Europe/Paris rules): yutils.dev timezone guide (2026-05), devgex.com (2025-11), herodevs.com (2026-06) — MEDIUM (cross-checked)
- exceljs API (cell types, ValueType, date1904, numFmt ignored by toString): context7 /exceljs/exceljs docs — MEDIUM
- NestJS upload validation (ParseFilePipe, MaxFileSizeValidator, multer limits) and global-guard exceptions (@Public() + Reflector): context7 /nestjs/docs.nestjs.com — MEDIUM
- CSP style-src vs React inline styles / Tailwind (unsafe-inline tradeoff, nonce/hash alternatives): MDN style-src, github.com/facebook/react#5878, IBM community (2026-01), csp-examples.com Tailwind CSP (2026-03) — MEDIUM (cross-checked)
- Competitors: skello.io functionality pages & leptidigital.fr Skello analysis (2026-02), ShiftApp/Express Schedule/When2Work/MyShiftWork feature pages (sourceforge, allbestapps) — MEDIUM (marketing sources, feature presence only)
- Local project facts (shipped features, ADRs 0001–0007, active targets): .planning/PROJECT.md, docs/adr/ — HIGH

---
*Feature research for: Planning Espoir (personnel work-schedule planning, Excel upload → web calendar)*
*Researched: 2026-08-24*
