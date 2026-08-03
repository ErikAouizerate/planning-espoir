# ADR-0002: Excel parsing and storage

Status: Accepted

## Context

The planning is a `.xlsx` file with six weekly blocks (`S1`..`S6`). The app must show a schedule that always matches the latest uploaded document, and must work without a database.

## Decision

The `.xlsx` is uploaded to the NestJS API, kept on disk, and parsed server-side with `exceljs` — the browser never parses Excel. On upload, the API parses the file once and writes a normalized JSON model to disk; GET endpoints read that model. Re-parse happens only on the next upload. Storage under `DATA_DIR`: `planning.xlsx` (raw source), `planning.json` (normalized model), `config.json` (`{ startDate, defaultName }`).

## Consequences

- The displayed schedule always matches the latest uploaded document.
- Parsing runs once per upload rather than per request, keeping GET endpoints cheap.
- One planning at a time: a new upload replaces the previous one.
