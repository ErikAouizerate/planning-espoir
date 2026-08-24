# Requirements: Planning Espoir

**Defined:** 2026-08-24
**Core Value:** The displayed schedule always matches the latest uploaded planning document — a person's shifts are read correctly, on any device, no matter how often the Excel changes.

## v1 Requirements

Robustness + security hardening milestone. Each maps to roadmap phases.

### DATES — Shared Calendar Math & Local Timezone

- [ ] **DATES-01**: API and webapp consume a single pure calendar-math module in `shared/` (one `weekIndexForDate`/`weekdayIndex`/`monthDays` implementation, no drifted copies)
- [ ] **DATES-02**: "Today" highlight and initial month are computed in local (Europe/Paris) time, not UTC — no wrong-day between 00:00–02:00
- [ ] **DATES-03**: ConfigModal month picker defaults to the local month, not a UTC-derived ISO value
- [ ] **DATES-04**: Week-rotation math is DST-safe (component-based day numbers, no 24-hour steps)
- [ ] **DATES-05**: Date/calendar tests pass under both `TZ=Europe/Paris` and `TZ=UTC` in CI

### PARSER — Never Silent-Corrupt

- [ ] **PARS-01**: Parser emits structured warnings when a week block's row count differs from S1's (with expected/actual counts)
- [ ] **PARS-02**: Parser warns when a name cell matches the role pattern instead of silently swallowing the row
- [ ] **PARS-03**: Numeric time cells are parsed to HH:MM or produce a warning — never silently dropped to empty
- [ ] **PARS-04**: Impossible start dates (e.g. "31 février") are rejected at upload with a 4xx French message; the previous planning stays intact
- [ ] **PARS-05**: Parser warnings persist in `planning.json` and are served by the planning/schedule endpoints

### WEBAPP — Async Robustness & Trust UX

- [ ] **WEB-01**: Out-of-order schedule responses are dropped — the latest requested month always wins
- [ ] **WEB-02**: A failed schedule fetch clears stale days/sundayWeeks (no mismatched month label vs content)
- [ ] **WEB-03**: Upload health report rendered on the calendar page: persistent, French, actionable warning messages (naming week/cell where relevant)
- [ ] **WEB-04**: Upload success/failure feedback with actionable French messages (incl. friendly handling of oversized files)

### SECURITY — Upload Limits & Hardening

- [ ] **SEC-01**: Upload size is limited in the API (multer) and nginx (`client_max_body_size`) in lockstep; oversized uploads return a friendly 413, not a bare page or 500
- [ ] **SEC-02**: CORS restricted to allowed origins from env (no wide-open `enableCors()`)
- [ ] **SEC-03**: CSP + security headers set by nginx; PWA service worker (`worker-src`) and Keycloak origins (`connect-src`/`frame-src`) allowed; calendar cell colors keep rendering
- [ ] **SEC-04**: `/api/health` is public (no bearer token) so monitors work
- [ ] **SEC-05**: Rate limiting on API endpoints, keyed on `x-forwarded-for` behind the proxy
- [ ] **SEC-06**: Docker runtime image pruned of devDependencies (smaller, less attack surface)
- [ ] **SEC-07**: Dead code removed (`colorsReducer`, `resolveUsername`)
- [ ] **SEC-08**: CI verifies deployment health after deploy (no fire-and-forget webhook)

## v2 Requirements

Deferred to a future release. Tracked but not in the current roadmap.

### Freshness & Trust

- **FRESH-01**: "Last updated" indicator on the calendar page
- **FRESH-02**: Auto-refresh of the schedule after an upload from another device
- **FRESH-03**: Offline/cache-served data labeled with its sync date
- **FRESH-04**: Deterministic concurrent-upload handling (upload versioning) — last-write-wins stays today

### Parser

- **PARS-06**: Warning for 1904 date-system workbooks
- **PARS-07**: Canonicalized-name cross-check of week rows against the S1 roster

### UI

- **UI-01**: Color legend on the calendar (if not already present)
- **UI-02**: "Today" marker on the calendar (if not already present)

## Out of Scope

| Feature | Reason |
|---------|--------|
| In-app schedule editing | The Excel remains the source of truth (ADR-0002); the app is a consultation tool |
| Import wizard / guided upload | Upload is a single action for a known template; wizard adds friction |
| Multi-planning / history / versioning | Requires a storage redesign; deliberately deferred (scaling path) |
| Notifications / self-service / payroll / hour totals | Not part of the team's need; competitors' features, anti-features here |
| Print / PDF export | Not requested; browser print of the calendar suffices |
| Real-time sync / WebSockets | Stale-guard + refresh semantics cover the "latest document" promise |
| Time-of-day scheduling | Domain is day-level shifts only |
| User accounts / permissions expansion | Keycloak group check covers the current access model |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATES-01 | Phase 1 | Pending |
| DATES-02 | Phase 1 | Pending |
| DATES-03 | Phase 1 | Pending |
| DATES-04 | Phase 1 | Pending |
| DATES-05 | Phase 1 | Pending |
| PARS-01 | Phase 2 | Pending |
| PARS-02 | Phase 2 | Pending |
| PARS-03 | Phase 2 | Pending |
| PARS-04 | Phase 2 | Pending |
| PARS-05 | Phase 2 | Pending |
| WEB-01 | Phase 3 | Pending |
| WEB-02 | Phase 3 | Pending |
| WEB-03 | Phase 3 | Pending |
| WEB-04 | Phase 3 | Pending |
| SEC-01 | Phase 4 | Pending |
| SEC-02 | Phase 4 | Pending |
| SEC-03 | Phase 4 | Pending |
| SEC-04 | Phase 4 | Pending |
| SEC-05 | Phase 4 | Pending |
| SEC-06 | Phase 4 | Pending |
| SEC-07 | Phase 4 | Pending |
| SEC-08 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-24*
*Last updated: 2026-08-24 after roadmap creation*
