# ADR-0006: Multiple default persons

Status: Accepted

## Context

`config.json` held a single `defaultName`, auto-selected in the header selector when the config is loaded. Users want several persons checked by default instead of just one. ADR-0005 described the single default name as "an editable preference only"; the code in fact applies it at load, and that behavior is kept.

## Decision

`Config.defaultName: string | null` becomes `defaultNames: string[]`, persisted in `config.json` and edited through a multi-select in the config modal (the same component as the header selector). On config load, every default name present in the planning is auto-selected; a config update does not touch the current selection. No migration: legacy files containing `defaultName` load with `defaultNames: []` and the old field is dropped on the next save.

## Consequences

- Several persons can be pre-selected at load.
- Legacy `defaultName` values are silently discarded (accepted: defaults are re-entered once).
- `defaultNames` entries missing from the current planning are kept in config but not auto-selected.
