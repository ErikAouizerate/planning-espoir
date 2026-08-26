# Planning Espoir — Adjacent-Month Days in Grid & Week Number on Mondays Design

Date: 2026-08-26
Status: Approved

Two related calendar improvements:

1. The month grid also renders the trailing days of the previous month (first week) and the leading days of the next month (last week), with their schedule data, dimmed with `opacity-50` to distinguish them from the current month.
2. The planning week number (`S1`…`S6`) moves from the Sunday cell to the **Monday** cell (start of the planning week).

## Context

- Monorepo: `shared/` (types), `api/` (NestJS, port 3000, prefix `/api`), `webapp/` (Vite, port 5174).
- `GET /api/planning/schedule?month=YYYY-MM` returns `ScheduleMonth { month, days, sundayWeeks }`; `days`/`sundayWeeks` cover only the requested month (`monthDays`).
- The webapp grid `monthGrid(month)` returns `(string | null)[][]` (Monday-first), with `null` padding for out-of-month cells; `MonthCalendar` renders those as empty cells.
- The S1–S6 rotation rule (ADR-0003) lives only in the API; the webapp never computes week indices.
- The webapp store uses plain classic reducers + a custom API middleware (`*_REQUESTED` → `*_START`/`*_SUCCESS`/`*_ERROR`; AGENTS.md non-negotiable). All API calls go through `src/store/apiMiddleware.ts`.

## Goals

- Every cell of the grid shows a real date; cells outside the displayed month show that day's schedule, dimmed.
- Example: a month ending on a Tuesday also shows Wednesday→Sunday of the next month with their shifts.
- The `S{n}` badge sits on Mondays (one at the start of every grid row, including a dimmed previous-month Monday in the first row).
- No behaviour change for in-month days, navigation, selection, or "today" highlight.

## Non-goals

- No API-side extension of `days` to adjacent months (rejected by user — see D-1).
- No lazy/partial rendering of the current month while adjacent months load (single loading state).
- No interactivity on adjacent cells (there is none on current cells either).
- No migration of stored data: the schedule response is computed, nothing is persisted.

## Decisions

### D-1: Adjacent-month data comes from three merged client-side fetches (user decision)

On `SCHEDULE_FETCH_REQUESTED(month)`, the apiMiddleware fetches `month-1`, `month`, `month+1` in parallel (`Promise.all`) and dispatches a single `scheduleFetchSuccess` with merged `days`/`mondayWeeks` maps. The API contract is unchanged in shape — only its `sundayWeeks` field is renamed (D-2) — so `fetchSchedule` and the endpoint stay untouched.

Rationale (user-chosen over the API-side alternative): the API keeps serving exactly one month per request; the merge is trivial (dates never overlap between distinct months, plain object spread, later wins but no key collision is possible); the store shape and reducer semantics stay identical.

All-or-nothing error handling: if any of the three fetches rejects, a single `scheduleFetchError` is dispatched (existing error path, unchanged).

### D-2: Week number anchored on Monday, `sundayWeeks` → `mondayWeeks` (ADR-0008)

In `PlanningService.getSchedule()`, the week number is recorded when `weekdayIndex(date) === 0` (Monday) instead of `6` (Sunday). The value is unchanged — a Sunday and its preceding Monday share the same `weekIndexForDate` — only the anchor day moves to the start of the week row. The field is renamed `mondayWeeks: Record<string, number>` in `ScheduleMonth` and across the API/webapp so the code stays honest. Amends ADR-0007.

### D-3: Full-date grid with opacity-based dimming

`monthGrid(month)` returns `string[][]`: the leading/trailing `null` padding becomes the real dates of the adjacent months (pure calendar math in the webapp, no schedule knowledge needed — mirroring the existing `monthGrid` logic, and consistent with the API still owning the rotation rule).

`MonthCalendar` marks a cell as adjacent via `date.slice(0, 7) !== month` and adds `opacity-50` on the cell wrapper — day number, shifts and `S{n}` badge are dimmed together. The "today" highlight is unchanged (a today falling on an adjacent cell is dimmed like the rest of the cell). `data-testid="day-YYYY-MM-DD"` now also exists for adjacent dates.

Because the middleware merges three months, `days[date]` is populated for every rendered date whenever the fetch succeeds; the existing `?? []` fallback stays as a safety net.

## Architecture

### Shared (`shared/src/types.ts`, then rebuild)

```ts
export interface ScheduleMonth {
  month: string; // "YYYY-MM"
  days: Record<string, PersonDay[]>; // "YYYY-MM-DD" -> PersonDay[]
  mondayWeeks: Record<string, number>; // Monday "YYYY-MM-DD" -> planning week number 1..6
}
```

### API (`api/src/planning/planning.service.ts`)

In the `monthDays(month)` loop of `getSchedule()`:

```ts
if (day === 0) {
  mondayWeeks[date] = week + 1; // 1-based: 1 = S1 .. 6 = S6
}
```

Return `{ month, days, mondayWeeks }`. No new endpoint, no new helper.

### Webapp store

- `actions.ts`: `SchedulePayload.sundayWeeks` → `mondayWeeks`.
- `store/types.ts`: `ScheduleState.sundayWeeks` → `mondayWeeks`.
- `reducers.ts`: `initialSchedule.mondayWeeks = null`; `SCHEDULE_FETCH_SUCCESS` stores `payload.mondayWeeks`.
- `apiMiddleware.ts`, `SCHEDULE_FETCH_REQUESTED` case:

```ts
const month = typed.payload as string;
store.dispatch(scheduleFetchStart(month));
Promise.all([shiftMonth(month, -1), month, shiftMonth(month, 1)].map((m) => api.fetchSchedule(m)))
  .then(([prev, cur, next]) =>
    store.dispatch(
      scheduleFetchSuccess({
        month,
        days: { ...prev.days, ...cur.days, ...next.days },
        mondayWeeks: { ...prev.mondayWeeks, ...cur.mondayWeeks, ...next.mondayWeeks },
      }),
    ),
  )
  .catch((err: Error) => store.dispatch(scheduleFetchError(err.message)));
```

(`shiftMonth` already exists in `webapp/src/utils/dates.ts`.)

### Webapp grid

`dates.ts`:

```ts
export function monthGrid(month: string): string[][] {
  const [year, monthIndex] = month.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, monthIndex - 1, 1));
  const offset = (firstDay.getUTCDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const totalCells = offset + daysInMonth;
  const cellCount = Math.ceil(totalCells / 7) * 7;

  const cells: string[] = [];
  for (let i = 0; i < cellCount; i++) {
    const d = new Date(Date.UTC(year, monthIndex - 1, 1 - offset + i));
    cells.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
    );
  }
  const weeks: string[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}
```

`MonthCalendar.tsx`:

- `const mondayWeeks = useSelector((state: RootState) => state.schedule.mondayWeeks);`
- Per cell: `const isAdjacent = date.slice(0, 7) !== month;` and the wrapper div gets `opacity-50` when adjacent.
- Badge: `{mondayWeeks?.[date] !== undefined && <span>S{mondayWeeks[date]}</span>}` (unchanged lookup pattern, now keyed by Mondays).
- The grid no longer has `null` cells: the `{date && (...)}` guard around the day number becomes unnecessary and is removed; the `personDays` filter keeps its `?? []`.

## Testing

- **API unit** (`planning.service.spec.ts`): `mondayWeeks` keys are exactly the Mondays of the requested month; values are 1-based and wrap after S6; `days` still covers only the requested month. Controller spec fixture updated. E2e (`planning.e2e-spec.ts`) updated: `mondayWeeks` with the expected Monday→week mapping.
- **Webapp middleware** (`apiMiddleware.spec.ts`): one `SCHEDULE_FETCH_REQUESTED('2026-08')` triggers `fetchSchedule` for `2026-07`, `2026-08`, `2026-09`; success payload merges the three `days`/`mondayWeeks` maps and keeps `month: '2026-08'`; a rejection of any of the three dispatches `SCHEDULE_FETCH_ERROR`.
- **Webapp store** (`store.spec.ts`): rename applied, merged payload stored.
- **Webapp dates** (`dates.spec.ts`): `monthGrid` returns full dates with no `null`, correct adjacent dates at month/year boundaries (e.g. August 2026 starts with `2026-07-27`; January 2026 starts with `2025-12-29`).
- **Webapp component** (`MonthCalendar.spec.tsx`): an adjacent cell renders with `opacity-50` and shows its schedule; `S{n}` renders on Monday cells; a Sunday cell shows no badge.

## Docs

- ADR-0008 (adjacent-month data via three merged fetches + Monday anchor, amends ADR-0007); ADR-0007 status updated to "Amended by ADR-0008".
- `webapp/ARCHITECTURE.md` and `api/ARCHITECTURE.md` updated where they describe the grid padding / `sundayWeeks`.
