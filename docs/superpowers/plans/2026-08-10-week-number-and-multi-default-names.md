# Week Number on Sundays & Multiple Default Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display the planning week number (`S1`…`S6`) in each Sunday cell, and let the config hold multiple default persons (`defaultNames`) selected with the header's multi-select component.

**Architecture:** The API stays the single source of truth for the S1–S6 rotation (ADR-0003, ADR-0007): `ScheduleMonth` gains a `sundayWeeks` map (Sunday date → 1-based week number) computed in `PlanningService.getSchedule()`. `Config.defaultName` becomes `defaultNames: string[]` (ADR-0006), with legacy `config.json` files normalized at load (old field ignored, no migration). The webapp extracts a controlled `PersonMultiSelect` component reused by `PersonDropdown` (header) and `ConfigModal`; auto-selection of defaults happens on config fetch only.

**Tech Stack:** TypeScript ~5.9.3, NestJS (Jest + supertest), React 19 + Redux classic reducers/custom middleware (Vitest + Testing Library), yarn workspaces.

## Global Constraints

- All code, documentation, and tests in **English**; communication with the user is in French.
- yarn workspaces: `shared`, `api`, `webapp`. Run workspace commands as `yarn workspace <pkg> <script>` from the repo root.
- **`shared/` is consumed from `dist/`**: after editing it, run `yarn workspace @planning-espoir/shared build` before typechecking/testing api or webapp.
- **Redux constraints (non-negotiable):** plain classic reducers + custom API middleware — no thunks, no slices, no `createReducer`. Async flows follow `*_REQUESTED` → `*_START` / `*_SUCCESS` / `*_ERROR`.
- Lint enforces Prettier formatting (`prettier/prettier: error`); run `yarn format` if lint fails on style.
- French UI copy: the config label becomes `Noms par défaut`; the Sunday badge is `S{n}` (e.g. `S3`).
- No migration of legacy `config.json`: the old `defaultName` field is ignored and dropped on next save.
- After a config **update**, the current selection is left untouched (defaults auto-apply on fetch only).

---

### Task 1: Shared types — `sundayWeeks` on `ScheduleMonth`, `defaultNames` on `Config`

**Files:**

- Modify: `shared/src/types.ts`

**Interfaces:**

- Produces (used by every later task):

```ts
export interface ScheduleMonth {
  month: string; // "YYYY-MM"
  days: Record<string, PersonDay[]>; // "YYYY-MM-DD" -> PersonDay[]
  sundayWeeks: Record<string, number>; // Sunday "YYYY-MM-DD" -> planning week number 1..6
}

export interface Config {
  startDate: string | null; // "YYYY-MM-DD"
  defaultNames: string[];
  fileName: string | null; // original name of the uploaded planning file
}
```

- [ ] **Step 1: Edit the types**

In `shared/src/types.ts`, replace the `ScheduleMonth` and `Config` interfaces with the versions above (add the `sundayWeeks` line; replace `defaultName: string | null;` with `defaultNames: string[];`).

- [ ] **Step 2: Rebuild shared**

Run: `yarn workspace @planning-espoir/shared build`
Expected: builds cleanly. Note: api and webapp typechecks are expected to fail until Tasks 2–4 land (they still reference `defaultName`).

- [ ] **Step 3: Commit**

```bash
git add shared/src/types.ts
git commit -m "feat(shared): add sundayWeeks to ScheduleMonth, defaultNames to Config"
```

---

### Task 2: API — `sundayWeeks` in schedule, `defaultNames` validation, legacy config normalization

**Files:**

- Modify: `api/src/planning/storage.ts`
- Modify: `api/src/planning/planning.service.ts`
- Test: `api/src/planning/storage.spec.ts`
- Test: `api/src/planning/planning.controller.spec.ts`
- Test: `api/test/planning.e2e-spec.ts`

**Interfaces:**

- Consumes: `Config` / `ScheduleMonth` from `@planning-espoir/shared` (Task 1); existing helpers `monthDays`, `weekdayIndex`, `weekIndexForDate` from `./date-rotation` (`weekdayIndex` is Monday-first: Sunday = 6).
- Produces: `GET /api/planning/schedule` response gains `sundayWeeks: Record<string, number>` (1-based). `PUT /api/planning/config` accepts `defaultNames: string[]` (400 otherwise). `Storage.loadConfig(): Promise<Config>` always returns the new shape.

- [ ] **Step 1: Update the failing unit specs**

`api/src/planning/storage.spec.ts` — replace the two config tests and add a legacy-normalization test (add `writeFile` to the `fs/promises` import):

```ts
it('returns null config defaults when nothing is stored', async () => {
  await expect(storage.loadConfig()).resolves.toEqual({
    startDate: null,
    defaultNames: [],
    fileName: null,
  });
});

it('normalizes a legacy config file with defaultName', async () => {
  await writeFile(
    join(dir, 'config.json'),
    JSON.stringify({ startDate: '2026-07-27', defaultName: 'BOB Dylan', fileName: 'p.xlsx' }),
  );
  await expect(storage.loadConfig()).resolves.toEqual({
    startDate: '2026-07-27',
    defaultNames: [],
    fileName: 'p.xlsx',
  });
});

it('round-trips config', async () => {
  await storage.saveConfig({
    startDate: '2026-07-27',
    defaultNames: ['BOB Dylan'],
    fileName: null,
  });
  await expect(storage.loadConfig()).resolves.toEqual({
    startDate: '2026-07-27',
    defaultNames: ['BOB Dylan'],
    fileName: null,
  });
});
```

(Keep the `round-trips a planning JSON` and `returns null when no planning JSON exists` tests unchanged.)

`api/src/planning/planning.controller.spec.ts` — update the two fixtures: in `delegates getSchedule to the service`, use `{ month: '2026-08', days: {}, sundayWeeks: {} }` (both in the mock and the expectation); in `delegates config get/put to the service`, replace every `defaultName: null` with `defaultNames: []`.

- [ ] **Step 2: Update the e2e spec**

`api/test/planning.e2e-spec.ts`:

a) Insert this test **before** `round-trips config via GET/PUT` (that config test mutates `startDate`; this one must run while `startDate` is still `2026-07-27`):

```ts
it('exposes the planning week number for each Sunday of the month', async () => {
  const res = await request(app.getHttpServer())
    .get('/api/planning/schedule?month=2026-08')
    .expect(200);
  expect(res.body.sundayWeeks).toEqual({
    '2026-08-02': 1,
    '2026-08-09': 2,
    '2026-08-16': 3,
    '2026-08-23': 4,
    '2026-08-30': 5,
  });
});
```

b) In `round-trips config via GET/PUT`, change the `before.body` expectation to:

```ts
expect(before.body).toEqual({
  startDate: '2026-07-27',
  defaultNames: [],
  fileName: 'Copie de Planning ecluse Proposition Aout 2026.xlsx',
});
```

and extend the same test after the existing `after` assertion with:

```ts
const putNames = await request(app.getHttpServer())
  .put('/api/planning/config')
  .send({ defaultNames: ['BOB Dylan', 'TAUZIN Caroline'] })
  .expect(200);
expect(putNames.body.defaultNames).toEqual(['BOB Dylan', 'TAUZIN Caroline']);
const afterNames = await request(app.getHttpServer()).get('/api/planning/config').expect(200);
expect(afterNames.body.defaultNames).toEqual(['BOB Dylan', 'TAUZIN Caroline']);
```

c) Add a validation test after `rejects an impossible startDate on PUT`:

```ts
it('rejects invalid defaultNames on PUT', async () => {
  await request(app.getHttpServer())
    .put('/api/planning/config')
    .send({ defaultNames: 'BOB Dylan' })
    .expect(400);
  await request(app.getHttpServer())
    .put('/api/planning/config')
    .send({ defaultNames: ['BOB Dylan', 42] })
    .expect(400);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn workspace @planning-espoir/api test -- planning`
Expected: FAIL — `loadConfig` returns `defaultName`, `getSchedule` has no `sundayWeeks`, `updateConfig` does not validate `defaultNames`. (Type errors about `defaultName` not existing on `Config` are also expected at this stage.)

- [ ] **Step 4: Implement `storage.ts` normalization**

Replace `loadConfig()` with:

```ts
async loadConfig(): Promise<Config> {
  const raw = await this.readJson<Record<string, unknown>>('config.json');
  if (!raw) return { startDate: null, defaultNames: [], fileName: null };
  return {
    startDate: typeof raw.startDate === 'string' ? raw.startDate : null,
    defaultNames: Array.isArray(raw.defaultNames)
      ? raw.defaultNames.filter((n): n is string => typeof n === 'string')
      : [],
    fileName: typeof raw.fileName === 'string' ? raw.fileName : null,
  };
}
```

(The legacy `defaultName` key is simply never read, so it disappears on the next `saveConfig`.)

- [ ] **Step 5: Implement `planning.service.ts`**

In `getSchedule()`, build `sundayWeeks` inside the existing loop and return it:

```ts
const days: Record<string, PersonDay[]> = {};
const sundayWeeks: Record<string, number> = {};
for (const date of monthDays(month)) {
  const week = weekIndexForDate(config.startDate, date);
  const day = weekdayIndex(date);
  if (day === 6) {
    sundayWeeks[date] = week + 1; // 1-based: 1 = S1 .. 6 = S6
  }
  days[date] = stored.people.map((p) => ({
    name: p.name,
    colorIndex: p.colorIndex,
    cell: p.weeks[week][day],
  }));
}
return { month, days, sundayWeeks };
```

In `updateConfig()`, replace the `defaultName` block with:

```ts
if (update.defaultNames !== undefined) {
  if (
    !Array.isArray(update.defaultNames) ||
    update.defaultNames.some((n) => typeof n !== 'string')
  ) {
    throw new BadRequestException('defaultNames must be an array of strings');
  }
  config.defaultNames = update.defaultNames;
}
```

- [ ] **Step 6: Run API tests and typecheck**

Run: `yarn workspace @planning-espoir/api test && yarn workspace @planning-espoir/api test:e2e && yarn workspace @planning-espoir/api typecheck`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add api/src/planning/storage.ts api/src/planning/planning.service.ts api/src/planning/storage.spec.ts api/src/planning/planning.controller.spec.ts api/test/planning.e2e-spec.ts
git commit -m "feat(api): expose sundayWeeks in schedule, support multiple defaultNames"
```

---

### Task 3: Webapp store — `sundayWeeks` state, multi-default auto-selection

**Files:**

- Modify: `webapp/src/store/types.ts`
- Modify: `webapp/src/store/actions.ts`
- Modify: `webapp/src/store/reducers.ts`
- Modify: `webapp/src/store/apiMiddleware.ts`
- Test: `webapp/src/store/apiMiddleware.spec.ts`
- Test: `webapp/src/store/store.spec.ts`

**Interfaces:**

- Consumes: `Config` / `ScheduleMonth` from `@planning-espoir/shared` (Task 1).
- Produces:
  - `ScheduleState` gains `sundayWeeks: Record<string, number> | null` (consumed by `MonthCalendar` in Task 5).
  - `SchedulePayload` (in `actions.ts`) gains `sundayWeeks: Record<string, number>`.
  - Middleware behavior: on config fetch success, dispatch `selectionAdd(name)` for each `defaultNames` entry found in `planning.people`; config update success never touches the selection.

- [ ] **Step 1: Update the failing middleware spec**

`webapp/src/store/apiMiddleware.spec.ts` — in the existing tests, replace `defaultName: 'TAUZIN Caroline'` with `defaultNames: ['TAUZIN Caroline']`, and `defaultName: null` with `defaultNames: []` (including the `{ startDate: '2026-07-27', defaultName: null }` payload in the upload-refetch test). Add `configUpdateRequested` to the `./actions` import. Then add two tests:

```ts
it('selects all default names present in the planning after a config fetch', async () => {
  const fetchMock = vi.mocked(fetch);
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        startDate: '2026-07-27',
        defaultNames: ['TAUZIN Caroline', 'BOB Dylan', 'Inconnu'],
        fileName: null,
      }),
      { status: 200 },
    ),
  );

  const store = configureStore();
  store.dispatch({
    type: 'PLANNING_FETCH_SUCCESS',
    payload: {
      startDate: '2026-07-27',
      people: [
        { name: 'TAUZIN Caroline', role: 'R', colorIndex: 0, weeks: [] },
        { name: 'BOB Dylan', role: 'R', colorIndex: 1, weeks: [] },
      ],
      warnings: [],
    },
  });

  store.dispatch(configFetchRequested());

  await vi.waitFor(() => {
    expect(store.getState().selection.names).toEqual(['TAUZIN Caroline', 'BOB Dylan']);
  });
});

it('does not change the selection after a config update', async () => {
  const fetchMock = vi.mocked(fetch);
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        startDate: '2026-07-27',
        defaultNames: ['BOB Dylan'],
        fileName: null,
      }),
      { status: 200 },
    ),
  );

  const store = configureStore();
  store.dispatch(configUpdateRequested({ defaultNames: ['BOB Dylan'] }));

  await vi.waitFor(() => {
    expect(store.getState().config.config.defaultNames).toEqual(['BOB Dylan']);
  });
  expect(store.getState().selection.names).toEqual([]);
});
```

- [ ] **Step 2: Add the `sundayWeeks` store spec**

In `webapp/src/store/store.spec.ts`, add `scheduleFetchSuccess` to the `./actions` import and add:

```ts
it('stores sundayWeeks on schedule fetch success', () => {
  const store = configureStore();
  store.dispatch(
    scheduleFetchSuccess({ month: '2026-08', days: {}, sundayWeeks: { '2026-08-02': 1 } }),
  );
  expect(store.getState().schedule.sundayWeeks).toEqual({ '2026-08-02': 1 });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn workspace @planning-espoir/webapp test -- src/store`
Expected: FAIL — type errors on `defaultNames` / `sundayWeeks`, and the new assertions fail.

- [ ] **Step 4: Implement store changes**

`webapp/src/store/types.ts` — in `ScheduleState`, add:

```ts
sundayWeeks: Record<string, number> | null;
```

`webapp/src/store/actions.ts` — in `SchedulePayload`, add:

```ts
sundayWeeks: Record<string, number>;
```

`webapp/src/store/reducers.ts`:

- `initialSchedule`: add `sundayWeeks: null,`.
- `initialConfig`: `config: { startDate: null, defaultNames: [], fileName: null },`
- `SCHEDULE_FETCH_SUCCESS` payload cast and state update:

```ts
case SCHEDULE_FETCH_SUCCESS: {
  const payload = action.payload as {
    month: string;
    days: Record<string, PersonDay[]>;
    sundayWeeks: Record<string, number>;
  };
  return {
    ...state,
    status: 'loaded',
    month: payload.month,
    days: payload.days,
    sundayWeeks: payload.sundayWeeks,
    error: null,
  };
}
```

`webapp/src/store/apiMiddleware.ts` — replace the `CONFIG_FETCH_REQUESTED` success body with:

```ts
.then((data) => {
  store.dispatch(configFetchSuccess(data));
  const people = store.getState().planning.people ?? [];
  for (const name of data.defaultNames) {
    if (people.some((p) => p.name === name)) {
      store.dispatch(selectionAdd(name));
    }
  }
})
```

(The `CONFIG_UPDATE_REQUESTED` handler stays as-is: no selection side effect.)

- [ ] **Step 5: Run the webapp store tests**

Run: `yarn workspace @planning-espoir/webapp test -- src/store`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add webapp/src/store
git commit -m "feat(webapp): store sundayWeeks, auto-select multiple default names"
```

---

### Task 4: Webapp — extract `PersonMultiSelect`, multi-select in `ConfigModal`

**Files:**

- Create: `webapp/src/components/PersonMultiSelect.tsx`
- Modify: `webapp/src/components/PersonDropdown.tsx`
- Modify: `webapp/src/components/ConfigModal.tsx`
- Test: `webapp/src/components/PersonMultiSelect.spec.tsx`

**Interfaces:**

- Consumes: `Person` from `@planning-espoir/shared`; existing hook `useClickOutside(ref, handler)` from `../hooks/useClickOutside`; `selectionToggle` action.
- Produces:
  - `PersonMultiSelect({ people, selected, onToggle }: { people: Person[]; selected: string[]; onToggle: (name: string) => void })` — controlled dropdown, button label `Personnes ({selected.length})`.
  - `PersonDropdown` — same Redux-bound API as today (no props), unchanged behavior.
  - `ConfigModal` dispatches `configUpdateRequested({ startDate: string | null, defaultNames: string[] })`.

- [ ] **Step 1: Write the failing component test**

`webapp/src/components/PersonMultiSelect.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Person } from '@planning-espoir/shared';
import { PersonMultiSelect } from './PersonMultiSelect';

const people: Person[] = [
  { name: 'BOB Dylan', role: 'R', colorIndex: 0, weeks: [] },
  { name: 'TAUZIN Caroline', role: 'R', colorIndex: 1, weeks: [] },
];

describe('PersonMultiSelect', () => {
  it('shows the selection count and calls onToggle with the clicked name', async () => {
    const onToggle = vi.fn();
    render(<PersonMultiSelect people={people} selected={['BOB Dylan']} onToggle={onToggle} />);

    expect(screen.getByRole('button', { name: 'Personnes (1)' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Personnes (1)' }));
    const checkbox = screen.getByRole('checkbox', { name: 'TAUZIN Caroline' });
    expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith('TAUZIN Caroline');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn workspace @planning-espoir/webapp test -- src/components`
Expected: FAIL — `PersonMultiSelect` does not exist.

- [ ] **Step 3: Create `PersonMultiSelect.tsx`**

Extracted verbatim from the current `PersonDropdown` markup, but controlled:

```tsx
import { useRef, useState } from 'react';
import type { Person } from '@planning-espoir/shared';
import { useClickOutside } from '../hooks/useClickOutside';

interface Props {
  people: Person[];
  selected: string[];
  onToggle: (name: string) => void;
}

export function PersonMultiSelect({ people, selected, onToggle }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false));

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        Personnes ({selected.length})
      </button>
      {open && (
        <div className="absolute z-10 mt-1 max-h-64 w-64 overflow-auto rounded border border-slate-200 bg-white shadow-lg">
          {people.map((p) => (
            <label
              key={p.name}
              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(p.name)}
                onChange={() => onToggle(p.name)}
              />
              {p.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `PersonDropdown.tsx` as a Redux wrapper**

```tsx
import { useDispatch, useSelector } from 'react-redux';
import { selectionToggle } from '../store/actions';
import type { RootState } from '../store/types';
import { PersonMultiSelect } from './PersonMultiSelect';

export function PersonDropdown() {
  const dispatch = useDispatch();
  const people = useSelector((state: RootState) => state.planning.people) ?? [];
  const selection = useSelector((state: RootState) => state.selection.names);
  const { status } = useSelector((state: RootState) => state.config);

  if (status !== 'loaded') {
    return null;
  }
  return (
    <PersonMultiSelect
      people={people}
      selected={selection}
      onToggle={(name) => dispatch(selectionToggle(name))}
    />
  );
}
```

- [ ] **Step 5: Rework `ConfigModal.tsx` to multi-select**

- Replace `const [defaultName, setDefaultName] = useState('');` with `const [defaultNames, setDefaultNames] = useState<string[]>([]);`.
- Delete the `nameOpen`/`nameRef` state and the `useClickOutside(nameRef, ...)` line (the hook import stays only if still used — it is not; remove it), and remove `setNameOpen(false);` from the `useEffect`.
- In the `useEffect`, replace `setDefaultName(config.defaultName ?? '');` with `setDefaultNames([...config.defaultNames]);`.
- Replace the whole `<label …>Nom par défaut … </label>` block with:

```tsx
<div className="mt-4">
  <span className="block text-sm font-medium text-slate-600">Noms par défaut</span>
  <div className="mt-1">
    <PersonMultiSelect
      people={people}
      selected={defaultNames}
      onToggle={(name) =>
        setDefaultNames((prev) =>
          prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
        )
      }
    />
  </div>
</div>
```

- In the save button, dispatch `configUpdateRequested({ startDate: startDate || null, defaultNames })`.
- Add the import: `import { PersonMultiSelect } from './PersonMultiSelect';`

- [ ] **Step 6: Run tests and typecheck**

Run: `yarn workspace @planning-espoir/webapp test -- src/components && yarn workspace @planning-espoir/webapp typecheck`
Expected: PASS (the whole webapp typecheck is green again at this point — `MonthCalendar` never referenced `defaultName`).

- [ ] **Step 7: Commit**

```bash
git add webapp/src/components/PersonMultiSelect.tsx webapp/src/components/PersonMultiSelect.spec.tsx webapp/src/components/PersonDropdown.tsx webapp/src/components/ConfigModal.tsx
git commit -m "feat(webapp): extract PersonMultiSelect, multi-select default names in config"
```

---

### Task 5: Webapp — `S{n}` badge in Sunday cells

**Files:**

- Modify: `webapp/src/components/MonthCalendar.tsx`
- Test: `webapp/src/components/MonthCalendar.spec.tsx`

**Interfaces:**

- Consumes: `state.schedule.sundayWeeks: Record<string, number> | null` (Task 3); `createTestStore(preloadedState?: Partial<RootState>)` from `webapp/src/test/store.ts`.

- [ ] **Step 1: Write the failing component test**

`webapp/src/components/MonthCalendar.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { createTestStore } from '../test/store';
import { MonthCalendar } from './MonthCalendar';

function renderCalendar(sundayWeeks: Record<string, number>) {
  const store = createTestStore({
    schedule: { status: 'loaded', month: '2026-08', days: {}, sundayWeeks, error: null },
  });
  return render(
    <Provider store={store}>
      <MonthCalendar />
    </Provider>,
  );
}

describe('MonthCalendar sundayWeeks', () => {
  it('renders S{n} in Sunday cells and nothing in other cells', () => {
    renderCalendar({ '2026-08-02': 1, '2026-08-09': 2 });

    expect(screen.getByTestId('day-2026-08-02')).toHaveTextContent('S1');
    expect(screen.getByTestId('day-2026-08-09')).toHaveTextContent('S2');
    expect(screen.getByTestId('day-2026-08-01')).not.toHaveTextContent('S');
    expect(screen.getByTestId('day-2026-08-03')).not.toHaveTextContent('S');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn workspace @planning-espoir/webapp test -- src/components/MonthCalendar`
Expected: FAIL — `toHaveTextContent('S1')` not found.

- [ ] **Step 3: Implement the badge in `MonthCalendar.tsx`**

Add the selector near the others:

```ts
const sundayWeeks = useSelector((state: RootState) => state.schedule.sundayWeeks);
```

Replace the day-number block with:

```tsx
{date && (
  <div className="flex items-baseline justify-between text-[10px] text-slate-400 sm:text-xs">
    <span>{Number(date.slice(8, 10))}</span>
    {sundayWeeks?.[date] !== undefined && <span>S{sundayWeeks[date]}</span>}
  </div>
)}
```

- [ ] **Step 4: Run the webapp tests and typecheck**

Run: `yarn workspace @planning-espoir/webapp test && yarn workspace @planning-espoir/webapp typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/MonthCalendar.tsx webapp/src/components/MonthCalendar.spec.tsx
git commit -m "feat(webapp): show planning week number in Sunday cells"
```

---

### Task 6: Docs + full verification

**Files:**

- Modify: `AGENTS.md`

- [ ] **Step 1: Update `AGENTS.md`**

In the `api/` bullet of the Repo layout section, change `` `config.json` (`startDate`, `defaultName`, `fileName`) `` to `` `config.json` (`startDate`, `defaultNames`, `fileName`) ``.

- [ ] **Step 2: Full verification**

Run from the repo root: `yarn lint && yarn typecheck && yarn test && yarn build`
Expected: all PASS. If lint fails on formatting, run `yarn format` and re-run.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: defaultNames in AGENTS.md config.json field list"
```

