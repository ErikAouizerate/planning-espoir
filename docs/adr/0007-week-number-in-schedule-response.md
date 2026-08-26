# ADR-0007: Week number in schedule response

Status: Amended by ADR-0008 (week badge moved from Sunday to Monday, `sundayWeeks` renamed `mondayWeeks`)

## Context

The calendar must display the current planning week (`S1`..`S6`) inside each Sunday cell. The rotation rule (`weekIndexForDate`, ADR-0003) exists only in the API, and `shared/` is types-only. Options considered: move the computation to `shared/` (architecture change), duplicate it in the webapp (rule duplicated), or expose the result in the API response.

## Decision

`ScheduleMonth` gains `sundayWeeks: Record<string, number>` mapping each Sunday of the requested month to its 1-based week number (1 = S1 … 6 = S6), computed server-side with `weekIndexForDate`. The webapp renders `S{n}` in the Sunday cell without reimplementing the rotation rule.

## Consequences

- The API remains the single source of truth for the S1–S6 rotation; `shared/` stays types-only.
- The displayed week for a Sunday is the one of the Monday→Sunday period ending that day.
- The response carries a few extra entries per month (one per Sunday).
