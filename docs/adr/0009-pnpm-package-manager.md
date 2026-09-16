# ADR-0009: pnpm as the package manager

Status: Accepted

## Context

The monorepo used yarn (classic) workspaces with a committed `yarn.lock`. The fleet standardises on pnpm, which offers a single lockfile format, a content-addressable store, and native supply-chain controls. pnpm's symlinked layout also changes how some tools resolve dependencies (notably Jest and ESM-only packages).

## Decision

Use pnpm for the whole monorepo.

- `pnpm-workspace.yaml` declares the packages and the hardening settings: `minimumReleaseAge: 10080`, `minimumReleaseAgeStrict: true`, `blockExoticSubdeps: true`, `strictDepBuilds: true`, and explicit `allowBuilds` for the packages that legitimately need lifecycle scripts (`esbuild`, `sharp`, `@tailwindcss/oxide`).
- The root `package.json` pins `packageManager: pnpm@11.18.0`, requires Node >= 22, and exposes the orchestration scripts through `pnpm --filter`.
- `yarn.lock` is replaced by `pnpm-lock.yaml`; workspace dependencies use the `workspace:*` protocol.
- Docker images and GitLab CI install with `pnpm install --frozen-lockfile`; the CI caches the pnpm store (not `node_modules`, whose symlinks do not survive artifact transfer).

## Consequences

- Jest's `transformIgnorePatterns` must account for the `node_modules/.pnpm/<pkg>/node_modules/...` nesting, otherwise the ESM-only `jose` cannot be transformed.
- The API runtime image copies both the root `node_modules` and `api/node_modules`, since pnpm's symlinks live in both.
- `trustPolicy: no-downgrade` is deliberately **not** enabled: it produced false positives (chokidar via `@nestjs/cli`, a workbox transitive dep) for releases that merely lack provenance attestation, and is not part of the canonical pnpm policy.
- A few versions are allow-listed through `minimumReleaseAgeExclude` (rolldown platform bindings, `multer@2.4.0`); these entries can be dropped once older than the cooldown window.
