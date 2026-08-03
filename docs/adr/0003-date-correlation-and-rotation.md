# ADR-0003: Date correlation and rotation

Status: Accepted

## Context

The sheet's six template weeks (`S1`..`S6`) map to real calendar dates. The sheet name encodes a start date (e.g. `A compter du 27Juillet`). Dates before `S1` or after `S6` must still resolve to a template week, and the correlation must survive re-uploads and manual correction.

## Decision

The start date lives in `data/config.json` (`config.json.startDate`), never duplicated in the normalized model. On upload it is pre-filled from the sheet name — day + French month from the sheet name, year from the uploaded file's original filename, falling back to the current year — and it can be corrected through the UI. Re-uploading re-prefills `startDate` from the new document. Template weeks cycle perpetually `S1`..`S6`; a real date maps to a week via Euclidean modulo so it is well-defined even before the start date:

```
weekIndex = (( floor((date - startDate) / 7 days) % 6 ) + 6) % 6
```

## Consequences

- Any date resolves to a template week, including dates before `S1` or after `S6`.
- A manual `startDate` correction persists until the next upload, which re-prefills from the document.
- One source of truth for the correlation; no duplication in the model.
