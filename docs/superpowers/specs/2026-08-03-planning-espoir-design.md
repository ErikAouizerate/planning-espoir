# Planning Espoir — Design

Date: 2026-08-03
Status: Approved

Single-page application that uploads an Excel planning document and displays one or more people's work schedules on a monthly calendar. The upload is re-parsed on each update so the displayed schedule always matches the latest document.

## Context

The planning is a `.xlsx` file with a single meaningful sheet. The sheet name encodes the start date (e.g. `A compter du 27Juillet`). The sheet contains 6 weekly blocks (`S1`..`S6`), each with a header row (`S<n>`, `LUNDI`..`DIMANCHE`, `TOTAL`) followed by one row per person. Each person row is followed by a role/ETP metadata row (e.g. `ES -1 ETP`, `TISF 1 ETP /36`, `Educ _- 1 ETP`).

Each day occupies 4 columns: AM start, AM end, PM start, PM end (Monday = B,C,D,E; Sunday = Z..AC). Cells contain `datetime.time` values, the text `rh`/`RH` (day off), free text, or are empty (rest). The `TOTAL` column (`AD`) holds Excel formulas that are frequently broken (`#REF!`, `#NAME?`, `#VALUE!`) and is ignored.

## Goals

- Upload a planning `.xlsx`, keep it server-side between consultations.
- Display selected people's schedules on a monthly calendar.
- The displayed schedule always matches the latest uploaded document.
- No database: state lives in flat files on the server.

## Non-goals

- No total hours display.
- No authentication implementation (design for Keycloak OIDC only).
- No multi-file/version history: one planning at a time, replaced on re-upload.

## Decisions

### D1: Server-side parsing, file kept on disk

The `.xlsx` is uploaded to the NestJS API, stored on disk, and parsed with `exceljs`. The browser never parses Excel files.

### D2: Parse on upload, serve normalized JSON (Approach A)

On upload, the API parses the file once and writes a normalized JSON model to disk. GET endpoints read this normalized model. Re-parse happens only on the next upload. This matches "re-parsed on each update".

### D3: Date correlation stored in a flat file

The date↔template-week correlation start date lives in `data/config.json` on the server. On upload it is pre-filled from the Excel sheet name (e.g. `27Juillet` → 2026-07-27), and can be corrected through the UI. Re-uploading **re-prefills** `startDate` from the new document (the document is authoritative for its own start); a manual correction persists only until the next upload.

### D4: Perpetual cycle

A real date maps to template weeks `S1`..`S6` cyclically. When a date falls outside the 6-week window (before S1 or after S6), the cycle repeats.

Week index formula (Euclidean modulo so it is well-defined before the start date):

```
weekIndex = (( floor((date - startDate) / 7 days) % 6 ) + 6) % 6
```

### D5: Day-off cells (`rh`/`RH`)

`rh`/`RH` (case-insensitive) is a day off. It is displayed as a colored badge carrying the cell text, in the person's color.

### D6: Lenient time parsing

Time values tolerate `:`, `;`, and `h` separators, so a typo like `18;30` is read as `18:30`.

### D7: Color per person, automatic and arbitrary

Each person gets a color from a fixed palette, assigned by order of appearance in the file. `colorIndex` is stored in the normalized JSON so it is stable between uploads as long as the person order does not change.

### D8: Month view, all selected people visible simultaneously

The calendar shows the current month by default with previous/next month navigation. Multiple selected people are shown at once, one color per person, stacked per day cell.

### D9: No pre-selection at load

At open, no person is selected. The `defaultName` in the flat config file is an editable preference only; it is not applied automatically. It can be updated in the UI.

### D10: Person identity and name normalization

People always appear in the same order in every week block. The canonical person list (names, roles, colors) is built **from the `S1` block only**; later weeks are matched to those people **by row index** within the block, not by name.

Names are trimmed (whitespace stripped), so `Anais Bouyssounaîs ` and `Anais Bouyssounaîs` are the same person. The person list is built from week `S1`; each later week's row at index `i` is assigned to the person at index `i` from `S1`.

Known consequence: the real file spells `Céline PREAU` in `S1` and `Céline PREAULT` in `S2`–`S6`; index-based matching assigns both spellings to the single `S1` person `Céline PREAU`, so the dropdown shows **one** Céline.

## Architecture

```
webapp (React + Vite + Tailwind, SPA)
  ├─ POST /planning            upload .xlsx
  ├─ GET  /planning            people + colors + startDate
  ├─ GET  /planning/schedule?month=YYYY-MM
  ├─ GET  /planning/config     startDate + defaultName
  └─ PUT  /planning/config     update startDate / defaultName
```

- Monorepo with yarn workspaces; `webapp/` = React + Vite SPA, `api/` = NestJS backend.
- Deployable with Docker + docker-compose.
- Keycloak OIDC: designed for, not implemented.

### Storage (no database)

- `data/planning.xlsx` — the uploaded source file.
- `data/planning.json` — normalized parsed model (Approach A).
- `data/config.json` — `{ startDate, defaultName }` flat config shared by all users.

## Data model

```
Planning {
  people: Person[]
}

Person {
  name: string                 // e.g. "TAUZIN Caroline"
  role: string                 // e.g. "ES -1 ETP"
  colorIndex: number           // 0..palette.length-1, order of appearance
  weeks: DayCell[6][7]         // 6 template weeks × 7 days (Monday..Sunday)
}

DayCell =
  | { type: "shift", slots: { start: string, end: string }[] }  // 1-2 slots
  | { type: "off", label: string }                              // e.g. "rh"
  | { type: "none" }                                            // rest
```

Time values are stored as `"HH:MM"` strings (24h).

The effective `startDate` used for rotation is stored **only** in `config.json` (D3), never duplicated in the model.

## Parsing rules

- Use the sheet that contains the `S1`..`S6` blocks (the active sheet); ignore other sheets (e.g. `Feuil1`).
- Locate weekly blocks by `S<n>` in column A.
- Build the canonical person list from the `S1` block only. Within a block: person rows (a name in column A) are followed by a role/ETP row (`ES`, `TISF`, `Educ` prefix). Later weeks' person rows are matched to the `S1` people **by row index** (D10).
- Each day = 4 columns (AM start, AM end, PM start, PM end) → up to 2 slots.
- Cell interpretation:
  - `datetime.time` → slot.
  - text `rh`/`RH` (case-insensitive) → `off` with the original cell text as label.
  - time-like text (lenient: `:`, `;`, `h`) → slot.
  - empty → `none`.
- Ignore the `TOTAL` column (`AD`) and any trailing/aggregate columns (`AE`).
- Sheet name → `startDate` (pre-fills `config.json`, editable later).

## API

| Method | Route | Description |
|---|---|---|
| `POST` | `/planning` | Multipart `.xlsx` upload. Parse → write `planning.json` + keep `planning.xlsx`. Read sheet name → pre-fill `startDate` in `config.json`. 400 if not a valid `.xlsx` or no `S1`..`S6` block found. |
| `GET` | `/planning` | Returns `{ startDate, people }` (names + roles + colors). 404 if no planning uploaded. |
| `GET` | `/planning/schedule?month=YYYY-MM` | Returns the full month schedule for all people (date→week resolved via rotation). 404 if no planning uploaded; 400 if `month` malformed. |
| `GET` | `/planning/config` | Returns `{ startDate, defaultName }`. |
| `PUT` | `/planning/config` | Updates `startDate` and/or `defaultName` in the flat file. |

Responses:
- `schedule` → `{ month, days: { "YYYY-MM-DD": PersonDay[] } }` where `PersonDay = { name, colorIndex, cell: DayCell }`.
- Errors are standardized as `{ statusCode, message }`.
- Month arithmetic is done in UTC; no timezone concerns.
- Routes are structured so a future OIDC guard can protect them.

## Frontend

One page only.

- **Header**: title; multi-select dropdown of people (checkboxes; no pre-selection); month navigation (previous/next; current month by default); "Import" upload button/zone; "Settings" button (modal).
- **Body**: monthly grid (7 columns × 5-6 rows). Each day cell stacks the selected people, in selection order:
  - shift: time range(s) such as `09:00 – 13:00` and `13:30 – 17:30`, with a dot/badge in the person's color.
  - off: colored badge with the cell text (e.g. `rh`) in the person's color.
  - none: empty.
- **Legend**: selected people with their color swatch.

### Redux constraints (non-negotiable)

- Tailwind CSS.
- Redux with custom middlewares and plain classic reducers — no Redux Thunk, no slices, no `createReducer`.
- Custom middleware for API calls (request/success/failure pattern).
- State slices: `planning` (startDate, people, status), `schedule` (displayed month + month data), `selection` (selected names), `config` (editable startDate, defaultName), `colors` (palette + per-person colorIndex).

### Config modal

- Editable `startDate` (pre-filled from the Excel, correctable) and `defaultName`.
- Changes are persisted via `PUT /planning/config`; the calendar re-resolves the rotation without re-uploading.

## Error handling

- Upload: non-`.xlsx`/unreadable file → 400 with a clear message. No `S1`..`S6` block → 400 "unrecognized planning format".
- Unreadable time cells (neither time, nor `rh`, nor empty) → tolerated as `none`, collected as warnings returned to the front and displayed discreetly, without blocking loading.
- `GET /schedule` with no uploaded file → 404.
- Malformed `month` → 400.

## Testing

- **API e2e**: upload a reference `.xlsx` reproducing the real structure → verify normalized JSON; date→week rotation (S1..S6, cycle, dates before startDate); GET/PUT config.
- **Parsing unit tests**: `rh`/`RH`, typo `18;30`, 1- or 2-slot days, TOTAL ignored, `Feuil1` ignored.
- **Front** (vitest + testing-library): reducers (request/success/failure), API middleware, calendar component (day rendering, color swatches, `rh` badge, month navigation, multi-select), config modal.
- Lint + typecheck on both packages.

## Open items

None. All decisions recorded above.
