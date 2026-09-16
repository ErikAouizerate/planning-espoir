# API Architecture

Technical conventions of `@planning-espoir/api`, written so another AI agent can modify this package without breaking its invariants. Domain rules (what the data means, how the uploaded document is structured, date-rotation semantics) are intentionally out of scope — see the root `AGENTS.md` and `docs/adr/` for those. This document covers **how** the code is organized and must be written.

## Context

- Yarn workspaces monorepo. This package is the HTTP backend; sibling packages: `shared/` (types only, consumed from `dist/` — **rebuild it after any type change** or typecheck/tests use stale types) and `webapp/` (SPA that consumes this API).
- NestJS 11 on Express, TypeScript `~5.9`, CommonJS output. Port **3000** (`PORT` env), global prefix `/api` (`app.setGlobalPrefix`), CORS enabled for all origins.
- No database. State lives in flat files under `DATA_DIR` (default `<cwd>/data`, i.e. `api/data/` in dev — gitignored). Data is persisted as one raw uploaded file plus normalized JSON files.
- One `.env` at the **repo root**, loaded via `ConfigModule.forRoot({ isGlobal: true, envFilePath: '../.env' })`. All API variables are **runtime** (never baked in): `AUTH_ENABLED`, `KEYCLOAK_ISSUER`, `KEYCLOAK_APP_GROUP`, `DATA_DIR`, `PORT`. Defaults exist in code for every variable; `.env.example` at the root documents them. Never introduce per-package env files.
- Code, comments, docs and tests in English.

## Directory layout

```
api/
├── src/
│   ├── main.ts               # Bootstrap: create app, setGlobalPrefix('api'), enableCors, listen
│   ├── app.module.ts         # Root module: ConfigModule (global), feature modules, global APP_GUARD
│   ├── app.controller.ts     # GET /api/health → { status: 'ok' }
│   ├── auth/                 # Auth feature module (guard, identity, /auth/me controller)
│   └── planning/             # Example feature module: controller, service, storage, pure modules
└── test/                     # E2E tests (jest-e2e.json) + helpers/ (programmatic fixtures)
```

One Nest module per feature domain, in its own folder: `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, plus feature-internal helpers.

## Module & DI conventions

- **Controllers are thin**: decorators + parameter extraction (`@Body`, `@Query`, `@UploadedFile`, `@Req`), immediate delegation to the service, no logic, no validation beyond what Nest pipes give for free. Return plain objects/promises — Nest serializes to JSON.
- **Services hold the logic**: orchestration, input validation, mapping between storage/pure layers and HTTP responses.
- **No DTO classes / validation pipes**: inputs are typed with `@planning-espoir/shared` interfaces and validated **manually inside services** (`typeof`/`Array.isArray` checks), throwing `BadRequestException` with a plain-English message. Update endpoints accept `Partial<T>` and validate each present field individually (`undefined` = leave unchanged).
- **Env-dependent construction goes through `useFactory` providers** in the feature module, injecting `ConfigService` (or reading `process.env` directly) with in-code defaults — e.g. `AuthGuard` is built from `AUTH_ENABLED`/`KEYCLOAK_ISSUER`/`KEYCLOAK_APP_GROUP`, `Storage` from `DATA_DIR`. Never read env vars deep inside classes.
- **Global guard**: `AuthGuard` is exported by `AuthModule` and registered once in `AppModule` via `{ provide: APP_GUARD, useExisting: AuthGuard }` — no per-controller `@UseGuards`, the guard covers every route including future ones.
- **Local interface shims**: framework types that would require global namespace types are declared locally as plain interfaces (e.g. `MulterFile` in `multer-file.ts` instead of the `Express.Multer` global).

## Auth conventions (`auth/`)

- Keycloak OIDC, verified server-side with `jose` only (no Passport): `createRemoteJWKSet` against `<issuer>/protocol/openid-connect/certs` (trailing slash normalized), `jwtVerify` with issuer check. The JWKS set is created once in the constructor.
- **Group authorization**: the token's `groups` claim must contain the configured app group (`KEYCLOAK_APP_GROUP`, default `app-planning-espoir`).
- **Precise error mapping** — this contract is relied upon by the webapp:
  - missing/malformed `Authorization: Bearer` header → `401 UnauthorizedException`;
  - expired token / claim validation failure / bad signature (`jose` typed errors) → `401`;
  - valid token without the required group → `403 ForbiddenException` (re-thrown as-is, never swallowed by the catch);
  - anything else (JWKS unreachable, network) → `503 ServiceUnavailableException`.
- **Mock mode**: when `AUTH_ENABLED === 'false'`, the guard passes every request and sets `request.user = { username: MOCK_USERNAME }` (`'test-user'` in `identity.ts`). Enabled/disabled is decided once at construction, not per request.
- Authenticated identity flows through the `AuthenticatedRequest` interface (`user?: { username: string }`); `GET /api/auth/me` is the identity endpoint the webapp displays, sharing the same resolution logic as the guard.
- Keep webapp and API mock usernames in sync (`test-user` in both packages).

## Persistence conventions (`Storage` pattern)

- A single injectable `Storage` class per data directory, constructed with the directory path, wrapping `fs/promises`. All file names are private to the class; callers use semantic methods (`loadConfig`, `saveX`).
- **Atomic JSON writes**: serialize with 2-space indent to `<file>.tmp`, then `rename` over the target; `mkdir(dir, { recursive: true })` before every write.
- **Tolerant reads**: any failure (missing file, invalid JSON) returns `null`, never throws.
- **Defensive normalization on load**: stored JSON is treated as untrusted — each field is type-checked and filtered (e.g. non-string entries dropped), and a full default object is returned when the file is absent. Legacy/unknown fields are silently discarded on the next save (no migration framework).
- One upload at a time: the raw uploaded file is kept alongside its normalized JSON so re-processing is possible.

## Error handling conventions

- Use Nest HTTP exceptions at the service boundary: `BadRequestException` for invalid client input, `NotFoundException` for missing state, with short plain-English messages — the webapp displays the response body's `message` field directly.
- Pure modules throw **exported typed errors** (e.g. `PlanningFormatError`); services catch them and translate to the matching HTTP exception, re-throwing anything unexpected. Never let a parser-level error leak as a 500 with an internal message.
- Upload handling: `FileInterceptor('file')` (in-memory, `file.buffer`), missing file → 400, unparseable file → 400.

## Pure function modules

- Heavy logic (binary document parsing, date math) lives in **framework-free modules** (`parser.ts`, `date-rotation.ts`): no Nest imports, no I/O (input = `Buffer`/strings, output = plain data), driven by regex and lookup tables, with colocated `*.spec.ts` unit tests that need no DI container.
- Dates are handled as **UTC-only ISO strings** (`YYYY-MM-DD`, `YYYY-MM`); validators check both the regex and real-calendar validity (round-trip through `Date.UTC`); week arithmetic uses Euclidean modulo so results are defined for any input.
- Services orchestrate: controller → service → (pure modules + Storage) → response built from `@planning-espoir/shared` types.

## Testing

- Jest 29 + ts-jest, always `--runInBand` (tests share the filesystem/env). Two configs:
  - **Unit** (`jest.config.ts`): `rootDir: src`, `*.spec.ts` colocated, node environment, `transformIgnorePatterns` allows transforming the ESM-only `jose` package.
  - **E2E** (`test/jest-e2e.json`): `*.e2e-spec.ts` under `test/`.
- E2E tests are **self-contained**: boot the full `AppModule` with `@nestjs/testing`, set `DATA_DIR` to a fresh `mkdtemp` dir and `AUTH_ENABLED=false` **before** compiling the module, re-apply `app.setGlobalPrefix('api')` manually (main.ts is not imported), drive HTTP with supertest against `app.getHttpServer()`, and clean up (`app.close()`, `rm -rf` the temp dir) in `afterAll`/`finally`.
- Auth e2e uses a `buildApp(authEnabled)` helper returning `{ app, cleanup }` per scenario.
- Binary fixtures are **built programmatically** in `test/helpers/` (no committed binary files).
- Guard unit tests construct the guard directly with option objects — no Nest container needed for pure-ish classes.

## Tooling & quality gates

- Scripts: `build` (`nest build`), `start:dev` (`nest start --watch`), `test` (unit), `test:e2e`, `lint`, `typecheck`. Root equivalents orchestrate all workspaces (see root `AGENTS.md`).
- ESLint flat config: `typescript-eslint` recommended + `eslint-plugin-prettier` with **`prettier/prettier: error`** — formatting is a lint gate. Run `pnpm format` at the repo root when lint fails on style.
- `tsconfig.json` extends `../tsconfig.base.json` (strict): `commonjs`, `experimentalDecorators` + `emitDecoratorMetadata`, `sourceMap`, a `paths` shim for `jose/errors` types.
- Docker: multi-stage `Dockerfile` — build stage installs the whole workspace (`--frozen-lockfile`) then builds `shared` → `api`; runtime stage copies root `node_modules` + `shared` + `api` and runs `node api/dist/main.js` with `NODE_ENV=production`. Runtime data persists in a mounted volume over the API's `DATA_DIR` (see root `docker-compose.yml`).

## References

- Root `AGENTS.md` — monorepo commands, env/auth setup, workflow rules.
- `docs/adr/0001` (monorepo layout), `docs/adr/0002` (parsing & storage rationale) and `docs/superpowers/specs/2026-08-03-keycloak-auth-design.md` (auth design) for domain and decision details.

Keep this file in sync when conventions change; it is committed alongside the code it documents.
