# Planning Espoir

Single-page app that uploads an Excel planning document and displays a person's work schedule on a calendar. The upload is re-parsed on every update, so the displayed schedule always matches the latest document.

## Stack

pnpm workspaces monorepo:

- `shared/` — `@planning-espoir/shared`, cross-package TypeScript domain types.
- `api/` — NestJS backend, global prefix `/api`, port 3000. No database: normalized data lives in flat files under `DATA_DIR`.
- `webapp/` — React 19 + Vite SPA, port 5174. Tailwind CSS v4, Redux (classic reducers + custom middlewares).

## Requirements

- Node.js >= 22 and pnpm 11 (`corepack enable` honours the pinned `packageManager`).
- For containerized development: Docker with the Compose plugin, and the shared Caddy proxy network:

  ```sh
  docker network create local-proxy   # or start the localhost-reverse-proxy stack
  ```

## Development

Install dependencies and configure the environment once:

```sh
pnpm install
cp .env.example .env   # then adjust values
```

### Option A — native (fastest inner loop)

```sh
pnpm dev
```

`shared` is built first, then the API (`nest start --watch`) and the SPA (`vite`) run concurrently. Set `VITE_API_BASE=http://localhost:3000/api` and `CORS_ORIGINS=http://localhost:5174` in `.env` (the SPA calls the API cross-origin — there is no Vite dev proxy).

### Option B — containerized behind Caddy

```sh
docker compose up --build
```

Compose automatically merges `docker-compose.override.yml` on top of `docker-compose.yml` (hot reload, source bind mounts, local ports, Caddy labels). Then open:

- Webapp: <http://planning-espoir.localhost>
- API: <http://api.planning-espoir.localhost>

### Commands (from the repo root)

| Command                        | What it does                                            |
| ------------------------------ | ------------------------------------------------------- |
| `pnpm dev`                     | Build `shared`, then run API + webapp in watch mode     |
| `pnpm build`                   | Build all workspaces                                    |
| `pnpm test`                    | Build `shared`, then run the API and webapp test suites |
| `pnpm lint` / `pnpm typecheck` | Lint / typecheck all workspaces                         |
| `pnpm format`                  | Prettier write (lint enforces formatting)               |

## Production

Dokploy deploys `docker-compose.yml` as-is: services use `expose` (never `ports`) and Dokploy's Traefik proxy handles public routing and TLS. The webapp is served by nginx, which proxies `/api` to the API (same-origin), so `VITE_API_BASE` is left empty at build time.
