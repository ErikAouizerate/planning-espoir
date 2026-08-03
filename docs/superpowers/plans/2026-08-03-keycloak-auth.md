# Keycloak Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Keycloak OIDC authentication to Planning Espoir (dev config): the webapp logs in via `keycloak-js`, the API validates the JWT via a NestJS guard, identity is exposed through `GET /api/auth/me`, and a per-package `.env` flag (`AUTH_ENABLED`) switches between real Keycloak auth and a static mock user (`test-user`).

**Architecture:** The webapp initializes `keycloak-js` (realm `gateway`, client `gateway`, `onLoad: 'login-required'`), attaches the Bearer token to every `/api/*` call, and displays `auth.username` + a Signout button in the header. The API registers a global custom `AuthGuard` (using `jose`'s `createRemoteJWKSet` against the realm JWKS) that branches on `AUTH_ENABLED`: enabled → validate JWT and set `request.user.username` from `preferred_username`; disabled → pass with mock user `test-user`. The webapp store follows the existing pattern (plain reducers + `combineReducers` + custom API middleware — no slices, no `createReducer`, no thunk).

**Tech Stack:** `keycloak-js` 26.2.4, `jose` 6.2.8, `@nestjs/config` 4.0.4 (loads `api/.env`), Vite `VITE_*` env vars, Vitest, Jest + supertest.

## Global Constraints

- All code, documentation, and tests in **English**; communication with the user is in French.
- TypeScript **~5.9.3** everywhere.
- yarn workspaces: `shared`, `api`, `webapp`. Run workspace commands as `yarn workspace <pkg> <script>` from the repo root.
- **Redux constraints (non-negotiable):** the webapp store uses plain classic reducers + `combineReducers` + a custom API middleware — **no Redux Thunk, no slices, no `createReducer`**. Redux Toolkit's `configureStore` is used only as the store factory; reducers stay plain functions.
- Per-package `.env` files (no root `.env`): `webapp/.env` (`VITE_*`) and `api/.env` (loaded via `ConfigModule.forRoot({ isGlobal: true })`).
- Defaults when env absent: `AUTH_ENABLED`/`VITE_AUTH_ENABLED` → `true`; URL → `http://localhost:8080`; realm → `gateway`; client id → `gateway`; issuer → `http://localhost:8080/realms/gateway`.
- Webapp dev port **5174** (the user updates the Keycloak client `redirectUris`/`webOrigins` manually; not part of this plan).
- All API routes are protected by a **global** `AuthGuard` (`APP_GUARD`) that internally handles mock mode.
- Mock user is statically `test-user`; the header Signout button is disabled in mock mode.

---

### Task 1: API — config, identity helper, auth guard, `/auth/me`, global registration

Add Keycloak config loading, the identity helper, the custom `AuthGuard`, the `AuthModule` with `GET /api/auth/me`, and register everything globally.

**Files:**

- Modify: `api/package.json` (add `jose`, `@nestjs/config`)
- Create: `api/.env`
- Modify: `api/tsconfig.json` (keep `"types": ["node", "jest"]`)
- Create: `api/src/auth/identity.ts`
- Create: `api/src/auth/identity.spec.ts`
- Create: `api/src/auth/auth.guard.ts`
- Create: `api/src/auth/auth.guard.spec.ts`
- Create: `api/src/auth/auth.module.ts`
- Create: `api/src/auth/auth.controller.ts`
- Modify: `api/src/app.module.ts`
- Create: `api/test/auth.e2e-spec.ts`
- Modify: `api/test/planning.e2e-spec.ts` (set `AUTH_ENABLED=false` in its `beforeAll` so existing tests keep passing)

**Interfaces:**

- Consumes: NestJS `ConfigService`, `ExecutionContext`, `CanActivate`, `UnauthorizedException`, `ServiceUnavailableException`.
- Produces:
  - `interface AuthenticatedRequest extends Request { user?: { username: string } }` (in `auth.guard.ts`).
  - `resolveUsername(username: string | null | undefined): string` — returns `username ?? 'test-user'`.
  - `AuthGuard implements CanActivate` with `canActivate(context: ExecutionContext): Promise<boolean>`.
  - `AuthModule` exporting `AuthController`; `GET /api/auth/me` → `{ username: string }`.
  - `AppModule` registers `AuthModule` and `{ provide: APP_GUARD, useClass: AuthGuard }`, and `ConfigModule.forRoot({ isGlobal: true })`.

- [ ] **Step 1: Add dependencies and `.env`**

Run: `yarn workspace @planning-espoir/api add jose@6.2.8 @nestjs/config@4.0.4`

Create `api/.env`:

```
AUTH_ENABLED=true
KEYCLOAK_ISSUER=http://localhost:8080/realms/gateway
```

Note: `.env` files are not gitignored in this repo yet — add `api/.env` to `.gitignore` in Step 9 so the secret-free dev file is committed for convenience but the pattern is ignored. Actually, commit `api/.env` (dev-only, no secrets) and add `.env` to `.gitignore` so future local edits are not tracked.

- [ ] **Step 2: Write the failing `identity` test**

`api/src/auth/identity.spec.ts`:

```ts
import { resolveUsername } from './identity';

describe('resolveUsername', () => {
  it('returns the provided username when present', () => {
    expect(resolveUsername('admin@example.com')).toBe('admin@example.com');
  });

  it('returns the mock user when the username is null', () => {
    expect(resolveUsername(null)).toBe('test-user');
  });

  it('returns the mock user when the username is undefined', () => {
    expect(resolveUsername(undefined)).toBe('test-user');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `yarn workspace @planning-espoir/api test identity`
Expected: FAIL — `./identity` not found.

- [ ] **Step 4: Implement `api/src/auth/identity.ts`**

```ts
export const MOCK_USERNAME = 'test-user';

export function resolveUsername(username: string | null | undefined): string {
  return username ?? MOCK_USERNAME;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn workspace @planning-espoir/api test identity`
Expected: PASS (3 tests).

- [ ] **Step 6: Write the failing `AuthGuard` test**

`api/src/auth/auth.guard.spec.ts`:

```ts
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

function makeContext(headers: Record<string, string | undefined>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers, user: undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  it('passes and sets the mock user when auth is disabled', async () => {
    const guard = new AuthGuard({ authEnabled: false });
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    const req = ctx.switchToHttp().getRequest() as { user?: { username: string } };
    expect(req.user).toEqual({ username: 'test-user' });
  });

  it('throws 401 when auth is enabled and no token is present', async () => {
    const guard = new AuthGuard({
      authEnabled: true,
      issuer: 'http://localhost:8080/realms/gateway',
    });
    await expect(guard.canActivate(makeContext({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws 401 when auth is enabled and the token is not a Bearer token', async () => {
    const guard = new AuthGuard({
      authEnabled: true,
      issuer: 'http://localhost:8080/realms/gateway',
    });
    await expect(
      guard.canActivate(makeContext({ authorization: 'Basic abc' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `yarn workspace @planning-espoir/api test auth.guard`
Expected: FAIL — `./auth.guard` not found.

- [ ] **Step 8: Implement `api/src/auth/auth.guard.ts`**

```ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { MOCK_USERNAME } from './identity';

export interface AuthenticatedRequest extends Request {
  user?: { username: string };
}

export interface AuthGuardOptions {
  authEnabled: boolean;
  issuer: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet> | null;

  constructor(private readonly options: AuthGuardOptions) {
    this.jwks = options.authEnabled
      ? createRemoteJWKSet(
          new URL(`${options.issuer.replace(/\/$/, '')}/protocol/openid-connect/certs`),
        )
      : null;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!this.options.authEnabled) {
      request.user = { username: MOCK_USERNAME };
      return true;
    }

    const authorization = request.headers['authorization'];
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid bearer token');
    }

    const token = authorization.slice('Bearer '.length);
    try {
      const { payload } = await jwtVerify(token, this.jwks as never, {
        issuer: this.options.issuer,
      });
      const username = (payload.preferred_username as string | undefined) ?? null;
      request.user = { username: username ?? MOCK_USERNAME };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED'
      ) {
        throw new UnauthorizedException('Invalid token');
      }
      throw new ServiceUnavailableException('Unable to verify token against the identity provider');
    }
  }
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `yarn workspace @planning-espoir/api test auth.guard`
Expected: PASS (3 tests).

- [ ] **Step 10: Write the failing `AuthController` + `AuthModule` + e2e tests**

`api/src/auth/auth.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: AuthGuard,
      useFactory: (config: ConfigService): AuthGuard => {
        const authEnabled = (config.get<string>('AUTH_ENABLED') ?? 'true') !== 'false';
        const issuer =
          config.get<string>('KEYCLOAK_ISSUER') ?? 'http://localhost:8080/realms/gateway';
        return new AuthGuard({ authEnabled, issuer });
      },
      inject: [ConfigService],
    },
  ],
  exports: [AuthGuard],
})
export class AuthModule {}
```

`api/src/auth/auth.controller.ts`:

```ts
import { Controller, Get, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.guard';

@Controller('auth')
export class AuthController {
  @Get('me')
  me(@Req() request: AuthenticatedRequest): { username: string } {
    return { username: request.user?.username ?? 'test-user' };
  }
}
```

`api/test/auth.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let dataDir: string;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'auth-e2e-'));
    process.env.DATA_DIR = dataDir;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it('returns the mock user on GET /api/auth/me when auth is disabled', async () => {
    process.env.AUTH_ENABLED = 'false';
    const res = await request(app.getHttpServer()).get('/api/auth/me').expect(200);
    expect(res.body).toEqual({ username: 'test-user' });
  });

  it('returns 401 on GET /api/auth/me when auth is enabled and no token is sent', async () => {
    process.env.AUTH_ENABLED = 'true';
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('rejects planning access without a token when auth is enabled', async () => {
    process.env.AUTH_ENABLED = 'true';
    await request(app.getHttpServer()).get('/api/planning').expect(401);
  });

  it('allows planning access without a token when auth is disabled', async () => {
    process.env.AUTH_ENABLED = 'false';
    await request(app.getHttpServer()).get('/api/planning').expect(404); // 404 = no planning uploaded yet, guard passed
  });
});
```

**Important:** the guard is instantiated once at module bootstrap from the `AUTH_ENABLED` value read then. Because e2e tests toggle `process.env.AUTH_ENABLED` after bootstrap, the above "disabled then enabled" assertions cannot both pass with a single app instance. **Fix this in the e2e:** build a fresh `TestingModule` per scenario, OR test only the disabled path in this file and rely on the unit `AuthGuard` tests for the enabled paths. Use **two separate app instances**:

Rewrite `api/test/auth.e2e-spec.ts` to create one app with `AUTH_ENABLED=false` and assert the mock-me + planning-404 behaviors, then create a second app with `AUTH_ENABLED=true` and assert the 401 behaviors:

```ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { AppModule } from '../src/app.module';

async function buildApp(
  authEnabled: string,
): Promise<{ app: INestApplication; cleanup: () => Promise<void> }> {
  const dataDir = await mkdtemp(join(tmpdir(), 'auth-e2e-'));
  process.env.DATA_DIR = dataDir;
  process.env.AUTH_ENABLED = authEnabled;
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
  return {
    app,
    cleanup: async () => {
      await app.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}

describe('Auth (e2e)', () => {
  it('returns the mock user and allows planning when auth is disabled', async () => {
    const { app, cleanup } = await buildApp('false');
    try {
      const me = await request(app.getHttpServer()).get('/api/auth/me').expect(200);
      expect(me.body).toEqual({ username: 'test-user' });
      await request(app.getHttpServer()).get('/api/planning').expect(404); // guard passed, no planning uploaded
    } finally {
      await cleanup();
    }
  });

  it('returns 401 for /auth/me and /planning when auth is enabled and no token is sent', async () => {
    const { app, cleanup } = await buildApp('true');
    try {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
      await request(app.getHttpServer()).get('/api/planning').expect(401);
    } finally {
      await cleanup();
    }
  });
});
```

- [ ] **Step 11: Register everything in `api/src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { PlanningModule } from './planning/planning.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PlanningModule, AuthModule],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useExisting: AuthGuard }],
})
export class AppModule {}
```

Note: `useExisting: AuthGuard` reuses the configured instance from `AuthModule`. If NestJS requires `useClass` here, switch to `useClass: AuthGuard` and provide `AuthGuard` in `AppModule.providers` with the same factory as in `AuthModule`.

- [ ] **Step 12: Pin mock mode for the existing planning e2e**

Modify `api/test/planning.e2e-spec.ts` — in `beforeAll`, set `process.env.AUTH_ENABLED = 'false';` right after `process.env.DATA_DIR = dataDir;` so existing tests (which send no token) keep passing.

- [ ] **Step 13: Run all API checks and fix failures**

Run: `yarn workspace @planning-espoir/api test && yarn workspace @planning-espoir/api test:e2e && yarn workspace @planning-espoir/api lint && yarn workspace @planning-espoir/api typecheck && yarn workspace @planning-espoir/api build`
Expected: all pass. Fix any `ConfigModule`/guard wiring errors.

- [ ] **Step 14: Commit**

```bash
git add api
git commit -m "feat: add Keycloak auth guard and /auth/me endpoint"
```

---

### Task 2: Webapp — config, keycloak wrapper, auth store slice, client token, header

Add the webapp auth layer: env config, `keycloak-js` wrapper with mock mode, the `auth` reducer + actions + middleware handling, Bearer token attachment in the API client, and the header username + Signout button.

**Files:**

- Modify: `webapp/package.json` (add `keycloak-js`)
- Create: `webapp/.env`
- Create: `webapp/src/auth/config.ts`
- Create: `webapp/src/auth/config.spec.ts`
- Create: `webapp/src/auth/keycloak.ts`
- Create: `webapp/src/auth/keycloak.spec.ts`
- Modify: `webapp/src/store/types.ts` (add `AuthState`, `auth` in `RootState`)
- Modify: `webapp/src/store/actions.ts` (add `AUTH_FETCH_*` constants + creators)
- Modify: `webapp/src/store/reducers.ts` (add `authReducer`, register in `combineReducers`)
- Modify: `webapp/src/store/apiMiddleware.ts` (handle `AUTH_FETCH_REQUESTED`)
- Modify: `webapp/src/store/store.spec.ts` (assert `auth` initial state)
- Modify: `webapp/src/api/client.ts` (attach Bearer header, expose `fetchAuthMe`)
- Modify: `webapp/src/api/client.spec.ts` (cover Bearer header)
- Modify: `webapp/src/App.tsx` (dispatch `authFetchRequested()` on mount)
- Modify: `webapp/src/components/Header.tsx` (username + Signout)
- Create: `webapp/src/components/Header.spec.tsx` (username + disabled signout in mock)

**Interfaces:**

- Consumes: `@planning-espoir/shared` types, existing store pattern.
- Produces:
  - `authConfig: { enabled: boolean; url: string; realm: string; clientId: string }` (from `webapp/src/auth/config.ts`, read from `import.meta.env`).
  - `keycloak: { init(): Promise<void>; isEnabled(): boolean; getToken(): string | null; getUsername(): string; signout(): void }` (from `webapp/src/auth/keycloak.ts`).
  - Actions: `authFetchRequested()`, `authFetchStart()`, `authFetchSuccess(username)`, `authFetchError(error)`.
  - `AuthState { status: 'idle'|'loading'|'loaded'|'error'; username: string | null; error: string | null }`.
  - `fetchAuthMe(): Promise<{ username: string }>` in `api/client.ts`.
  - `getAuthToken(): string | null` helper in `api/client.ts` (reads from the keycloak wrapper).

- [ ] **Step 1: Add the dependency and `.env`**

Run: `yarn workspace @planning-espoir/webapp add keycloak-js@26.2.4`

Create `webapp/.env`:

```
VITE_AUTH_ENABLED=true
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=gateway
VITE_KEYCLOAK_CLIENT_ID=gateway
```

- [ ] **Step 2: Write the failing config test**

`webapp/src/auth/config.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('authConfig', () => {
  it('reads values from import.meta.env with defaults', async () => {
    vi.stubEnv('VITE_AUTH_ENABLED', 'false');
    vi.stubEnv('VITE_KEYCLOAK_URL', 'http://kc.test');
    vi.stubEnv('VITE_KEYCLOAK_REALM', 'demo');
    vi.stubEnv('VITE_KEYCLOAK_CLIENT_ID', 'app');
    const { authConfig } = await import('./config');
    expect(authConfig.enabled).toBe(false);
    expect(authConfig.url).toBe('http://kc.test');
    expect(authConfig.realm).toBe('demo');
    expect(authConfig.clientId).toBe('app');
    vi.unstubAllEnvs();
  });

  it('applies defaults when env vars are absent', async () => {
    vi.stubEnv('VITE_AUTH_ENABLED', '');
    vi.stubEnv('VITE_KEYCLOAK_URL', '');
    vi.stubEnv('VITE_KEYCLOAK_REALM', '');
    vi.stubEnv('VITE_KEYCLOAK_CLIENT_ID', '');
    const { authConfig } = await import('./config');
    expect(authConfig.enabled).toBe(true);
    expect(authConfig.url).toBe('http://localhost:8080');
    expect(authConfig.realm).toBe('gateway');
    expect(authConfig.clientId).toBe('gateway');
    vi.unstubAllEnvs();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `yarn workspace @planning-espoir/webapp test config`
Expected: FAIL — `./config` not found.

- [ ] **Step 4: Implement `webapp/src/auth/config.ts`**

```ts
export interface AuthConfig {
  enabled: boolean;
  url: string;
  realm: string;
  clientId: string;
}

function str(value: string | undefined, fallback: string): string {
  return value && value.trim() !== '' ? value : fallback;
}

export const authConfig: AuthConfig = {
  enabled: (import.meta.env.VITE_AUTH_ENABLED ?? 'true') !== 'false',
  url: str(import.meta.env.VITE_KEYCLOAK_URL, 'http://localhost:8080'),
  realm: str(import.meta.env.VITE_KEYCLOAK_REALM, 'gateway'),
  clientId: str(import.meta.env.VITE_KEYCLOAK_CLIENT_ID, 'gateway'),
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn workspace @planning-espoir/webapp test config`
Expected: PASS (2 tests).

- [ ] **Step 6: Write the failing keycloak wrapper test**

`webapp/src/auth/keycloak.spec.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  kcInit: vi.fn(),
  kcLogin: vi.fn(),
  kcLogout: vi.fn(),
  kcToken: vi.fn(),
  kcTokenParsed: vi.fn(),
}));

vi.mock('keycloak-js', () => ({
  default: vi.fn(() => ({
    init: mocks.kcInit,
    login: mocks.kcLogin,
    logout: mocks.kcLogout,
    get token() {
      return mocks.kcToken();
    },
    get tokenParsed() {
      return mocks.kcTokenParsed();
    },
  })),
}));

describe('keycloak wrapper', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_AUTH_ENABLED', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is disabled and uses the mock user when auth is disabled', async () => {
    const { keycloak } = await import('./keycloak');
    expect(keycloak.isEnabled()).toBe(false);
    expect(keycloak.getUsername()).toBe('test-user');
    expect(keycloak.getToken()).toBeNull();
    keycloak.signout();
    expect(mocks.kcLogout).not.toHaveBeenCalled();
  });

  it('initializes keycloak and reads the username from the token when enabled', async () => {
    vi.stubEnv('VITE_AUTH_ENABLED', 'true');
    mocks.kcInit.mockResolvedValue(undefined);
    mocks.kcToken.mockReturnValue('abc.def.ghi');
    mocks.kcTokenParsed.mockReturnValue({ preferred_username: 'admin@example.com' });
    const { keycloak } = await import('./keycloak');
    expect(keycloak.isEnabled()).toBe(true);
    await keycloak.init();
    expect(mocks.kcInit).toHaveBeenCalled();
    expect(keycloak.getToken()).toBe('abc.def.ghi');
    expect(keycloak.getUsername()).toBe('admin@example.com');
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `yarn workspace @planning-espoir/webapp test keycloak`
Expected: FAIL — `./keycloak` not found.

- [ ] **Step 8: Implement `webapp/src/auth/keycloak.ts`**

```ts
import Keycloak from 'keycloak-js';
import { authConfig } from './config';
import { MOCK_USERNAME } from './username';

export interface KeycloakApi {
  init(): Promise<void>;
  isEnabled(): boolean;
  getToken(): string | null;
  getUsername(): string;
  signout(): void;
}

function createDisabled(): KeycloakApi {
  return {
    async init() {
      // no-op in mock mode
    },
    isEnabled: () => false,
    getToken: () => null,
    getUsername: () => MOCK_USERNAME,
    signout: () => {
      // no-op in mock mode
    },
  };
}

function createEnabled(): KeycloakApi {
  const keycloak = new Keycloak({
    url: authConfig.url,
    realm: authConfig.realm,
    clientId: authConfig.clientId,
  });
  return {
    async init() {
      await keycloak.init({ onLoad: 'login-required' });
    },
    isEnabled: () => true,
    getToken: () => keycloak.token ?? null,
    getUsername: () => keycloak.tokenParsed?.preferred_username ?? MOCK_USERNAME,
    signout: () => {
      void keycloak.logout({ redirectUri: window.location.origin });
    },
  };
}

export const keycloak: KeycloakApi = authConfig.enabled ? createEnabled() : createDisabled();
```

Note: `MOCK_USERNAME` lives in `webapp/src/auth/username.ts`:

```ts
export const MOCK_USERNAME = 'test-user';
```

This keeps the mock constant shared between the wrapper and the store tests.

- [ ] **Step 9: Run test to verify it passes**

Run: `yarn workspace @planning-espoir/webapp test keycloak`
Expected: PASS (2 tests).

- [ ] **Step 10: Add the `auth` slice types, actions, and reducer (existing pattern)**

Modify `webapp/src/store/types.ts` — add:

```ts
export interface AuthState {
  status: Status;
  username: string | null;
  error: string | null;
}
```

and add `auth: AuthState;` to `RootState`.

Modify `webapp/src/store/actions.ts` — add constants and creators:

```ts
export const AUTH_FETCH_REQUESTED = 'AUTH_FETCH_REQUESTED';
export const AUTH_FETCH_START = 'AUTH_FETCH_START';
export const AUTH_FETCH_SUCCESS = 'AUTH_FETCH_SUCCESS';
export const AUTH_FETCH_ERROR = 'AUTH_FETCH_ERROR';

export function authFetchRequested(): Action<typeof AUTH_FETCH_REQUESTED> {
  return { type: AUTH_FETCH_REQUESTED };
}

export function authFetchStart(): Action<typeof AUTH_FETCH_START> {
  return { type: AUTH_FETCH_START };
}

export function authFetchSuccess(username: string): Action<typeof AUTH_FETCH_SUCCESS, string> {
  return { type: AUTH_FETCH_SUCCESS, payload: username };
}

export function authFetchError(error: string): Action<typeof AUTH_FETCH_ERROR> {
  return { type: AUTH_FETCH_ERROR, error };
}
```

Modify `webapp/src/store/reducers.ts` — add `initialAuth`, `authReducer`, and register `auth` in `combineReducers`:

```ts
const initialAuth: AuthState = {
  status: 'idle',
  username: null,
  error: null,
};

function authReducer(state: AuthState = initialAuth, action: Action): AuthState {
  switch (action.type) {
    case AUTH_FETCH_START:
      return { ...state, status: 'loading', error: null };
    case AUTH_FETCH_SUCCESS:
      return { ...state, status: 'loaded', username: action.payload as string, error: null };
    case AUTH_FETCH_ERROR:
      return { ...state, status: 'error', error: action.error ?? 'Auth fetch failed' };
    default:
      return state;
  }
}

export const rootReducer = combineReducers({
  planning: planningReducer,
  schedule: scheduleReducer,
  config: configReducer,
  selection: selectionReducer,
  colors: colorsReducer,
  auth: authReducer,
});
```

Update the imports in `reducers.ts`: import `AuthState` from `./types` and `AUTH_FETCH_*` from `./actions`.

Update `webapp/src/store/store.spec.ts` — add an assertion:

```ts
it('starts with an empty auth state', () => {
  const store = configureStore();
  expect(store.getState().auth).toEqual({ status: 'idle', username: null, error: null });
});
```

- [ ] **Step 11: Handle `AUTH_FETCH_REQUESTED` in the middleware**

Modify `webapp/src/store/apiMiddleware.ts` — import the new creators and add a case:

```ts
case AUTH_FETCH_REQUESTED:
  store.dispatch(authFetchStart());
  api
    .fetchAuthMe()
    .then((data) => store.dispatch(authFetchSuccess(data.username)))
    .catch((err: Error) => store.dispatch(authFetchError(err.message)));
  break;
```

- [ ] **Step 12: Attach the Bearer token in the API client**

Modify `webapp/src/api/client.ts`:

```ts
import { keycloak } from '../auth/keycloak';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = keycloak.getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  // ...existing ok/error handling unchanged...
}

export function fetchAuthMe(): Promise<{ username: string }> {
  return request<{ username: string }>('/api/auth/me');
}
```

Update `webapp/src/api/client.spec.ts` — the existing tests call `fetchPlanning()` with `vi.mocked(fetch)` and assert the fetch call. Add a test that the Bearer header is attached when a token is present. Because `keycloak.getToken()` is read from the wrapper, mock the wrapper in the spec:

```ts
import { vi, describe, expect, it, beforeEach, afterEach } from 'vitest';

const tokenMock = vi.hoisted(() => vi.fn());
vi.mock('../auth/keycloak', () => ({
  keycloak: { getToken: () => tokenMock() },
}));

// in a test:
it('attaches the Bearer token when present', async () => {
  tokenMock.mockReturnValue('token-123');
  vi.mocked(fetch).mockResolvedValue(
    new Response(JSON.stringify({ username: 'test-user' }), { status: 200 }),
  );
  await fetchAuthMe();
  const [url, init] = vi.mocked(fetch).mock.calls[0];
  expect(String(url)).toBe('/api/auth/me');
  expect((init?.headers as Headers).get('Authorization')).toBe('Bearer token-123');
});
```

Note: the existing client.spec.ts tests pass `undefined` as the second argument to `fetch`. With the new `init: RequestInit = {}` default, `fetchPlanning` still calls `fetch('/api/planning', { headers })` — the existing assertion `expect(fetch).toHaveBeenCalledWith('/api/planning', undefined)` will break. **Update those assertions** to match the new second argument (a `RequestInit` with headers) or use `expect.any(Object)` / check `url` only.

- [ ] **Step 13: Update `App.tsx` and `Header.tsx`**

Modify `webapp/src/App.tsx` — dispatch `authFetchRequested()` on mount (add to the first `useEffect`):

```ts
import { authFetchRequested } from './store/actions';
// in useEffect([dispatch]):
dispatch(authFetchRequested());
```

Modify `webapp/src/components/Header.tsx`:

```tsx
import { useDispatch, useSelector } from 'react-redux';
import { keycloak } from '../auth/keycloak';
import type { RootState } from '../store/types';

// inside the component:
const username = useSelector((state: RootState) => state.auth.username);
const authEnabled = keycloak.isEnabled();

// in the header, after the Config button:
{
  username && <span className="text-sm text-slate-700">{username}</span>;
}
<button
  type="button"
  onClick={() => keycloak.signout()}
  disabled={!authEnabled}
  className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
>
  Signout
</button>;
```

- [ ] **Step 14: Write the failing Header spec**

`webapp/src/components/Header.spec.tsx` — extend the existing file (or create it) to cover the auth display:

```tsx
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';
import { createTestStore } from '../test/store';
import type { RootState } from '../store/types';
import { Header } from './Header';

const enabledMock = vi.hoisted(() => vi.fn());

vi.mock('../auth/keycloak', () => ({
  keycloak: { isEnabled: () => enabledMock(), signout: vi.fn() },
}));

function makeState(overrides: Partial<RootState> = {}): RootState {
  return {
    planning: { status: 'loaded', people: [], warnings: [], error: null },
    schedule: { status: 'loaded', month: '2026-08', days: {}, error: null },
    selection: { names: [] },
    config: {
      status: 'loaded',
      config: { startDate: null, defaultName: null, fileName: null },
      error: null,
    },
    colors: { palette: ['#ff0000'] },
    auth: { status: 'loaded', username: 'admin@example.com', error: null },
    ...overrides,
  };
}

describe('Header auth', () => {
  it('shows the connected username', () => {
    enabledMock.mockReturnValue(true);
    render(
      <Provider store={createTestStore(makeState())}>
        <Header />
      </Provider>,
    );
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
  });

  it('disables the Signout button in mock mode', () => {
    enabledMock.mockReturnValue(false);
    render(
      <Provider store={createTestStore(makeState())}>
        <Header />
      </Provider>,
    );
    expect(screen.getByRole('button', { name: 'Signout' })).toBeDisabled();
  });
});
```

- [ ] **Step 15: Update the existing `Header.spec.tsx` `makeState`**

The existing `Header.spec.tsx` builds a full `RootState` without `auth` — add `auth: { status: 'loaded', username: null, error: null }` to its `makeState`. If `Header.spec.tsx` already exists, extend it; otherwise the new file in Step 14 covers it.

- [ ] **Step 16: Run webapp checks and fix failures**

Run: `yarn workspace @planning-espoir/webapp test && yarn workspace @planning-espoir/webapp lint && yarn workspace @planning-espoir/webapp typecheck && yarn workspace @planning-espoir/webapp build`
Expected: all pass. Watch for the `client.spec.ts` second-argument assertion change and the `main.test.tsx` entry test (the mock-mode default keeps it mounting without a real Keycloak).

- [ ] **Step 17: Commit**

```bash
git add webapp
git commit -m "feat: add Keycloak auth to the webapp"
```

---

### Task 3: Root verification + `.env` gitignore + docs

Final verification, gitignore hygiene, and documentation updates.

**Files:**

- Modify: `.gitignore` (ignore `.env`)
- Modify: `AGENTS.md` (auth is now implemented for dev)
- Modify: `IMPROVEMENTS.md` (remove the handled remark)

**Interfaces:**

- Consumes: all prior tasks.

- [ ] **Step 1: Add `.env` to `.gitignore`**

Append to `.gitignore`:

```gitignore
.env
.env.*
!.env.example
```

Because dev-only `.env` files contain no secrets, they may be committed once for convenience, but the ignore rule prevents accidental future commits of local values.

- [ ] **Step 2: Run the full root command set**

Run: `yarn typecheck && yarn lint && yarn format:check && yarn test && yarn build`
Expected: all pass from the repo root.

- [ ] **Step 3: Update `AGENTS.md`**

Change the auth line from "design for it, do not implement yet" to reflect the dev implementation:

```
- Auth: Keycloak via OIDC — implemented for development (realm `gateway`, disabled via `AUTH_ENABLED=false` in `api/.env` / `VITE_AUTH_ENABLED` in `webapp/.env`, mock user `test-user`). Production config TBD.
```

- [ ] **Step 4: Clear the handled remark in `IMPROVEMENTS.md`**

Remove the Keycloak remark from the `## todo` list (leave the file's usage section intact).

- [ ] **Step 5: Commit**

```bash
git add .gitignore AGENTS.md IMPROVEMENTS.md
git commit -m "chore: ignore env files and document dev auth"
```

---

## Self-Review

### Spec coverage

- D-AUTH-1 end-to-end auth → Task 1 (guard + `/auth/me`), Task 2 (token on client).
- D-AUTH-2 `keycloak-js` login-required → Task 2 (`keycloak.ts`).
- D-AUTH-3 per-package `.env` + defaults → Task 1 (`api/.env`, `ConfigModule`), Task 2 (`webapp/.env`, `authConfig`), Task 3 (gitignore).
- D-AUTH-4 `jose` `createRemoteJWKSet` guard, global `APP_GUARD` → Task 1 (`auth.guard.ts`, `app.module.ts`).
- D-AUTH-5 `GET /api/auth/me` → `{ username }`, shared identity resolution → Task 1 (`auth.controller.ts`, `identity.ts`).
- D-AUTH-6 Signout via keycloak logout, disabled in mock → Task 2 (`keycloak.ts.signout`, `Header.tsx`).
- D-AUTH-7 store follows existing pattern (plain reducer, no slices/thunk) → Task 2 (reducers/actions/middleware).
- D-AUTH-8 port 5174 → no code change; documented.
- Error handling (401/503) → Task 1 guard; Task 2 client.
- Testing matrix → Tasks 1-2 unit + e2e + component tests.

### Placeholder scan

No TODOs/TBDs. All code blocks are complete.

### Type consistency

- `resolveUsername(username: string | null | undefined): string` — Task 1 defines, guard uses.
- `MOCK_USERNAME = 'test-user'` — `identity.ts` (api) and `username.ts` (webapp) both define the constant; Task 2's `keycloak.ts` uses `MOCK_USERNAME` from `webapp/src/auth/username.ts`.
- `AuthGuardOptions { authEnabled, issuer }` — Task 1 defines and consumes.
- `KeycloakApi { init, isEnabled, getToken, getUsername, signout }` — Task 2 defines and consumes.
- `AuthState`/`auth` slice — Task 2 types/reducers/combine consistent.
- `fetchAuthMe(): Promise<{ username: string }>` — Task 2 client defines, middleware consumes.

## Addendum — Group-based access control (D-AUTH-9)

Implemented after the initial plan: `AuthGuard` now requires the token's `groups` claim to include `app-planning-espoir` (constant `APP_GROUP` in `api/src/auth/auth.guard.ts`); otherwise it throws `ForbiddenException` (403). In mock mode (auth disabled) groups are ignored. Added unit tests in `auth.guard.spec.ts` for: valid token in group → 200; valid token not in group → 403; missing groups claim → 403. Spec updated with D-AUTH-9.
