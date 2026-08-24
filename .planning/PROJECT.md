# Planning Espoir

## What This Is

A web app for a French social-care team: upload an Excel work-planning document and consult anyone's schedule on a month calendar. The upload is re-parsed on each update, so the displayed schedule always matches the latest document. Single-page app (React + NestJS), one planning at a time, accessible from desktop and mobile (PWA).

## Core Value

The displayed schedule always matches the latest uploaded planning document — a person's shifts are read correctly, on any device, no matter how often the Excel changes.

## Business Context

<!-- Internal team tool; no revenue model. -->

- **Customer**: French social-care team members (educators/ES/TISF staff) consulting who works when
- **Success metric**: Schedule correctness after each upload — zero silent misparses; latest document always visible

## Requirements

### Validated

Shipped and relied upon capabilities (inferred from existing code, ADR-0001–0007):

- ✓ Excel planning upload, parsed once per upload by the API with `exceljs` — ADR-0002
- ✓ Month calendar rendering with per-person colored cells, Monday-first grid — ADR-0005
- ✓ Week rotation S1–S6: any date maps to a template week by Euclidean modulo from `config.startDate` — ADR-0003
- ✓ Person identity by row index within the S1 block (spellings vary across weeks); `colorIndex` from S1 order — ADR-0004
- ✓ Config: user-correctable `startDate`, multiple auto-selected `defaultNames` — ADR-0006
- ✓ Week number badges (S1–S6) on Sundays from API response — ADR-0007
- ✓ Keycloak OIDC auth (JWKS verification, group check) with mock mode for local dev
- ✓ PWA: offline caching of the planning API + install prompt
- ✓ Deploy: Docker Compose (api + nginx webapp) + GitLab CI pipeline
- ✓ Redux store with classic reducers and the uniform `*_REQUESTED → *_START/_SUCCESS/_ERROR` middleware pattern

### Active

Current improvement targets — robustness and correctness gaps surfaced by the codebase map (CONCERNS.md):

- [ ] Parser never silently corrupts: warnings for week-block row-count mismatches and role-regex name collisions
- [ ] Impossible start dates rejected at upload (no 500 bricking of the schedule endpoint)
- [ ] Numeric time cells parsed or warned instead of silently dropped
- [ ] Stale schedule responses never overwrite a newer month in the UI
- [ ] Dates handled in local timezone (France), not UTC
- [ ] Upload size limits enforced (multer + nginx), matching dev/prod behavior
- [ ] Shared calendar math lives in `shared/`, not duplicated per package
- [ ] Dead code removed (`colorsReducer`, `resolveUsername`)
- [ ] Security hardening: CORS restriction, CSP headers, public `/api/health`, rate limiting on upload
- [ ] Docker image pruned of devDependencies; post-deploy verification in CI

### Out of Scope

- Multi-planning storage / history / versioning — requires a storage redesign; deliberately deferred (scaling path)
- Editing schedules in the app — the Excel remains the source of truth
- Database migration — flat files under `DATA_DIR` were chosen deliberately (ADR-0002)
- Native mobile app — the PWA covers mobile needs
- User accounts / permissions beyond the existing Keycloak group check — the team shares one planning

## Context

- Existing, deployed brownfield project: Yarn workspaces monorepo (`shared` / `api` / `webapp`), TypeScript strict, Node 22, git clean history with ADRs 0001–0007 and superpowers plans/specs.
- The Excel source has 6 template weeks S1–S6; the parser encodes the layout as hard-coded constants (column groups, week labels, French month names) and is the most fragile surface — every change needs the workbook fixture + parser specs.
- Parser warnings are the only user-visible signal for unrecognized cells; silent-drop paths today corrupt schedules with no feedback.
- The API is flat-file backed (no DB, no cache); concurrent uploads are last-write-wins.
- Storage writes are atomic (tmp+rename) but `readJson` swallows all errors — a corrupted file surfaces as "no planning uploaded".
- `IMPROVEMENTS.md` (remarks backlog) and `MANUAL_EDITS.md` (hand-edits to verify) are currently empty; they feed future plans.

## Constraints

- **Tech stack**: NestJS 11 (api), React 19 + Vite 8 + Tailwind CSS v4 (webapp), Redux with `thunk: false` — ADR-0001/0005
- **Redux (non-negotiable)**: classic reducers and custom middlewares only — no thunks, no slices, no `createReducer`; new async flows must follow the `*_REQUESTED → *_START/_SUCCESS/_ERROR` pattern
- **Parsing**: the browser never parses Excel — the API parses once per upload with `exceljs` and serves normalized JSON
- **Shared types**: consumed from `dist/` — rebuild `shared` after any edit before typecheck/tests
- **Env**: one root `.env` for both apps; `VITE_*` vars are build-time, API vars runtime
- **Calendar**: Monday-first week indexing consistently in API and webapp
- **Language**: communication with users in French; code, docs, and tests in English

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Yarn workspaces monorepo: shared / api / webapp | Single source of truth for domain types; one repo, one pipeline | ✓ Good (ADR-0001) |
| API parses Excel once with exceljs; flat-file storage, no database | One planning at a time; simplest reliable persistence; no infra | ✓ Good (ADR-0002) |
| Week rotation: Euclidean mod 6 from user-correctable `startDate` | Maps real dates to S1–S6 template weeks regardless of year drift | ✓ Good (ADR-0003) |
| Person identity by S1 row index, not name | Names vary in spelling across weeks; positional identity is stable | ✓ Good (ADR-0004) |
| Classic Redux + one custom middleware, thunks disabled | Uniform async flow, easy to trace; team preference | ✓ Good (ADR-0005) |
| Multiple default persons auto-selected | The same handful of people are viewed every day | ✓ Good (ADR-0006) |
| Sunday week-number badges computed in the API | Single source of truth for week math; UI stays dumb | ✓ Good (ADR-0007) |
| Keycloak OIDC with group check + mock mode | Team already on Keycloak gateway; local dev without IdP | ✓ Good |
| PWA with NetworkFirst caching of planning GETs | Mobile access to schedules offline | ⚠️ Revisit — stale-cache window vs "latest document" promise |

---
*Last updated: 2026-08-24 after initialization*
