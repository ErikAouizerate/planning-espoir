# Coding Conventions

**Analysis Date:** 2026-08-24

## Naming Patterns

**Files:**
- React components: PascalCase — `MonthCalendar.tsx`, `PersonMultiSelect.tsx`, `PWAUpdatePrompt.tsx`, `DayCell.tsx`
- Plain modules: kebab-case — `date-rotation.ts`, `multer-file.ts`, `planning.controller.ts`, `planning-workbook.ts`
- Single exceptions: `apiMiddleware.ts` and `useClickOutside.ts` are camelCase module files
- Spec files co-located next to source: `parser.spec.ts`, `PersonMultiSelect.spec.tsx`; e2e specs live in `api/test/*.e2e-spec.ts`
- Two legacy names use `.test.tsx` instead of `.spec.tsx`: `webapp/src/App.test.tsx`, `webapp/src/main.test.tsx`

**Functions:**
- camelCase verbs — `parsePlanning()`, `weekIndexForDate()`, `shiftMonth()`, `colorFor()`, `resolveUsername()`
- Private module helpers are plain top-level functions in the same file (`pad()`, `columnLetter()`, `hasWeekLabel()` in `api/src/planning/parser.ts`)

**Variables:**
- camelCase; explicit nullability with `??` fallbacks (e.g. `people ?? []`, `username ?? MOCK_USERNAME`)
- `undefined`-typed optional fields are avoided in state — slices use `null` for "not loaded" (`people: Person[] | null` in `webapp/src/store/types.ts`)

**Types:**
- PascalCase, no `I` prefix — `PlanningResponse`, `MulterFile`, `StoredPlanning`, `AuthGuardOptions`, `RawPerson`
- Domain types centralized in `shared/src/types.ts` (`Person`, `DayCell`, `Config`, `ParsingWarning`, `ScheduleMonth`) and imported with `import type`
- Local inline object types used for small shapes: `{ week: number; row: number }[]` (`api/src/planning/parser.ts:88`)
- React props interface is always named `Props` and declared in the component file: `DayCell.tsx`, `ConfigModal.tsx`, `PersonMultiSelect.tsx`
- Type-only imports always use `import type { ... }` — never mixed with value imports

**Constants:**
- Module-level SCREAMING_SNAKE_CASE: `PALETTE` (`webapp/src/colors.ts`), `WEEKDAY_LABELS`, `MONTH_LABELS`, `WEEKDAY_FULL` (`webapp/src/utils/dates.ts`), `DAY_MS`, `WEEK_COUNT` (`api/src/planning/date-rotation.ts`), `MOCK_USERNAME` (`api/src/auth/identity.ts`, `webapp/src/auth/username.ts`)
- Regexes get a `_RE` suffix: `WEEK_LABEL_RE`, `ROLE_RE`, `TIME_TEXT_RE`, `RH_RE` (`api/src/planning/parser.ts`)
- Redux action type constants are SCREAMING_SNAKE_CASE strings: `PLANNING_FETCH_REQUESTED` (`webapp/src/store/actions.ts`)

**Classes:**
- PascalCase; NestJS classes decorated (`@Injectable()`, `@Controller('planning')`, `@Module({...})`)
- DI via constructor parameter properties: `constructor(private readonly storage: Storage)` (`api/src/planning/planning.service.ts:28`), `constructor(private readonly dataDir: string)` (`api/src/planning/storage.ts:11`)
- Custom error: `export class PlanningFormatError extends Error {}` (`api/src/planning/parser.ts:41`)

**React/Redux identifiers:**
- Components: named exports (`export function MonthCalendar()`) — only `App.tsx` and `main.tsx` use `export default`
- Redux action creators: camelCase verb-first (`planningFetchRequested`, `selectionToggle`, `authFetchError`) in `webapp/src/store/actions.ts`
- Reducer functions: `<slice>Reducer` camelCase (`planningReducer`, `scheduleReducer`), initial state `initial<Slice>` (`initialPlanning`, `initialConfig`) in `webapp/src/store/reducers.ts`

## Code Style

**Formatting:**
- Prettier 3.9.6, config at `.prettierrc`: `printWidth: 100`, `singleQuote: true`, `trailingComma: "all"`, `semi: true`, `tabWidth: 2`
- Run `yarn format` (prettier --write) from repo root when lint fails on style — `prettier/prettier: error` makes formatting part of lint

**Linting:**
- ESLint 9 flat config, one per package: `api/eslint.config.mjs`, `webapp/eslint.config.mjs`
- Both use `tseslint.configs.recommended` + `eslint-config-prettier` + `eslint-plugin-prettier` with `prettier/prettier: 'error'`; ignores `dist/**`, `node_modules/**`, `coverage/**`
- Type-aware parsing enabled via `projectService: true` (api) / `projectService: true` (webapp) with `tsconfigRootDir`

**TypeScript:**
- Strict mode everywhere (`tsconfig.base.json`: `strict: true`, target ES2022)
- Webapp adds `noUnusedLocals`, `noUnusedParameters`, `isolatedModules` (`webapp/tsconfig.json`)
- API uses CommonJS + decorators (`emitDecoratorMetadata`, `experimentalDecorators`); webapp uses ESNext + `moduleResolution: "bundler"`, `jsx: "react-jsx"`
- Explicit return types on all exported functions — `async upload(file: MulterFile): Promise<PlanningResponse>`, `export function monthGrid(month: string): (string | null)[][]`

## Import Organization

**Order:**
1. External packages (`react`, `@nestjs/common`, `exceljs`, `vitest`, `jose`)
2. `@planning-espoir/shared` types
3. Relative imports (alphabetical-ish, modules before store before utils in components: `./components/Header`, `./store/actions`, `./store/types`, `./utils/dates` in `webapp/src/App.tsx`)

**Path Aliases:**
- None — all imports are relative (`./parser`, `../store/actions`, `../../test/helpers/planning-workbook`) or bare package names
- No extension in relative imports

## Error Handling

**Patterns:**
- API services throw NestJS HTTP exceptions: `BadRequestException`, `NotFoundException`, `UnauthorizedException`, `ForbiddenException`, `ServiceUnavailableException` (`api/src/planning/planning.service.ts:31,61,67`, `api/src/auth/auth.guard.ts:50,60,72,74`)
- Domain parse failures throw `PlanningFormatError`; the service catches with `instanceof` and translates to `BadRequestException` before re-throwing anything unknown (`api/src/planning/planning.service.ts:33-40`)
- Guard discriminates jose errors with `instanceof` (`JWTExpired`, `JWTClaimValidationFailed`, `JWSSignatureVerificationFailed` → 401; everything else → 503) (`api/src/auth/auth.guard.ts:65-75`)
- Storage intentionally swallows read failures and returns `null` (`readJson` catch → `null`, `api/src/planning/storage.ts:54-61`) — callers translate to `NotFoundException`
- Controllers never try/catch — they delegate to services and let Nest map exceptions
- Webapp API layer: single `request<T>()` helper throws `Error(message)` with the server's `message` body on non-OK responses; 401 triggers `keycloak.login()`, 403 redirects to the gateway (`webapp/src/api/client.ts:17-41`)
- Webapp async flows: `apiMiddleware` dispatches `*_ERROR` actions with `err.message` on rejection; reducers store `error: string | null` and provide a fallback message (`action.error ?? 'Upload failed'`, `webapp/src/store/reducers.ts:86`)
- UI renders error banners from `status === 'error'` slices (`webapp/src/App.tsx:36-50`)

## Logging

**Framework:** No logger framework in the webapp; NestJS default logger in the API (no explicit `Logger` usage in source). `redux-logger` is wired in dev only.

**Patterns:**
- `redux-logger` added to middleware only when `import.meta.env.MODE === 'development'` (`webapp/src/store/store.ts:10-16`)
- Single `console.log('SW registration error', error)` in `webapp/src/components/PWAUpdatePrompt.tsx:20`
- Keep new code consistent: no new logging libraries; rely on redux-logger in dev and API error responses

## Comments

**When to Comment:**
- Sparse; only for non-obvious domain facts and test rationale. Examples:
  - `// 1-based: 1 = S1 .. 6 = S6` (`api/src/planning/planning.service.ts:79`)
  - `// Simulates StrictMode double-invocation of the config fetch effect` (`webapp/src/store/apiMiddleware.spec.ts:88`)
  - `// a Monday` (`api/src/planning/date-rotation.spec.ts:10`)
  - `// Monday-first` (`webapp/src/utils/dates.ts:24`)
- No JSDoc/TSDoc anywhere in the codebase — do not add it

## Function Design

**Size:** Small focused functions; pure helpers extracted at module level (`api/src/planning/parser.ts` has 10+ tiny helpers; `webapp/src/utils/dates.ts` is a pure-date-utils module)

**Parameters:** Positional with explicit types; options objects as interfaces when >2 config options (`AuthGuardOptions` in `api/src/auth/auth.guard.ts:20-24`)

**Return Values:** Explicit typed returns; discriminated unions for domain state (`DayCell = shift | off | none` in `shared/src/types.ts:6-7`); `null` (not `undefined`) for absence; `Promise<T>` with `resolves.toEqual` style in tests

**Async entry points:** top-level async invoked with `void bootstrap();` (`api/src/main.ts:12`, `webapp/src/main.tsx:24`)

## Module Design

**Exports:** Named exports for everything except `App` (default) and `main.tsx` bootstrap. Hooks are named exports (`useClickOutside`).

**Barrel Files:** Only `shared/src/index.ts` (`export * from './types'`). The webapp and api packages do not use barrel files — import directly from the target module.

**Redux module layout (webapp):** one action constant + creator per async flow in `webapp/src/store/actions.ts`; slice reducers in `webapp/src/store/reducers.ts` combined via `combineReducers`; state shapes in `webapp/src/store/types.ts`; API side effects exclusively in `webapp/src/store/apiMiddleware.ts`.

## React-Specific Conventions

- Function components with hooks only — no class components
- `useSelector((state: RootState) => state.x)` inline selectors; components type the state explicitly
- Early returns for conditional rendering: `if (!days) return null;` (`MonthCalendar.tsx:16`), `if (!open) return null;` (`ConfigModal.tsx:31`), `if (status !== 'loaded') return null;` (`PersonDropdown.tsx:12`)
- Tailwind CSS v4 utility classes for all styling; `font-display` custom font family; French UI strings in JSX, English identifiers/comments
- Buttons always `type="button"` and carry `aria-label` when icon-only (`MonthCalendar.tsx:26`, `ConfigModal.tsx:60`)
- `data-testid` used sparingly for dynamic cells (`day-${date}` in `MonthCalendar.tsx:64`)

## Redux Conventions (non-negotiable)

- Classic hand-written reducers with `switch (action.type)` and object spreads — no RTK slices, no `createReducer`, no thunks (`thunk: false` in `webapp/src/store/store.ts:22`)
- Async flows follow the uniform pattern: `*_REQUESTED` (dispatched by UI) → `apiMiddleware` dispatches `*_START`, calls the API client, then `*_SUCCESS` / `*_ERROR` (`webapp/src/store/apiMiddleware.ts`)
- Actions are plain objects `{ type, payload?, error? }` via the `Action<T, P>` interface (`webapp/src/store/actions.ts:37-42`)
- Each async slice carries `status: 'idle' | 'loading' | 'loaded' | 'error'` (`webapp/src/store/types.ts:3`)
- Test store helper: `createTestStore(preloadedState?)` in `webapp/src/test/store.ts` — use it in component tests instead of the production `configureStore` when seeding state

## API (NestJS) Conventions

- Controllers are thin: delegate straight to services, return the service result (`api/src/planning/planning.controller.ts`)
- Feature modules: `PlanningModule`, `AuthModule`; global prefix `/api` set in `main.ts`
- Validation happens in services (not DTO classes / class-validator — not used anywhere): `isValidMonth()`, `isValidDateKey()` checks with `BadRequestException` (`api/src/planning/planning.service.ts:67,97-99`)
- Shared/global state goes through the `Config` object persisted by `Storage` (flat JSON files, atomic tmp+rename write in `storage.ts:46-52`)
- Pure date logic isolated in `api/src/planning/date-rotation.ts` (no Nest imports) — keep pure modules free of framework imports

---

*Convention analysis: 2026-08-24*
