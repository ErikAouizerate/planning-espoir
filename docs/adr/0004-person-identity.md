# ADR-0004: Person identity

Status: Accepted

## Context

People appear in the same order in every week block, but their names are not always spelled identically across weeks (e.g. `Céline PREAU` in `S1` vs `Céline PREAULT` in `S2`–`S6`). Matching by name would create duplicate people.

## Decision

The canonical person list (names, roles, colors) is built from the `S1` block only. Each later week's rows are matched to those people by row index within the block, not by name. Names are trimmed (whitespace stripped), so `Anais Bouyssounaîs ` and `Anais Bouyssounaîs` are the same person. Each person gets a `colorIndex` from a fixed palette by order of appearance in `S1`, stored in the normalized JSON so it is stable across uploads as long as person order does not change.

## Consequences

- The dropdown shows one person per canonical `S1` entry, even with spelling variations in later weeks.
- Trimming and index-based matching keep identity stable across the file.
- `colorIndex` is deterministic from the file, giving each person a stable color between uploads.
