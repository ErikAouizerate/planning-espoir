---
gsd_state_version: '1.0'
status: planning
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-24)

**Core value:** The displayed schedule always matches the latest uploaded planning document — a person's shifts are read correctly, on any device, no matter how often the Excel changes.
**Current focus:** Phase 1 — Shared Calendar Math & Local Timezone

## Current Position

Phase: 1 of 4 (Shared Calendar Math & Local Timezone)
Plan: 0 of 0 in current phase
Status: Ready to plan
Last activity: 2026-08-24 — Roadmap created (4 phases, 22/22 requirements mapped)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 4-phase structure validated against research: Shared Calendar Math → Parser Robustness → Webapp Trust UX → Security Hardening (2026-08-24)
- [Roadmap]: Upload limits and security share one nginx.conf phase (SEC-01 + SEC-03 land together, per architecture's merge recommendation); dead code + Docker pruning + CI verification bundle with hardening (SEC-06/07/08)
- [Roadmap]: Dependency chain — PARS-04 (start-date rejection) needs Phase 1's `isValidDateKey`; PARS-05 (warning persistence) unblocks Phase 3's warning report UI; Phase 4 is deploy-surface last

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- Phase 4 planning needs real deployment values before implementation: Keycloak realm origin (CSP `connect-src`/`frame-src`), deployment origin (CORS), inline-style (`style={{`) audit results, current Dockerfile multi-stage structure.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-09-16
Stopped at: Migrated to pnpm; local dev reconfigured behind Caddy with a cross-origin API (docker-compose.override.yml); base compose now uses expose.
Resume file: None

## ⚠️ À FINIR — debug prod (pas encore déployé/vérifié)

**Le correctif prod (`63f707e`) est commité mais PAS encore testé sur le serveur.**
La prod casse toujours tant que l'image webapp n'est pas rebuildée avec ce commit.

### Cause du bug prod

Le `webapp/Dockerfile` (stage build) définit toujours `ENV VITE_API_BASE=$VITE_API_BASE`.
La prod ne passe pas `VITE_API_BASE` en build arg → l'ENV devient **chaîne vide `""`**.
Le code utilisait `?? '/api'` (nullish) qui ne remplace PAS `""` → `apiBase = ""`.
Toutes les requêtes devenaient `/planning` au lieu de `/api/planning` → nginx ne
proxye pas → app cassée.

### Correctif appliqué (commit `63f707e`)

`webapp/src/api/client.ts:15` — `||` au lieu de `??` :
```ts
const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) || '/api';
```
Test ajouté : `client.spec.ts` « falls back to the relative /api base when VITE_API_BASE is empty ».

### 🔴 À faire sur le serveur (Dokploy) — dans l'ordre

1. **REBUILD l'image webapp** (pas juste restart !) — sinon l'ancien build cassé persiste.
2. Trouver le conteneur :
   ```sh
   docker ps | grep webapp
   ```
3. Vérifier que le bundle servi contient bien `/api` relatif (et PAS le domaine absolu) :
   ```sh
   docker exec -it <CONTAINER> sh
   grep -rohE "(https?://api[^\"]*|/api/planning)" /usr/share/nginx/html/assets/*.js | sort -u | head
   # ✅ attendu : /api/planning (relatif)
   # ❌ bug (si présent) : /planning (sans /api)  → image pas rebuildée
   ```
4. Vérifier le proxy nginx → API depuis le conteneur :
   ```sh
   wget -qO- http://api:3000/api/planning/config
   ```
5. Vérifier depuis l'hôte via le port publié prod (8083) :
   ```sh
   curl -i 'http://localhost:8083/api/planning/schedule?month=2026-10' -H 'Accept: application/json'
   ```

### Comment ça doit marcher en prod (après rebuild)

| Mode | VITE_API_BASE | Résultat |
|------|---------------|----------|
| **Prod** (docker-compose.yml + nginx) | vide → `/api` | nginx proxye `/api` → api:3000 |

---

## Session Log — 2026-09-08 (Docker dev + Traefik + API cross-origin)

### What was done (commits)

- `cc57446` feat(dev): containerized dev behind Traefik, API on own domain
- `63f707e` fix(webapp): treat empty VITE_API_BASE as the relative /api default

### Files changed

- `docker-compose.dev.yml` (new): dev containers, **zero host ports**, external
  Traefik network `local-proxy`. webapp on `http://planning-espoir.localhost`,
  API on `http://api.planning-espoir.localhost`.
- `api/Dockerfile`: added `deps`/`dev` stages (`nest start --watch`); prod
  `build`/`runtime` stages unchanged (default target = prod).
- `webapp/Dockerfile`: added `deps`/`dev` stages (`vite`); added optional
  `VITE_API_BASE` ARG/ENV to the build stage; nginx runtime unchanged.
- `webapp/src/api/client.ts`: API base configurable via `VITE_API_BASE`,
  defaults to relative `/api`. Uses `||` (empty string falls back to `/api`).
- `webapp/src/api/client.spec.ts`: tests for configured base and empty-base fallback.
- `webapp/vite.config.ts`: `/api` proxy target configurable via `API_PROXY_TARGET`
  (used only for local `yarn dev`; not used in the dockerized dev).
- `.env.example`, `AGENTS.md`: documented `VITE_API_BASE`.
- `docker-compose.yml` (prod): **untouched** — still nginx, host port 8083.

### How it works now (three modes)

| Mode | VITE_API_BASE | Result |
|------|---------------|--------|
| Prod (docker-compose.yml + nginx) | empty → `/api` | nginx proxies `/api` → api:3000 |
| Dev docker (docker-compose.dev.yml) | `http://api.planning-espoir.localhost/api` | browser calls API cross-origin on its own domain |
| Dev local host (`yarn dev`) | empty → `/api` | Vite proxy `/api` → localhost:3000 |

### How to run dev

```sh
docker compose -f docker-compose.dev.yml up --build
# requires Traefik on external network `local-proxy`, entrypoint `web`
# UI: http://planning-espoir.localhost   API: http://api.planning-espoir.localhost
```

### Known caveats / follow-ups

- **CORS**: `app.enableCors()` (api/src/main.ts:7) allows all origins; fine for
  dev (auth off, no credentials). If auth is ever enabled cross-origin, restrict
  origins.
- **Pre-existing failing test (not ours)**: `webapp/src/api/client.spec.ts`
  "redirects to the gateway URL on a 403 when auth is enabled" fails on `main`
  too (expects `http://localhost:5173`). Unrelated to this work; not yet fixed.
- `.claude/settings.local.json` is untracked local config — do not commit.

---

## Session Log — 2026-09-16 (pnpm migration + Caddy local dev)

### What was done

- **pnpm migration (ADR-0009)**: `pnpm-workspace.yaml` (packages + supply-chain
  settings + overrides), root `package.json` (`packageManager: pnpm@11.18.0`,
  scripts via `pnpm --filter`), `workspace:*` for `@planning-espoir/shared`,
  `yarn.lock` → `pnpm-lock.yaml`. Dockerfiles and `.gitlab-ci.yml` moved to pnpm
  (CI caches `.pnpm-store`, not `node_modules`).
  - `api/jest.config.ts`: `transformIgnorePatterns` now matches jose under the
    pnpm store nesting (`node_modules/.pnpm/<pkg>/node_modules/jose`).
  - `trustPolicy: no-downgrade` intentionally omitted (false positives).
  - Note (this VM only): the pnpm store must live on a SQLite-capable filesystem;
    the default `/workspace/.pnpm-store` (virtiofs) fails with `disk I/O error`.
    Install with `pnpm install --store-dir ~/.local/share/pnpm/store`.
- **Cross-origin API (ADR-0010)**: removed the Vite dev proxy, added
  `VITE_API_BASE` (fallback `|| '/api'`) to `webapp/src/api/client.ts`, tests for
  configured/empty base, `server.allowedHosts` for the Caddy hostname.
- **Compose**: base `docker-compose.yml` uses `expose` (no host ports, Dokploy
  routes via Traefik); new `docker-compose.override.yml` runs dev targets with
  hot reload behind Caddy —
  `http://planning-espoir.localhost` (webapp 5174) and
  `http://api.planning-espoir.localhost` (api 3000) — on the external
  `local-proxy` network, with `CORS_ORIGINS=http://planning-espoir.localhost`.

### How to run dev

```sh
docker compose up --build
# requires the shared Caddy proxy (external `local-proxy` network)
# UI: http://planning-espoir.localhost   API: http://api.planning-espoir.localhost
```

### Follow-ups

- Whitelist redirect URI `http://planning-espoir.localhost/*` for the client in
  the `gateway` repository (Keycloak realm).
