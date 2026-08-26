# ADR-0008: Adjacent-month days in the calendar grid, week number on Mondays

Status: Accepted

## Context

The month grid left empty cells where the first/last week overlapped the previous/next month, hiding shifts that belong to those weeks. Separately, the planning week badge (`S1`..`S6`, ADR-0007) sat on Sundays, at the end of the week row. Two options were considered for the adjacent-day data: extend the API schedule response to cover the whole grid, or let the webapp fetch the adjacent months and merge client-side.

## Decision

1. The webapp fetches the previous, current and next month schedules in parallel on every `SCHEDULE_FETCH_REQUESTED` and dispatches a single success action with the merged `days`/`mondayWeeks` maps (all-or-nothing on error). The API keeps serving exactly one month per request; its response shape is unchanged.
2. The week number anchor moves from Sunday to Monday (start of the planning week row); the `ScheduleMonth.sundayWeeks` field is renamed `mondayWeeks`. The computed values are unchanged. This amends ADR-0007.
3. `monthGrid()` returns full dates (`string[][]`) instead of `null` padding; `MonthCalendar` dims cells outside the displayed month with `opacity-50`.

## Consequences

- Each month navigation costs three small requests instead of one; payloads are tiny and the merge is trivial (dates never overlap between months).
- Every grid row starts with a Monday, so every row shows its week badge — including a dimmed previous-month Monday in the first row.
- The API stays the single source of truth for the S1–S6 rotation; the webapp only does pure calendar math for the grid dates.
