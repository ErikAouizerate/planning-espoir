# Adjacent-Month Days & Monday Week Number — Implementation Plan

Spec: `docs/superpowers/specs/2026-08-26-adjacent-month-days-design.md`
ADRs: 0008 (amends 0007)

**Architecture:** the webapp fetches prev/current/next month schedules in the apiMiddleware and merges them into a single success action; the grid renders full dates with `opacity-50` for out-of-month cells; the API anchors the week badge on Mondays and renames `sundayWeeks` → `mondayWeeks` everywhere.

One commit for the whole plan: `feat(calendar): show adjacent-month days dimmed, week number on Mondays`.

---

### Task 1: Shared — rename `sundayWeeks` → `mondayWeeks`

**Files:** `shared/src/types.ts`

- Replace the `sundayWeeks` line of `ScheduleMonth` with:

  ```ts
  mondayWeeks: Record<string, number>; // Monday "YYYY-MM-DD" -> planning week number 1..6
  ```

- Rebuild: `yarn workspace @planning-espoir/shared build`
- Expected: api + webapp typechecks now fail on every `sundayWeeks` usage (they are fixed in Tasks 2–4).

### Task 2: API — Monday anchor + rename

**Files:** `api/src/planning/planning.service.ts`, `api/src/planning/planning.service.spec.ts`, `api/src/planning/planning.controller.spec.ts`, `api/test/planning.e2e-spec.ts`

- [ ] **Step 1: failing specs**
  - `planning.service.spec.ts`: rename the week-badge describe to `mondayWeeks`; assert the keys are exactly the Mondays of the requested month (`weekdayIndex === 0`), 1-based, wrapping after S6 (adjust the existing Sunday-based expectations — values are unchanged, keys move from Sunday to the preceding Monday).
  - `planning.controller.spec.ts`: `{ month: '2026-08', days: {}, mondayWeeks: {} }` in both mock and expectation.
  - `planning.e2e-spec.ts`: rename `sundayWeeks` → `mondayWeeks` and move the expected keys to Mondays (e.g. for `2026-08` with startDate `2026-07-27`: `2026-07-27` is not in the month — expect the in-month Mondays `2026-08-03` → its week, etc.).
  - Run: `yarn workspace @planning-espoir/api test -- planning` — FAIL.
- [ ] **Step 2: implement** — in `getSchedule()`: `const mondayWeeks: Record<string, number> = {}`, `if (day === 0) { mondayWeeks[date] = week + 1; }`, return `{ month, days, mondayWeeks }`.
- [ ] **Step 3: verify** — `yarn workspace @planning-espoir/api test` and `yarn workspace @planning-espoir/api test:e2e` pass.

### Task 3: Webapp store — rename + three-month merge in the middleware

**Files:** `webapp/src/store/actions.ts`, `webapp/src/store/types.ts`, `webapp/src/store/reducers.ts`, `webapp/src/store/apiMiddleware.ts`, `webapp/src/store/apiMiddleware.spec.ts`, `webapp/src/store/store.spec.ts`

- [ ] **Step 1: failing specs**
  - `store.spec.ts`: rename `sundayWeeks` → `mondayWeeks` in the success-payload test.
  - `apiMiddleware.spec.ts` schedule tests: mock `api.fetchSchedule` per month; dispatching `scheduleFetchRequested('2026-08')` calls it with `2026-07`, `2026-08`, `2026-09`; success dispatches one `SCHEDULE_FETCH_SUCCESS` with `month: '2026-08'` and `days`/`mondayWeeks` equal to the spread-merge of the three responses; rejecting any one of the three dispatches `SCHEDULE_FETCH_ERROR`.
  - Run: `yarn workspace @planning-espoir/webapp test -- src/store` — FAIL.
- [ ] **Step 2: implement**
  - `actions.ts`: `SchedulePayload.sundayWeeks` → `mondayWeeks`.
  - `store/types.ts`: `ScheduleState.sundayWeeks` → `mondayWeeks`.
  - `reducers.ts`: `initialSchedule.mondayWeeks = null`; success case stores `payload.mondayWeeks`.
  - `apiMiddleware.ts`: replace the single fetch with the `Promise.all([shiftMonth(month,-1), month, shiftMonth(month,1)].map(api.fetchSchedule))` merge from the spec (import `shiftMonth` from `../utils/dates`).
- [ ] **Step 3: verify** — store + middleware specs pass.

### Task 4: Webapp grid — full dates, dimming, Monday badge

**Files:** `webapp/src/utils/dates.ts`, `webapp/src/utils/dates.spec.ts`, `webapp/src/components/MonthCalendar.tsx`, `webapp/src/components/MonthCalendar.spec.tsx`, `webapp/src/App.spec.tsx`, `webapp/src/components/PersonDropdown.spec.tsx`, `webapp/src/components/ConfigModal.spec.tsx`, `webapp/src/components/Header.spec.tsx`

- [ ] **Step 1: failing specs**
  - `dates.spec.ts`: `monthGrid('2026-08')` returns `string[][]` starting `2026-07-27` and ending `2026-09-06` with no `null`; add a year-crossing case (`monthGrid('2026-01')` starts `2025-12-29`).
  - `MonthCalendar.spec.tsx`:
    - rename the badge test: `mondayWeeks: { '2026-08-03': 2 }` renders `S2` in `day-2026-08-03`; `day-2026-08-02` (Sunday) has no badge;
    - new test: with `days` containing an adjacent date (e.g. `2026-07-27`), that cell has class `opacity-50` and renders the shift; an in-month cell does not have `opacity-50`;
    - all `sundayWeeks: null` fixtures → `mondayWeeks: null`.
  - `App.spec.tsx`, `PersonDropdown.spec.tsx`, `ConfigModal.spec.tsx`, `Header.spec.tsx`: rename fixture field.
  - Run: `yarn workspace @planning-espoir/webapp test` — FAIL.
- [ ] **Step 2: implement**
  - `dates.ts`: rewrite `monthGrid` to emit full adjacent-month dates (spec D-3 snippet).
  - `MonthCalendar.tsx`: consume `state.schedule.mondayWeeks`; `const isAdjacent = date.slice(0, 7) !== month;` → add `opacity-50` to the cell class when adjacent; drop the `{date && ...}` guard (no more nulls); badge lookup on `mondayWeeks`.
- [ ] **Step 3: verify** — `yarn workspace @planning-espoir/webapp test` passes.

### Task 5: Docs + global verification + commit

- Update `webapp/ARCHITECTURE.md` and `api/ARCHITECTURE.md` where they describe `null` padding / `sundayWeeks` / Sunday badge.
- `yarn format` then `yarn lint`, `yarn typecheck`, `yarn test` from the root — all green.
- `git add` code + tests + docs (`docs/adr/0007…` amended, `docs/adr/0008…`, spec, plan) and commit:
  `feat(calendar): show adjacent-month days dimmed, week number on Mondays`.
