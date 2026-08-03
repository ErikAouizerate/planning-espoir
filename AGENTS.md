# Planning Espoir

Single-page app that uploads an Excel planning document and displays a person's work schedule on a calendar. The upload is re-parsed on each update so the displayed schedule always matches the latest document.

Communication with the user is in French; all code, documentation, and tests in English.

## Repo state

Greenfield — no code and no commits yet. The only committed content is this file plus `docs/` and the git history as they grow. The "Architecture" and "Commands" sections below are the target contract, not yet present in the tree. `docs/adr/` is planned but the ADR files do not exist yet. An implementation plan exists at `docs/superpowers/plans/2026-08-03-planning-espoir.md` and is the reference for the first build.

## Workflow (superpowers)

Build feature-by-feature via the superpowers planning loop:

1. Brainstorm the feature with the user (in French).
2. Record each design decision as an ADR in `docs/adr/`.
3. Write the implementation plan in `docs/superpowers/plans/`.
4. Implement and commit incrementally, one plan per commit.
5. Every feature ships with tests and passes lint + typecheck.

Confirm any architecture change with the user before committing to it.

## Target architecture (validated)

- Monorepo with yarn workspaces: `shared/` = cross-package domain types, `webapp/` = React + Vite SPA, `api/` = NestJS backend. Root `package.json` defines the workspace.
- Deployable with Docker + docker-compose.
- No database: the date ↔ template-week correlation and the default user name are stored as flat files (shared by all users). The API stores the uploaded `.xlsx` plus a normalized JSON model under a `DATA_DIR` (default `./data`).
- One page only; a dropdown lists all available names (multi-select allowed), default name comes from the flat file.
- Auth: Keycloak via OIDC — design for it, do not implement yet (details TBD).

## Frontend constraints (non-negotiable)

- Tailwind CSS.
- Redux with custom middlewares and plain classic reducers — no Redux Thunk, no slices, no `createReducer`.

## Commands (target, once scaffolding exists)

Run from the repo root (yarn workspaces):

- `yarn install` — install all workspace dependencies
- `yarn dev` — Vite dev server (port 5174) + API dev server (port 3000), requires Keycloak running
- `yarn test` / `yarn lint` / `yarn typecheck` / `yarn build` — per-package checks

## Decision history

The user wants a reviewable trace of the LLM-driven creation process. Design decisions live in `docs/adr/`, implementation plans in `docs/superpowers/plans/`. `docs/` and `AGENTS.md` are committed alongside the code they document; update them whenever architecture or scope changes.
