# ADR-0005: Frontend state and UX

Status: Accepted

## Context

The frontend must display selected people's schedules on a monthly calendar, driven by Redux, with a configurable start date and default name.

## Decision

State is managed with Redux using plain classic reducers and custom middlewares — no Redux Thunk, no slices, no `createReducer`. A custom middleware handles API calls with a request/success/failure pattern. State slices: `planning` (startDate, people, status), `schedule` (displayed month + month data), `selection` (selected names), `config` (editable startDate, defaultName), `colors` (palette + per-person colorIndex). The UI shows a month view (current month by default, previous/next navigation) with all selected people visible simultaneously, one color per person, stacked per day cell. `rh`/`RH` day-off cells render as a badge carrying the cell text in the person's color. At open, no person is selected; `config.json`'s `defaultName` is an editable preference only and is not applied automatically.

## Consequences

- Redux logic stays explicit and auditable with classic reducers and middleware.
- API state transitions follow a uniform request/success/failure pattern.
- Multiple selected people are always visible together, color-coded.
- No surprise pre-selection at load; the default name is user-editable.
