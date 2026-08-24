# Testing Patterns

**Analysis Date:** 2026-08-24

## Test Framework

Two separate stacks, one per package:

**API — Jest 29 + ts-jest + supertest:**
- Runner: jest `^29.7.0` with `ts-jest` `^29.4.12`
- Config: `api/jest.config.ts` — `testRegex: '.*\\.spec\\.ts$'`, `rootDir: 'src'`, `testEnvironment: 'node'`, transform `ts-jest` with `api/tsconfig.json`, `transformIgnorePatterns: ['node_modules/(?!(jose)/)']`
- E2E config: `api/test/jest-e2e.json` — `testRegex: '.e2e-spec.ts$'`, `rootDir: '.'`
- Assertion library: built-in Jest `expect` (`toBe`, `toEqual`, `toHaveLength`, `toHaveBeenCalled`, `resolves`/`rejects` matchers)

**Webapp — Vitest 4 + Testing Library:**
- Runner: vitest `^4.1.10`, config embedded in `webapp/vite.config.ts` (`test` block): `environment: 'jsdom'`, `setupFiles: ['./src/test/setup.ts']`, `globals: true`
- Assertion library: Vitest `expect` + `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toBeChecked`, `toBeDisabled`) — imported via `webapp/src/test/setup.ts`
- DOM/testing: `@testing-library/react` `^16.3.2`, `@testing-library/user-event` `^14.6.1`, `@testing-library/dom`, `jsdom`

**Run Commands (from repo root):**
```bash
yarn test                          # builds shared, then api + webapp tests
yarn workspace @planning-espoir/api test -- parser     # single api unit test file (jest --runInBand with name filter)
yarn workspace @planning-espoir/api test:e2e           # api e2e suite (jest --config ./test/jest-e2e.json --runInBand)
yarn workspace @planning-espoir/webapp test -- src/utils/dates.spec.ts   # single webapp test file (vitest run)
```
CI (`.gitlab-ci.yml`) runs `yarn test` in the `test` stage, gated behind `lint` and `build`. The API e2e suite is self-contained (sets `AUTH_ENABLED=false`, temp `DATA_DIR`) — no external services needed.

## Test File Organization

**Location:** Co-located next to the code under test:
- `api/src/planning/parser.spec.ts` next to `parser.ts`; `api/src/auth/auth.guard.spec.ts` next to `auth.guard.ts`
- `webapp/src/components/PersonMultiSelect.spec.tsx` next to `PersonMultiSelect.tsx`; `webapp/src/store/apiMiddleware.spec.ts` next to `apiMiddleware.ts`
- E2E specs live separately in `api/test/`: `planning.e2e-spec.ts`, `auth.e2e-spec.ts`, `health.e2e-spec.ts`

**Naming:**
- Unit/integration: `<module>.spec.ts` / `<module>.spec.tsx`
- E2E: `<area>.e2e-spec.ts`
- Legacy exceptions: `webapp/src/App.test.tsx` and `webapp/src/main.test.tsx` use `.test.tsx` — new files should follow `.spec.*`

**Structure:**
```
api/src/...            → co-located *.spec.ts (jest, rootDir src)
api/test/              → *.e2e-spec.ts + test/helpers/planning-workbook.ts
webapp/src/...         → co-located *.spec.ts|tsx (vitest)
webapp/src/test/       → setup.ts (jest-dom + fetch stub), store.ts (createTestStore)
```

## Test Structure

**API unit tests** — `describe('<ModuleName>', ...)` with behavior-sentence `it()` names:

```typescript
// api/src/planning/date-rotation.spec.ts
describe('date-rotation', () => {
  const start = '2026-07-27'; // a Monday

  it('returns S1 index for the start date itself', () => {
    expect(weekIndexForDate(start, '2026-07-27')).toBe(0);
  });
});
```

**API controller tests** — `@nestjs/testing` `Test.createTestingModule` with `useValue` mock service, `jest.clearAllMocks()` in `beforeEach`:

```typescript
// api/src/planning/planning.controller.spec.ts
const service = { upload: jest.fn(), getPlanning: jest.fn(), /* ... */ };

beforeEach(async () => {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [PlanningController],
    providers: [{ provide: PlanningService, useValue: service }],
  }).compile();
  controller = module.get<PlanningController>(PlanningController);
  jest.clearAllMocks();
});
```

**API e2e tests** — boot the real `AppModule`, temp data dir, `AUTH_ENABLED=false`, supertest against the HTTP server; `beforeAll`/`afterAll` for app lifecycle:

```typescript
// api/test/planning.e2e-spec.ts
beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'planning-e2e-'));
  process.env.DATA_DIR = dataDir;
  process.env.AUTH_ENABLED = 'false';
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
});
// ...
await request(app.getHttpServer()).get('/api/planning').expect(404);
```

**Webapp component tests** — Testing Library `render` + `screen` queries, `userEvent` for interaction; Redux-connected components wrapped in `<Provider store={createTestStore(makeState())}>`:

```typescript
// webapp/src/components/PersonMultiSelect.spec.tsx
it('shows the selection count and calls onToggle with the clicked name', async () => {
  const onToggle = vi.fn();
  render(<PersonMultiSelect people={people} selected={['BOB Dylan']} onToggle={onToggle} />);
  expect(screen.getByRole('button', { name: 'Personnes (1)' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Personnes (1)' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'TAUZIN Caroline' }));
  expect(onToggle).toHaveBeenCalledWith('TAUZIN Caroline');
});
```

**Webapp store tests** — build the real store with `configureStore()` from `webapp/src/store/store.ts`, dispatch actions, assert on `store.getState()`; async effects asserted with `vi.waitFor`:

```typescript
// webapp/src/store/apiMiddleware.spec.ts
const store = configureStore();
store.dispatch(configFetchRequested());
await vi.waitFor(() => {
  expect(store.getState().selection.names).toContain('TAUZIN Caroline');
});
```

**Patterns:**
- Setup: `beforeEach`/`beforeAll` create fresh state per test (temp dirs, new store instances, `vi.clearAllMocks`/`mockReset`)
- Teardown: `afterEach` removes temp dirs (`rm(dir, { recursive: true, force: true })`), `vi.unstubAllGlobals()`, `vi.unstubAllEnvs()`, `vi.resetModules()`
- Assertions: `expect(...).toEqual(...)` for whole objects, `.toBe` for primitives, `resolves`/`rejects` for promises, `toHaveBeenCalledWith` for interactions

## Mocking

**API framework:** Jest module mocks (`jest.mock`) + `jest.fn()`.

```typescript
// api/src/auth/auth.guard.spec.ts
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => jest.fn()),
  jwtVerify: jest.fn(),
}));
const mockJwtVerify = jwtVerify as jest.Mock;
```

**Webapp framework:** Vitest `vi.mock` with `vi.hoisted` factories (required to share mocks with the factory), `vi.stubGlobal`, `vi.mocked`.

```typescript
// webapp/src/api/client.spec.ts
const tokenMock = vi.hoisted(() => vi.fn());
vi.mock('../auth/keycloak', () => ({
  keycloak: { getToken: () => tokenMock(), isEnabled: () => isEnabledMock(), login: () => loginMock() },
}));
```

**fetch mocking (webapp):** `fetch` is globally stubbed in `webapp/src/test/setup.ts` (`vi.stubGlobal('fetch', vi.fn())`) and re-stubbed per test; responses are native `Response` objects:

```typescript
vi.mocked(fetch).mockResolvedValue(
  new Response(JSON.stringify({ startDate: null, people: [], warnings: [] }), { status: 200 }),
);
```

**Env-var dependent modules (webapp):** `vi.resetModules()` + dynamic `import('./module')` with `vi.stubEnv` before import:

```typescript
// webapp/src/auth/keycloak.spec.ts
beforeEach(() => { vi.resetModules(); vi.stubEnv('VITE_AUTH_ENABLED', 'false'); });
const { keycloak } = await import('./keycloak');
```

**What to Mock:**
- Network (`fetch`, `jose` JWKS verification) — always mocked
- Keycloak SDK (`keycloak-js` in `webapp/src/auth/keycloak.spec.ts`, the `../auth/keycloak` wrapper in client/Header/main tests)
- Service-layer collaborators in controller tests (`useValue` mocks)
- `window.location` for redirect assertions (save/restore via `Object.defineProperty` in try/finally, `webapp/src/api/client.spec.ts:87-97`)

**What NOT to Mock:**
- `fs` in storage tests — use real temp dirs (`api/src/planning/storage.spec.ts`)
- ExcelJS workbook building — real workbooks via `buildPlanningBuffer()` (`api/test/helpers/planning-workbook.ts`)
- The real `rootReducer` in store/middleware tests — dispatch real actions through the real store (`webapp/src/store/apiMiddleware.spec.ts`)

## Fixtures and Factories

**API fixture builder:** `api/test/helpers/planning-workbook.ts` — `buildPlanningBuffer()` builds a realistic Excel workbook with S1–S6 blocks, two people, roles, junk cells and a junk sheet, returning a `Buffer`:

```typescript
// usage in parser.spec.ts and planning.e2e-spec.ts
const parsed = await parsePlanning(await buildPlanningBuffer(), 'plan.xlsx');
```

**Webapp state factory:** each component spec defines a local `makeState(overrides: Partial<RootState> = {}): RootState` returning a full valid `RootState` with `...overrides` at the end (`App.spec.tsx:8-33`, `ConfigModal.spec.tsx:9-37`, `MonthCalendar.spec.tsx:9-46`, `Header.spec.tsx:14-39`, `PersonDropdown.spec.tsx:9-28`). Duplicated per file by design — no shared state factory.

**Test store:** `webapp/src/test/store.ts` — `createTestStore(preloadedState?)` wraps `configureStore` with the real `rootReducer` and `thunk: false` (mirrors production `webapp/src/store/store.ts`).

## Coverage

**Requirements:** None enforced. No `coverageThreshold` in `api/jest.config.ts`; `collectCoverageFrom: ['**/*.(t|j)s']` is configured but there is no coverage script in any `package.json` and no `--coverage` flag in the CI pipeline.

**View Coverage (manual):**
```bash
yarn workspace @planning-espoir/api exec jest --runInBand --coverage   # writes api/coverage/
# vitest: npx vitest run --coverage in webapp/ (requires @vitest/coverage-v8, not installed)
```

## Test Types

**Unit Tests:** Pure logic + utilities — `api/src/planning/date-rotation.spec.ts`, `api/src/planning/parser.spec.ts`, `webapp/src/utils/dates.spec.ts`, `webapp/src/store/store.spec.ts`, `webapp/src/auth/config.spec.ts`. Parser tests build real ExcelJS workbooks and assert on the parsed output — no fixture JSON.

**Integration Tests:** NestJS module tests with mocked services (`planning.controller.spec.ts`, `auth.guard.spec.ts`), real-storage round-trips (`storage.spec.ts`), middleware-through-real-store flows (`webapp/src/store/apiMiddleware.spec.ts`, `webapp/src/store/store.spec.ts`), and connected component tests with seeded Redux state.

**E2E Tests:** API only — `api/test/*.e2e-spec.ts` via supertest against a full `AppModule` app with temp `DATA_DIR` and `AUTH_ENABLED=false`. Covers upload → schedule → config round-trips and auth guard behavior (`auth.e2e-spec.ts` boots the app twice with auth enabled/disabled). Webapp has no e2e/browser tests; `webapp/src/main.test.tsx` approximates an entry-point smoke test by importing `main.tsx` with mocked keycloak.

## Common Patterns

**Async Testing:**
```typescript
// api: resolves/rejects on promises
await expect(parsePlanning(Buffer.from('not an xlsx'), 'notes.txt')).rejects.toThrow(PlanningFormatError);
await expect(storage.loadConfig()).resolves.toEqual({ startDate: null, defaultNames: [], fileName: null });

// webapp: vi.waitFor for async state transitions after dispatch
store.dispatch(configFetchRequested());
await vi.waitFor(() => {
  expect(store.getState().selection.names).toContain('TAUZIN Caroline');
});
```

**Error Testing:**
```typescript
// api — expect the HTTP exception type, not the message
await expect(controller.upload(undefined as never)).rejects.toBeInstanceOf(BadRequestException);
// e2e — assert status codes
await request(app.getHttpServer()).get('/api/planning/schedule?month=nope').expect(400);
// webapp — assert the thrown Error message surfaced from the server body
vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ message: 'No planning uploaded yet' }), { status: 404 }));
await expect(fetchPlanning()).rejects.toThrow('No planning uploaded yet');
```

**Table-style validation tests:** multiple `expect` lines in one `it` for boundary cases (`isValidMonth`/`isValidDateKey` in `api/src/planning/date-rotation.spec.ts:42-65`).

**StrictMode-awareness:** `apiMiddleware.spec.ts:88-95` explicitly double-dispatches a request to simulate React StrictMode double-invocation and asserts idempotency — keep this pattern for new middleware tests.

---

*Testing analysis: 2026-08-24*
