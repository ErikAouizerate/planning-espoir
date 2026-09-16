# ADR-0010: Local dev behind Caddy with a cross-origin API

Status: Accepted

## Context

Local development ran natively (`pnpm dev`) with Vite proxying `/api` to `localhost:3000`. To mirror production (services reached through a reverse proxy, no host ports) and give the app a stable hostname, local dev now runs in Docker behind the shared Caddy reverse proxy (`localhost-reverse-proxy`, external `local-proxy` network).

An earlier attempt (commit `04da4c1`, later reverted) used **Traefik** labels and a separate `docker-compose.dev.yml`. The local proxy is now **Caddy**, and its site labels belong in an auto-merged `docker-compose.override.yml`.

## Decision

1. `docker-compose.yml` is the production stack (deployed as-is by Dokploy) and publishes **no host ports** — services use `expose`.
2. `docker-compose.override.yml` is dev-only and auto-merged by `docker compose up` (no `-f` flags): `dev` build targets with hot reload, project source bind-mounted, `node_modules` masked by named volumes so the host tree never shadows the image's. Services join the external `local-proxy` network and declare scheme-qualified Caddy labels:
   - `http://planning-espoir.localhost` → webapp (`{{upstreams 5174}}`)
   - `http://api.planning-espoir.localhost` → api (`{{upstreams 3000}}`)
3. The Vite dev proxy is removed. The webapp calls the API **cross-origin** via `VITE_API_BASE` (`http://api.planning-espoir.localhost/api` in containers, `http://localhost:3000/api` natively) and falls back to the relative `/api` when unset (production behind nginx). `server.allowedHosts` accepts the Caddy hostname.
4. The API enables CORS for the origins listed in `CORS_ORIGINS`; dev sets `http://planning-espoir.localhost` (container) and `http://localhost:5174` (native).
5. `VITE_API_BASE` uses `||` (not `??`) so an empty build-time value falls back to `/api` — the production regression from the earlier attempt.

## Consequences

- Dev is cross-origin while production is same-origin; both paths are covered by `client.spec.ts`.
- Keycloak (dev at `http://idp.localhost`) must whitelist `http://planning-espoir.localhost/*` as a redirect URI — a change in the `gateway` repository.
- `docker compose up` now requires the `local-proxy` network / Caddy stack; without it only the published `127.0.0.1` ports are reachable.
- Files written by the containers into bind-mounted sources (e.g. `api/data`, `dist/`) are owned by root (dev containers run as root); they are gitignored.
