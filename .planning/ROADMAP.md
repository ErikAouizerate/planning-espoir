# Roadmap: Planning Espoir — Robustness & Security Hardening

## Overview

This milestone hardens the existing Planning Espoir app (Excel planning upload → month calendar) toward the success metric "zero silent misparses". The work builds in dependency order: shared calendar math is deduplicated and made France-timezone-correct first (Phase 1), the parser is made incapable of silently corrupting data — every ambiguity becomes a persisted warning and impossible dates are rejected (Phase 2), the webapp surfaces those warnings and guards against stale/partial data (Phase 3), and finally the deploy surface is hardened with lockstep upload limits, CORS/CSP/rate limiting, a pruned Docker image, and post-deploy verification (Phase 4).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Shared Calendar Math & Local Timezone** - Single timezone-correct calendar-math module consumed by API and webapp
- [ ] **Phase 2: Parser Robustness — Never Silent-Corrupt** - Structured warnings for every ambiguous parse; impossible dates rejected at upload
- [ ] **Phase 3: Webapp Async Robustness & Trust UX** - Stale-response guard, persistent French warning report, actionable upload feedback
- [ ] **Phase 4: Upload Limits + Security Hardening** - Lockstep upload limits, CORS/CSP/rate limiting, public health, pruned Docker image, dead code removal

## Phase Details

### Phase 1: Shared Calendar Math & Local Timezone
**Goal:** API and webapp compute dates and weeks from one shared, France-timezone-correct calendar module — "today", the initial month, and the S1–S6 week rotation can no longer drift apart or shift by timezone.
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** DATES-01, DATES-02, DATES-03, DATES-04, DATES-05
**Success Criteria** (what must be TRUE):
  1. A user opening the app between 00:00 and 02:00 (Europe/Paris) sees today's date highlighted and the current France month — never yesterday (DATES-02, DATES-03)
  2. The week-rotation mapping of any date to S1–S6 stays stable across DST boundaries (spring-forward 2026-03-29, fall-back 2026-10-25) (DATES-04)
  3. Month grid and weekday indexing come from one shared module — API schedule projection and webapp grid agree on every month (DATES-01)
  4. The date/calendar test suite passes under both `TZ=Europe/Paris` and `TZ=UTC` in CI (DATES-05)
**Plans:** TBD
**UI hint:** yes

### Phase 2: Parser Robustness — Never Silent-Corrupt
**Goal:** No upload can silently corrupt a schedule: every ambiguous cell or structural drift becomes a structured, persisted warning, and impossible start dates are rejected with the previous planning intact.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** PARS-01, PARS-02, PARS-03, PARS-04, PARS-05
**Success Criteria** (what must be TRUE):
  1. Uploading a planning where a week block's row count differs from S1's succeeds but produces a warning naming the week with expected/actual counts (PARS-01)
  2. A name cell matching the role pattern produces a warning — the row is never silently swallowed (PARS-02)
  3. Numeric time cells are parsed to HH:MM or produce a warning — never a silent empty cell (PARS-03)
  4. Uploading a planning with an impossible start date (e.g. "31 février") is rejected with a French 4xx message and the previously displayed schedule stays intact (PARS-04)
  5. Parser warnings persist in `planning.json` and are served by the planning/schedule endpoints, so they re-appear after a page reload (PARS-05)
**Plans:** TBD

### Phase 3: Webapp Async Robustness & Trust UX
**Goal:** The calendar can never show stale or partial data, and every upload/parse outcome is visible to the user through persistent, French, actionable messages.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** WEB-01, WEB-02, WEB-03, WEB-04
**Success Criteria** (what must be TRUE):
  1. Rapid month navigation never shows the wrong month — the latest requested month always wins even when responses arrive out of order (WEB-01)
  2. A failed schedule fetch clears the previously shown days/week badges — the month label and content can never mismatch (WEB-02)
  3. The calendar page shows a persistent French upload-health report naming the affected week/cell (WEB-03)
  4. Upload success and failure give actionable French feedback, including a friendly message for oversized files (WEB-04)
**Plans:** TBD
**UI hint:** yes

### Phase 4: Upload Limits + Security Hardening
**Goal:** The deployed app enforces upload limits and security policy consistently across dev and prod, ships lean, and is verified after every deploy.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07, SEC-08
**Success Criteria** (what must be TRUE):
  1. Uploading a file over the limit returns a friendly French 413 in the UI, identically in dev and prod (SEC-01)
  2. Requests from origins outside the env whitelist are rejected while the calendar keeps working from the allowed origin; CSP/security headers are served and the calendar colors, PWA service worker, and Keycloak login all keep functioning (SEC-02, SEC-03)
  3. `/api/health` returns 200 without a bearer token, so external monitors work (SEC-04)
  4. Rate limiting is enforced on API endpoints, keyed on the real client IP behind the proxy (SEC-05)
  5. The Docker runtime image excludes devDependencies; dead code (`colorsReducer`, `resolveUsername`) is gone with no visible change; CI verifies deployment health after each deploy (SEC-06, SEC-07, SEC-08)
**Plans:** TBD
**UI hint:** yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Shared Calendar Math & Local Timezone | 0/TBD | Not started | - |
| 2. Parser Robustness — Never Silent-Corrupt | 0/TBD | Not started | - |
| 3. Webapp Async Robustness & Trust UX | 0/TBD | Not started | - |
| 4. Upload Limits + Security Hardening | 0/TBD | Not started | - |
