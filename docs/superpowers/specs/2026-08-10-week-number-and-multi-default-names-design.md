# Planning Espoir — Week Number on Sundays & Multiple Default Names Design

Date: 2026-08-10
Status: Approved

Two related improvements:

1. Display the current planning week number (`S1`…`S6`) inside each Sunday cell of the calendar.
2. Let the config hold **multiple** default persons (`defaultNames`), selected with the same multi-select component as the header, and persisted in the flat `config.json`.

## Context

- Monorepo: `shared/` (types), `api/` (NestJS, port 3000, prefix `/api`), `webapp/` (Vite, port 5174).
- The S1–S6 rotation rule (ADR-0003) lives only in the API (`api/src/planning/date-rotation.ts`, `weekIndexForDate`).
- `ScheduleMonth` currently carries `{ month, days }`; the week index is computed per date in `PlanningService.getSchedule()` but not exposed.
- `Config` is `{ startDate, defaultName, fileName }`; `PlanningService.updateConfig()` merges a `Partial<Config>`; `Storage.loadConfig()` defaults to `{ startDate: null, defaultName: null, fileName: null }`.
- The header person selector `PersonDropdown` is Redux-bound (no props): it reads `state.planning.people` / `state.selection.names` and dispatches `selectionToggle`.
- `ConfigModal` has a single-choice listbox for `defaultName` ("Aucun" + one entry per person).
- On `CONFIG_FETCH_SUCCESS`, the apiMiddleware auto-selects `defaultName` when it matches a person (`selectionAdd`, idempotent). `CONFIG_UPDATE_SUCCESS` does not touch the selection.
- The webapp store uses plain classic reducers + a custom API middleware (AGENTS.md non-negotiable).

## Goals

- Each Sunday cell shows the planning week number of the Monday→Sunday period ending that day, as `S{n}` (1–6).
- The config modal offers a multi-select for default persons, reusing the header's dropdown component.
- `config.json` persists several default names.
- On config load, every default name present in the planning is auto-checked in the header selector.

## Non-goals

- No migration of legacy `config.json` files: the old `defaultName` field is simply ignored (user decision — defaults are re-selected once in the UI).
- No change to the header selector behavior or to the S1–S6 rotation rule itself.
- No week number displayed on days other than Sunday.
- No selection change after a config **update** (current behavior preserved: defaults apply at load only).

## Decisions

### D-1: Week number comes from the API response (ADR-0007)

`ScheduleMonth` gains a `sundayWeeks: Record<string, number>` field mapping each Sunday date (`"YYYY-MM-DD"`) of the requested month to its planning week number **1-based** (1 = S1 … 6 = S6), ready for direct display. The API stays the single source of truth for the rotation rule; the webapp does not reimplement `weekIndexForDate`. `getSchedule()` already requires `startDate` (400 otherwise), so `sundayWeeks` is always fully populated.

### D-2: Multiple default names (ADR-0006)

`Config.defaultName: string | null` becomes `defaultNames: string[]`. The PUT endpoint accepts and validates it (must be an array of strings, else 400); merge semantics stay `!== undefined`. `Storage.loadConfig()` defaults to `{ startDate: null, defaultNames: [], fileName: null }` and ignores unknown legacy fields (no migration). This amends ADR-0005's "single default name" wording.

### D-3: Shared controlled component

Extract a presentational **`PersonMultiSelect`** from `PersonDropdown`: props `people: Person[]`, `selected: string[]`, `onToggle(name: string)`; it owns the open/close state, the `Personnes (n)` button and the checkbox list (`useClickOutside` included). `PersonDropdown` becomes a thin Redux wrapper (unchanged behavior, still hidden until config is loaded). `ConfigModal` uses `PersonMultiSelect` with local state, replacing the single-choice listbox; "no default" = empty selection.

### D-4: Auto-selection at load only

On `CONFIG_FETCH_SUCCESS`, the middleware dispatches `selectionAdd(name)` for every `defaultNames` entry that matches a planning person. After a config update (`CONFIG_UPDATE_SUCCESS`), the current selection is left untouched (user decision).

## Architecture

### Shared (`shared/src/types.ts`, then rebuild)

```ts
export interface ScheduleMonth {
  month: string; // "YYYY-MM"
  days: Record<string, PersonDay[]>;
  sundayWeeks: Record<string, number>; // Sunday "YYYY-MM-DD" -> week number 1..6
}

export interface Config {
  startDate: string | null; // "YYYY-MM-DD"
  defaultNames: string[];
  fileName: string | null;
}
```

### API

- `planning.service.ts`
  - `getSchedule()`: inside the existing `monthDays(month)` loop, when `weekdayIndex(date) === 6` (Sunday), set `sundayWeeks[date] = weekIndexForDate(config.startDate, date) + 1`. Return `{ month, days, sundayWeeks }`.
  - `updateConfig()`: if `update.defaultNames !== undefined`, validate `Array.isArray(...)` and every item is a string (else `BadRequestException`), then assign.
- `storage.ts`
  - `loadConfig()`: default `{ startDate: null, defaultNames: [], fileName: null }`; when a file exists, spread it over the defaults and drop the legacy `defaultName` key so the returned object always matches `Config`.

### Webapp

- `store/types.ts`: `ScheduleState` gains `sundayWeeks: Record<string, number> | null`.
- `store/reducers.ts`: `initialSchedule.sundayWeeks = null`; `SCHEDULE_FETCH_SUCCESS` stores `payload.sundayWeeks`; `initialConfig.config` uses `defaultNames: []`.
- `store/apiMiddleware.ts`: `CONFIG_FETCH_SUCCESS` loops over `data.defaultNames` and dispatches `selectionAdd(name)` for each name found in `state.planning.people`. `CONFIG_UPDATE_SUCCESS` unchanged (no selection side effect).
- `components/PersonMultiSelect.tsx` (new): controlled dropdown extracted from `PersonDropdown`.
- `components/PersonDropdown.tsx`: Redux wrapper around `PersonMultiSelect`.
- `components/ConfigModal.tsx`: `defaultNames: string[]` local state initialized from config on open; `PersonMultiSelect` replaces the listbox; save dispatches `configUpdateRequested({ startDate: startDate || null, defaultNames })`.
- `components/MonthCalendar.tsx`: in the day-number row, when `date` exists in `sundayWeeks`, render `S{sundayWeeks[date]}` next to the day number — discreet styling aligned with the day number (`text-[10px] text-slate-400 sm:text-xs`). Map membership doubles as the "is Sunday" test.
- `api/client.ts`: no signature change (`updateConfig(Partial<Config>)` already generic).

## Error handling

- `PUT /api/planning/config` with a non-array or non-string-items `defaultNames` → 400 `defaultNames must be an array of strings`.
- Legacy `config.json` containing `defaultName` → loads as `defaultNames: []`, field dropped on next save.
- If a default name is absent from the current planning (e.g. after a re-upload with different rows), it is kept in config but simply not auto-selected.

## Testing

- **API unit**
  - `planning.service.spec.ts`: `getSchedule()` returns `sundayWeeks` with correct 1-based numbers for the month's Sundays (including wrap-around after S6); `updateConfig()` accepts `defaultNames`, rejects non-array / non-string items with 400, and ignores `defaultNames: undefined`.
  - `storage.spec.ts`: `loadConfig()` defaults when no file; normalizes a legacy file containing `defaultName` to `defaultNames: []`.
- **API e2e**: `PUT` then `GET /api/planning/config` round-trips `defaultNames`; schedule response contains `sundayWeeks`.
- **Webapp**
  - `apiMiddleware` spec: `CONFIG_FETCH_SUCCESS` auto-selects every default name present in people, ignores unknown names; `CONFIG_UPDATE_SUCCESS` does not dispatch `selectionAdd`.
  - `MonthCalendar` spec: a Sunday present in `sundayWeeks` renders `S{n}`; other days do not.
  - `PersonMultiSelect` spec: renders `Personnes (n)`, toggling calls `onToggle` with the name.
- Lint + typecheck on all packages; root command set unchanged.

## Docs

- ADR-0006: multiple default persons (amends ADR-0005).
- ADR-0007: week number exposed in the schedule response.
- `AGENTS.md`: update the `config.json` field list (`startDate`, `defaultNames`, `fileName`).
