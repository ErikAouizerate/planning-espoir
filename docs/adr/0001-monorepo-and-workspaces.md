# ADR-0001: Monorepo and workspaces

Status: Accepted

## Context

Planning Espoir is a single-page app with a React + Vite frontend, a NestJS API, and a set of domain types shared by both. We need a repository layout that keeps these pieces together, lets them share types, and deploys as one unit.

## Decision

Use a yarn-workspaces monorepo with three workspaces: `shared/` (cross-package domain types), `api/` (NestJS backend), `webapp/` (React + Vite SPA), declared in a root `package.json`. Deployment is via Docker + docker-compose. There is no database: state lives in flat files under a `DATA_DIR`. Keycloak OIDC authentication is designed for but not implemented yet.

## Consequences

- Domain types live once in `shared/` and are consumed by `api/` and `webapp/`, avoiding drift.
- Root scripts (`build`, `dev`, `test`, `lint`, `typecheck`) orchestrate all workspaces.
- No database dependency simplifies local setup and Docker deployment.
- OIDC integration remains a future task; routes are structured so a guard can be added later.
