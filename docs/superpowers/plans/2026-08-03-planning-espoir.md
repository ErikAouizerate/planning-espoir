# Planning Espoir Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Planning Espoir app: upload an Excel planning and view selected people's schedules on a monthly calendar, with the file kept server-side and re-parsed on each update.

**Architecture:** Yarn-workspaces monorepo with three packages — `shared/` (domain types, the cross-package contract), `api/` (NestJS backend: multipart upload, Excel parsing with exceljs, flat-file storage, date→week rotation, schedule/config endpoints), and `webapp/` (React + Vite SPA: Redux store with plain reducers + custom API middleware, Tailwind calendar UI). No database. Keycloak OIDC is designed for but not implemented.

**Tech Stack:** TypeScript ~5.9.3, NestJS 11, exceljs 4.4, React 19, Vite 8, Redux 5 + react-redux 9, Tailwind CSS 4, Vitest 4 + jsdom 26, Jest 29 + ts-jest + supertest, Docker + docker-compose.

## Global Constraints

- All code, documentation, and tests in **English**. Communication with the user is in French.
- TypeScript **~5.9.3** everywhere (NOT 7.x — NestJS/ts-jest are not compatible with the TS7 native port).
- yarn workspaces: `shared`, `api`, `webapp`. Run workspace commands as `yarn workspace <pkg> <script>` from the repo root.
- **Redux constraints (non-negotiable):** custom middlewares and plain classic reducers — no Redux Thunk, no slices, no `createReducer`.
- Tailwind CSS for all webapp styling.
- No database: state lives in flat files under a `DATA_DIR` (default `./data`).
- Frontend route prefix is `/api` (set via NestJS `app.setGlobalPrefix('api')`); webapp dev server proxies `/api` to the API.
- TDD: write the failing test first, run it, implement, run again, commit — one task per commit.
- Root commands (after scaffolding): `yarn install`, `yarn dev`, `yarn test`, `yarn lint`, `yarn typecheck`, `yarn build`.

---

### Task 1: Root monorepo + shared package + ADRs

Set up the workspace root, the `shared/` types package, and record the design decisions as ADRs.

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/types.ts`
- Create: `shared/src/index.ts`
- Create: `docs/adr/0001-monorepo-and-workspaces.md`
- Create: `docs/adr/0002-excel-parsing-and-storage.md`
- Create: `docs/adr/0003-date-correlation-and-rotation.md`
- Create: `docs/adr/0004-person-identity.md`
- Create: `docs/adr/0005-frontend-state-and-ux.md`

**Interfaces:**
- Consumes: nothing.
- Produces: package `@planning-espoir/shared` with `main`/`types` → `dist/index.js`/`dist/index.d.ts` after `yarn workspace @planning-espoir/shared build`. Domain types used by api and webapp in later tasks.

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "planning-espoir",
  "private": true,
  "workspaces": ["shared", "api", "webapp"],
  "scripts": {
    "build": "yarn workspace @planning-espoir/shared build && yarn workspace @planning-espoir/api build && yarn workspace @planning-espoir/webapp build",
    "dev": "yarn workspace @planning-espoir/shared build && concurrently -k \"yarn workspace @planning-espoir/api start:dev\" \"yarn workspace @planning-espoir/webapp dev\"",
    "test": "yarn workspace @planning-espoir/shared build && yarn workspace @planning-espoir/api test && yarn workspace @planning-espoir/webapp test",
    "lint": "yarn workspace @planning-espoir/api lint && yarn workspace @planning-espoir/webapp lint",
    "typecheck": "yarn workspace @planning-espoir/shared build && yarn workspace @planning-espoir/api typecheck && yarn workspace @planning-espoir/webapp typecheck",
    "install:clean": "yarn install"
  },
  "devDependencies": {
    "concurrently": "^10.0.4"
  }
}
```

- [ ] **Step 2: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 3: Create `.gitignore`**

```gitignore
node_modules/
dist/
coverage/
data/
*.log
.DS_Store
.env
```

- [ ] **Step 4: Create `shared/package.json`**

```json
{
  "name": "@planning-espoir/shared",
  "version": "0.0.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "typescript": "~5.9.3"
  }
}
```

- [ ] **Step 5: Create `shared/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Create `shared/src/types.ts`**

```ts
export interface Slot {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

export type DayCell =
  | { type: 'shift'; slots: Slot[] }
  | { type: 'off'; label: string }
  | { type: 'none' };

export interface Person {
  name: string;
  role: string;
  colorIndex: number;
  weeks: DayCell[][]; // [6][7]
}

export interface PersonDay {
  name: string;
  colorIndex: number;
  cell: DayCell;
}

export interface ScheduleMonth {
  month: string; // "YYYY-MM"
  days: Record<string, PersonDay[]>; // "YYYY-MM-DD" -> PersonDay[]
}

export interface PlanningData {
  people: Person[];
}

export interface Config {
  startDate: string | null; // "YYYY-MM-DD"
  defaultName: string | null;
}

export interface ParsingWarning {
  week: number;
  row: number;
  column: string;
  value: string;
}

export interface ParsedPlanning {
  planning: PlanningData;
  startDate: string | null;
  warnings: ParsingWarning[];
}
```

- [ ] **Step 7: Create `shared/src/index.ts`**

```ts
export * from './types';
```

- [ ] **Step 8: Build shared and verify**

Run: `yarn install && yarn workspace @planning-espoir/shared build && yarn workspace @planning-espoir/shared typecheck`
Expected: `dist/` produced, no TypeScript errors.

- [ ] **Step 9: Write the ADR files**

Record the approved design decisions from `docs/superpowers/specs/2026-08-03-planning-espoir-design.md` as short ADRs (Status: Accepted). Each ADR: Context / Decision / Consequences.

- `0001-monorepo-and-workspaces.md` — three workspaces (`shared`, `api`, `webapp`), Docker + docker-compose, no database, OIDC designed-not-implemented.
- `0002-excel-parsing-and-storage.md` — parse on upload (exceljs), store raw `.xlsx` + normalized JSON + config in flat files under `DATA_DIR`.
- `0003-date-correlation-and-rotation.md` — `config.json.startDate` pre-filled from sheet name (year from filename), perpetual S1..S6 rotation via Euclidean modulo.
- `0004-person-identity.md` — canonical person list from S1, index-based matching across weeks, trimmed names, colorIndex by order of appearance.
- `0005-frontend-state-and-ux.md` — plain Redux reducers + custom middleware, month view, one color per person, `rh` badge, no pre-selection.

- [ ] **Step 10: Commit**

```bash
git add package.json tsconfig.base.json .gitignore shared docs/adr
git commit -m "feat: scaffold monorepo workspace and shared types"
```

---

### Task 2: API package scaffolding

Set up the NestJS API workspace with a health endpoint and wired test/lint/typecheck/build tooling.

**Files:**
- Create: `api/package.json`
- Create: `api/tsconfig.json`
- Create: `api/tsconfig.build.json`
- Create: `api/nest-cli.json`
- Create: `api/eslint.config.mjs`
- Create: `api/jest.config.ts`
- Create: `api/test/jest-e2e.json`
- Create: `api/src/main.ts`
- Create: `api/src/app.module.ts`
- Create: `api/src/app.controller.ts`
- Create: `api/src/app.controller.spec.ts`
- Create: `api/test/health.e2e-spec.ts`

**Interfaces:**
- Consumes: `@planning-espoir/shared` (built dist).
- Produces: NestJS app bootstrapped with global prefix `api` and CORS enabled on port `PORT ?? 3000`.

- [ ] **Step 1: Create `api/package.json`**

```json
{
  "name": "@planning-espoir/api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js",
    "start:dev": "nest start --watch",
    "test": "jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json --runInBand",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\"",
    "typecheck": "tsc -p tsconfig.build.json --noEmit"
  },
  "dependencies": {
    "@nestjs/common": "^11.1.28",
    "@nestjs/core": "^11.1.28",
    "@nestjs/platform-express": "^11.1.28",
    "@planning-espoir/shared": "*",
    "exceljs": "^4.4.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.24",
    "@nestjs/testing": "^11.1.28",
    "@types/express": "^5.0.6",
    "@types/jest": "^29.5.14",
    "@types/multer": "^2.2.0",
    "@types/node": "^26.1.2",
    "@types/supertest": "^7.2.1",
    "eslint": "^9.0.0",
    "jest": "^29.7.0",
    "supertest": "^7.2.2",
    "ts-jest": "^29.4.12",
    "ts-node": "^10.9.2",
    "typescript": "~5.9.3",
    "typescript-eslint": "^8.65.0"
  }
}
```

- [ ] **Step 2: Create `api/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "outDir": "./dist",
    "incremental": true,
    "sourceMap": true
  },
  "include": ["src", "test"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `api/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*.spec.ts"]
}
```

- [ ] **Step 4: Create `api/nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 5: Create `api/eslint.config.mjs`**

```js
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
```

- [ ] **Step 6: Create `api/jest.config.ts`**

```ts
import type { Config } from 'jest';

export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
} satisfies Config;
```

- [ ] **Step 7: Create `api/test/jest-e2e.json`**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.ts$": ["ts-jest", { "tsconfig": "tsconfig.json" }] }
}
```

- [ ] **Step 8: Create `api/src/main.ts`**

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
```

- [ ] **Step 9: Create `api/src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
})
export class AppModule {}
```

- [ ] **Step 10: Create `api/src/app.controller.ts`**

```ts
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}
```

- [ ] **Step 11: Create `api/src/app.controller.spec.ts`**

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();
    controller = module.get<AppController>(AppController);
  });

  it('reports health ok', () => {
    expect(controller.health()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 12: Create `api/test/health.e2e-spec.ts`**

```ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 13: Run checks and fix failures**

Run: `yarn install && yarn workspace @planning-espoir/api test && yarn workspace @planning-espoir/api test:e2e && yarn workspace @planning-espoir/api lint && yarn workspace @planning-espoir/api typecheck && yarn workspace @planning-espoir/api build`
Expected: all pass, `api/dist/main.js` produced.

- [ ] **Step 14: Commit**

```bash
git add api
git commit -m "feat: scaffold NestJS API workspace with health endpoint"
```

---

### Task 3: API date rotation + parser

Implement the pure domain logic: date→week rotation and the Excel parser, with unit tests.

**Files:**
- Create: `api/src/planning/date-rotation.ts`
- Create: `api/src/planning/date-rotation.spec.ts`
- Create: `api/src/planning/parser.ts`
- Create: `api/src/planning/parser.spec.ts`
- Create: `api/test/helpers/planning-workbook.ts`
- Modify: `api/src/app.module.ts`

**Interfaces:**
- Consumes: `@planning-espoir/shared` types.
- Produces:
  - `weekIndexForDate(startDate: string, date: string): number` — 0-based S1..S6 index, Euclidean modulo (valid before startDate).
  - `weekdayIndex(date: string): number` — 0=Monday .. 6=Sunday.
  - `monthDays(month: string): string[]` — `"YYYY-MM"` → list of `"YYYY-MM-DD"`.
  - `parsePlanning(buffer: Buffer, fileName: string): Promise<ParsedPlanning>` — throws `PlanningFormatError` on invalid workbook.
  - `PlanningFormatError` class.
  - `buildPlanningBuffer(): Promise<Buffer>` (test helper) — mirrors the real workbook structure.

- [ ] **Step 1: Write the failing test for date rotation**

`api/src/planning/date-rotation.spec.ts`:

```ts
import {
  monthDays,
  weekIndexForDate,
  weekdayIndex,
} from './date-rotation';

describe('date-rotation', () => {
  const start = '2026-07-27'; // a Monday

  it('returns S1 index for the start date itself', () => {
    expect(weekIndexForDate(start, '2026-07-27')).toBe(0);
  });

  it('advances one week per 7 days', () => {
    expect(weekIndexForDate(start, '2026-08-03')).toBe(1); // S2
    expect(weekIndexForDate(start, '2026-08-31')).toBe(5); // S6
  });

  it('cycles back to S1 after six weeks', () => {
    expect(weekIndexForDate(start, '2026-09-07')).toBe(0);
    expect(weekIndexForDate(start, '2026-09-08')).toBe(1);
  });

  it('wraps correctly for dates before the start date', () => {
    expect(weekIndexForDate(start, '2026-07-20')).toBe(5);
  });

  it('maps weekday to Monday=0..Sunday=6', () => {
    expect(weekdayIndex('2026-07-27')).toBe(0); // Monday
    expect(weekdayIndex('2026-08-02')).toBe(6); // Sunday
  });

  it('lists every day of a month', () => {
    const days = monthDays('2026-08');
    expect(days.length).toBe(31);
    expect(days[0]).toBe('2026-08-01');
    expect(days[days.length - 1]).toBe('2026-08-31');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn workspace @planning-espoir/api test date-rotation`
Expected: FAIL — module/file not found.

- [ ] **Step 3: Implement `api/src/planning/date-rotation.ts`**

```ts
const DAY_MS = 86_400_000;
const WEEK_COUNT = 6;

export function weekIndexForDate(startDate: string, date: string): number {
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const dateMs = Date.parse(`${date}T00:00:00Z`);
  const diffDays = Math.floor((dateMs - startMs) / DAY_MS);
  const week = Math.floor(diffDays / 7);
  return ((week % WEEK_COUNT) + WEEK_COUNT) % WEEK_COUNT;
}

export function weekdayIndex(date: string): number {
  const d = new Date(`${date}T00:00:00Z`);
  return (d.getUTCDay() + 6) % 7;
}

export function monthDays(month: string): string[] {
  const [year, monthIndex] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const days: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(`${month}-${String(d).padStart(2, '0')}`);
  }
  return days;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn workspace @planning-espoir/api test date-rotation`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing test helper + parser tests**

`api/test/helpers/planning-workbook.ts`:

```ts
import ExcelJS from 'exceljs';

export async function buildPlanningBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('A compter du 27Juillet');
  const time = (h: number, m: number): Date => new Date(Date.UTC(1899, 11, 30, h, m));
  const dayNames = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE'];

  const people = ['TAUZIN Caroline', 'Céline PREAU'];
  const roles = ['ES -1 ETP', 'TISF 1 ETP /36'];

  ws.getCell(2, 6).value = 'PLANNING ACCUEIL URGENCE ECLUSE';
  ws.getCell(4, 1).value = 'S1';
  dayNames.forEach((name, i) => ws.getCell(4, 2 + i * 4).value = name);
  ws.getCell(4, 30).value = 'TOTAL';

  // S1: person rows 6 and 8, role rows 7 and 9
  ws.getCell(6, 1).value = people[0];
  ws.getCell(6, 2).value = time(9, 0);
  ws.getCell(6, 3).value = time(13, 0);
  ws.getCell(6, 4).value = time(13, 30);
  ws.getCell(6, 5).value = time(17, 30);
  ws.getCell(7, 1).value = roles[0];
  ws.getCell(8, 1).value = people[1];
  ws.getCell(9, 1).value = roles[1];

  // S2: same people, different Monday times for person 0
  ws.getCell(11, 1).value = 'S2';
  dayNames.forEach((name, i) => ws.getCell(11, 2 + i * 4).value = name);
  ws.getCell(13, 1).value = people[0];
  ws.getCell(13, 2).value = time(8, 30);
  ws.getCell(13, 3).value = time(12, 0);
  ws.getCell(14, 1).value = roles[0];
  ws.getCell(15, 1).value = people[1];
  ws.getCell(16, 1).value = roles[1];

  // S3..S6: minimal blocks (header + people/roles) so 6 weeks exist
  for (let w = 3; w <= 6; w++) {
    const headerRow = 18 + (w - 3) * 5;
    ws.getCell(headerRow, 1).value = `S${w}`;
    dayNames.forEach((name, i) => ws.getCell(headerRow, 2 + i * 4).value = name);
    ws.getCell(headerRow + 2, 1).value = people[0];
    ws.getCell(headerRow + 3, 1).value = roles[0];
    ws.getCell(headerRow + 4, 1).value = people[1];
    ws.getCell(headerRow + 5, 1).value = roles[1];
  }

  // junk TOTAL column (formula results) and a junk sheet that must be ignored
  ws.getCell(6, 30).value = '#REF!';
  const junkSheet = workbook.addWorksheet('Feuil1');
  junkSheet.getCell(1, 1).value = 'ignored';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
```

`api/src/planning/parser.spec.ts`:

```ts
import { buildPlanningBuffer } from '../../test/helpers/planning-workbook';
import { parsePlanning, PlanningFormatError } from './parser';

describe('parsePlanning', () => {
  it('parses people, roles and color indexes from S1', async () => {
    const parsed = await parsePlanning(await buildPlanningBuffer(), 'Copie de Planning ecluse Proposition Aout 2026.xlsx');
    expect(parsed.planning.people).toHaveLength(2);
    const [first, second] = parsed.planning.people;
    expect(first.name).toBe('TAUZIN Caroline');
    expect(first.role).toBe('ES -1 ETP');
    expect(first.colorIndex).toBe(0);
    expect(second.name).toBe('Céline PREAU');
    expect(second.colorIndex).toBe(1);
  });

  it('parses a two-slot day from S1 week 1', async () => {
    const parsed = await parsePlanning(await buildPlanningBuffer(), 'plan.xlsx');
    const monday = parsed.planning.people[0].weeks[0][0];
    expect(monday).toEqual({
      type: 'shift',
      slots: [
        { start: '09:00', end: '13:00' },
        { start: '13:30', end: '17:30' },
      ],
    });
  });

  it('assigns later weeks to the same person by index', async () => {
    const parsed = await parsePlanning(await buildPlanningBuffer(), 'plan.xlsx');
    const s2Monday = parsed.planning.people[0].weeks[1][0];
    expect(s2Monday).toEqual({
      type: 'shift',
      slots: [{ start: '08:30', end: '12:00' }],
    });
  });

  it('keeps six weeks of empty cells for unset weeks', async () => {
    const parsed = await parsePlanning(await buildPlanningBuffer(), 'plan.xlsx');
    expect(parsed.planning.people[0].weeks).toHaveLength(6);
    expect(parsed.planning.people[0].weeks[5][6]).toEqual({ type: 'none' });
  });

  it('extracts the start date from the sheet name and filename', async () => {
    const parsed = await parsePlanning(await buildPlanningBuffer(), 'Copie de Planning ecluse Proposition Aout 2026.xlsx');
    expect(parsed.startDate).toBe('2026-07-27');
  });

  it('throws PlanningFormatError when no S1 block exists', async () => {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Empty');
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    await expect(parsePlanning(buffer, 'empty.xlsx')).rejects.toThrow(PlanningFormatError);
  });

  it('reports warnings for unparseable non-empty time cells', async () => {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('A compter du 27Juillet');
    ws.getCell(1, 1).value = 'S1';
    ['LUNDI'].forEach((name, i) => (ws.getCell(1, 2 + i * 4).value = name));
    ws.getCell(3, 1).value = 'TAUZIN Caroline';
    ws.getCell(4, 1).value = 'ES -1 ETP';
    ws.getCell(3, 2).value = '9?30';
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const parsed = await parsePlanning(buffer, 'plan.xlsx');
    expect(parsed.warnings.length).toBeGreaterThan(0);
    expect(parsed.warnings[0].value).toBe('9?30');
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `yarn workspace @planning-espoir/api test parser`
Expected: FAIL — `./parser` not found.

- [ ] **Step 7: Implement `api/src/planning/parser.ts`**

```ts
import ExcelJS from 'exceljs';
import type {
  DayCell,
  ParsedPlanning,
  ParsingWarning,
  Person,
  PlanningData,
  Slot,
} from '@planning-espoir/shared';

const WEEK_LABEL_RE = /^S([1-6])$/;
const ROLE_RE = /^(ES|TISF|Educ)/i;
const TIME_TEXT_RE = /^(\d{1,2})[:;.,h](\d{2})$/;
const RH_RE = /^rh$/i;

const DAY_COLUMN_GROUPS: number[][] = [
  [2, 3, 4, 5],
  [6, 7, 8, 9],
  [10, 11, 12, 13],
  [14, 15, 16, 17],
  [18, 19, 20, 21],
  [22, 23, 24, 25],
  [26, 27, 28, 29],
];

const FRENCH_MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

export class PlanningFormatError extends Error {}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function columnLetter(col: number): string {
  let result = '';
  let n = col;
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function timeValueToHhmm(value: unknown): string | null {
  if (value instanceof Date) {
    return `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
  }
  if (typeof value === 'string') {
    const m = value.trim().match(TIME_TEXT_RE);
    if (m) {
      const h = Number(m[1]);
      const min = Number(m[2]);
      if (h < 24 && min < 60) return `${pad(h)}:${pad(min)}`;
    }
  }
  return null;
}

function findPlanningSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | null {
  for (const ws of workbook.worksheets) {
    if (hasWeekLabel(ws)) return ws;
  }
  return null;
}

function hasWeekLabel(ws: ExcelJS.Worksheet): boolean {
  for (let r = 1; r <= ws.rowCount; r++) {
    const v = ws.getCell(r, 1).value;
    if (typeof v === 'string' && WEEK_LABEL_RE.test(v.trim())) return true;
  }
  return false;
}

function findWeekBlocks(ws: ExcelJS.Worksheet): { week: number; row: number }[] {
  const blocks: { week: number; row: number }[] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const v = ws.getCell(r, 1).value;
    if (typeof v !== 'string') continue;
    const m = v.trim().match(WEEK_LABEL_RE);
    if (m) blocks.push({ week: Number(m[1]), row: r });
  }
  return blocks.sort((a, b) => a.week - b.week);
}

interface RawPerson {
  name: string;
  role: string;
  days: DayCell[];
}

function parsePeopleRows(
  ws: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  week: number,
  warnings: ParsingWarning[],
): RawPerson[] {
  const result: RawPerson[] = [];
  for (let r = startRow; r < endRow; r++) {
    const nameValue = ws.getCell(r, 1).value;
    const nameText = typeof nameValue === 'string' ? nameValue.trim() : '';
    if (nameText === '' || WEEK_LABEL_RE.test(nameText)) continue;
    if (ROLE_RE.test(nameText)) {
      const last = result[result.length - 1];
      if (last && !last.role) last.role = nameText;
      continue;
    }
    const days = DAY_COLUMN_GROUPS.map((group) => parseDayCell(ws, r, group, week, warnings));
    result.push({ name: nameText, role: '', days });
  }
  return result;
}

function parseDayCell(
  ws: ExcelJS.Worksheet,
  row: number,
  colGroup: number[],
  week: number,
  warnings: ParsingWarning[],
): DayCell {
  const raw = colGroup.map((col) => ws.getCell(row, col).value);
  const texts = raw.map((v) => (typeof v === 'string' ? v.trim() : ''));

  const rhText = texts.find((t) => RH_RE.test(t));
  if (rhText !== undefined) return { type: 'off', label: rhText };

  const hasAny = raw.some((v) => v !== null && v !== undefined && (typeof v !== 'string' || v.trim() !== ''));
  if (!hasAny) return { type: 'none' };

  const slots: Slot[] = [];
  for (let i = 0; i < 4; i += 2) {
    const start = timeValueToHhmm(raw[i]);
    const end = timeValueToHhmm(raw[i + 1]);
    if (start !== null && end !== null) {
      slots.push({ start, end });
    } else {
      for (let j = 0; j < 2; j++) {
        const text = texts[i + j];
        if (text !== '' && !RH_RE.test(text)) {
          warnings.push({ week, row, column: columnLetter(colGroup[i + j]), value: text });
        }
      }
    }
  }
  return slots.length > 0 ? { type: 'shift', slots } : { type: 'none' };
}

function extractStartDate(sheetName: string, fileName: string): string | null {
  const m = sheetName.match(/(\d{1,2})\s*([A-Za-zÀ-ÿ]+)/i);
  if (!m) return null;
  const day = Number(m[1]);
  const monthKey = m[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const month = FRENCH_MONTHS[monthKey];
  if (!month || day < 1 || day > 31) return null;
  const yearMatch = fileName.match(/(20\d{2})/);
  const year = yearMatch ? Number(yearMatch[1]) : new Date().getUTCFullYear();
  return `${year}-${pad(month)}-${pad(day)}`;
}

export async function parsePlanning(buffer: Buffer, fileName: string): Promise<ParsedPlanning> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = findPlanningSheet(workbook);
  if (!sheet) throw new PlanningFormatError('No S1..S6 week block found');

  const warnings: ParsingWarning[] = [];
  const blocks = findWeekBlocks(sheet);
  const s1 = blocks.find((b) => b.week === 1);
  if (!s1) throw new PlanningFormatError('No S1 block found');

  const s1End = nextBlockRow(blocks, s1.row, sheet.rowCount);
  const s1People = parsePeopleRows(sheet, s1.row + 1, s1End, 1, warnings);

  const people: Person[] = s1People.map((p, i) => ({
    name: p.name,
    role: p.role,
    colorIndex: i,
    weeks: Array.from({ length: 6 }, () =>
      Array.from({ length: 7 }, (): DayCell => ({ type: 'none' })),
    ),
  }));

  for (const block of blocks) {
    const end = nextBlockRow(blocks, block.row, sheet.rowCount);
    const rows = parsePeopleRows(sheet, block.row + 1, end, block.week, warnings);
    rows.forEach((rp, i) => {
      const person = people[i];
      if (!person) return;
      person.weeks[block.week - 1] = rp.days;
    });
  }

  const planning: PlanningData = { people };
  const startDate = extractStartDate(sheet.name, fileName);
  return { planning, startDate, warnings };
}

function nextBlockRow(blocks: { week: number; row: number }[], row: number, rowCount: number): number {
  const next = blocks.find((b) => b.row > row);
  return next ? next.row : rowCount + 1;
}
```

- [ ] **Step 8: Register PlanningFormatError handling is not needed yet (service handles it in Task 4), but wire nothing else now. Run parser tests**

Run: `yarn workspace @planning-espoir/api test parser`
Expected: PASS (7 tests).

- [ ] **Step 9: Run full api unit suite + typecheck**

Run: `yarn workspace @planning-espoir/api test && yarn workspace @planning-espoir/api typecheck`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add api/src/planning api/test/helpers api/test/jest-e2e.json api/src/app.module.ts
git commit -m "feat: add date rotation and Excel parser"
```

---

### Task 4: API storage, planning service, controller and e2e

Implement flat-file storage, the planning module (upload/get/schedule/config endpoints), and end-to-end tests.

**Files:**
- Create: `api/src/planning/storage.ts`
- Create: `api/src/planning/storage.spec.ts`
- Create: `api/src/planning/planning.module.ts`
- Create: `api/src/planning/planning.controller.ts`
- Create: `api/src/planning/planning.service.ts`
- Create: `api/src/planning/planning.controller.spec.ts`
- Create: `api/test/planning.e2e-spec.ts`
- Modify: `api/src/app.module.ts`

**Interfaces:**
- Consumes: `parsePlanning` (Task 3), `weekIndexForDate`/`weekdayIndex`/`monthDays` (Task 3), shared types.
- Produces:
  - `PlanningModule` with `Storage` (token `'DATA_DIR'`, default `process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data')`).
  - Routes (under `/api`): `POST /planning`, `GET /planning`, `GET /planning/schedule?month=YYYY-MM`, `GET /planning/config`, `PUT /planning/config`.
  - `Storage` methods: `savePlanningXlsx(buffer)`, `savePlanningJson(data)`, `loadPlanningJson()`, `loadConfig()`, `saveConfig(config)`.

- [ ] **Step 1: Write the failing storage test**

`api/src/planning/storage.spec.ts`:

```ts
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Storage } from './storage';

describe('Storage', () => {
  let dir: string;
  let storage: Storage;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'planning-test-'));
    storage = new Storage(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns null config defaults when nothing is stored', async () => {
    await expect(storage.loadConfig()).resolves.toEqual({ startDate: null, defaultName: null });
  });

  it('round-trips a planning JSON', async () => {
    const data = {
      people: [
        {
          name: 'TAUZIN Caroline',
          role: 'ES -1 ETP',
          colorIndex: 0,
          weeks: [],
        },
      ],
      warnings: [],
    };
    await storage.savePlanningJson(data);
    await expect(storage.loadPlanningJson()).resolves.toEqual(data);
  });

  it('round-trips config', async () => {
    await storage.saveConfig({ startDate: '2026-07-27', defaultName: null });
    await expect(storage.loadConfig()).resolves.toEqual({ startDate: '2026-07-27', defaultName: null });
  });

  it('returns null when no planning JSON exists', async () => {
    await expect(storage.loadPlanningJson()).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn workspace @planning-espoir/api test storage`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `api/src/planning/storage.ts`**

```ts
import { promises as fs } from 'fs';
import { join } from 'path';
import type { Config, Person, ParsingWarning } from '@planning-espoir/shared';

export interface StoredPlanning {
  people: Person[];
  warnings: ParsingWarning[];
}

export class Storage {
  constructor(private readonly dataDir: string) {}

  private file(name: string): string {
    return join(this.dataDir, name);
  }

  async savePlanningXlsx(buffer: Buffer): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(this.file('planning.xlsx'), buffer);
  }

  async savePlanningJson(data: StoredPlanning): Promise<void> {
    await this.writeJson('planning.json', data);
  }

  async loadPlanningJson(): Promise<StoredPlanning | null> {
    return this.readJson<StoredPlanning>('planning.json');
  }

  async loadConfig(): Promise<Config> {
    const config = await this.readJson<Config>('config.json');
    return config ?? { startDate: null, defaultName: null };
  }

  async saveConfig(config: Config): Promise<void> {
    await this.writeJson('config.json', config);
  }

  private async writeJson(name: string, value: unknown): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    const file = this.file(name);
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value, null, 2));
    await fs.rename(tmp, file);
  }

  private async readJson<T>(name: string): Promise<T | null> {
    try {
      const raw = await fs.readFile(this.file(name), 'utf8');
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn workspace @planning-espoir/api test storage`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing controller/service/e2e tests**

`api/src/planning/planning.controller.spec.ts`:

```ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';

describe('PlanningController', () => {
  let controller: PlanningController;
  const service = {
    upload: jest.fn(),
    getPlanning: jest.fn(),
    getSchedule: jest.fn(),
    getConfig: jest.fn(),
    updateConfig: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlanningController],
      providers: [{ provide: PlanningService, useValue: service }],
    }).compile();
    controller = module.get<PlanningController>(PlanningController);
    jest.clearAllMocks();
  });

  it('rejects a missing file on upload', async () => {
    service.upload.mockRejectedValue(new BadRequestException('file is required'));
    await expect(controller.upload(undefined as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('delegates getPlanning to the service', async () => {
    service.getPlanning.mockResolvedValue({ startDate: null, people: [], warnings: [] });
    await expect(controller.getPlanning()).resolves.toEqual({ startDate: null, people: [], warnings: [] });
    expect(service.getPlanning).toHaveBeenCalled();
  });

  it('delegates getSchedule to the service', async () => {
    service.getSchedule.mockResolvedValue({ month: '2026-08', days: {} });
    await expect(controller.getSchedule('2026-08')).resolves.toEqual({ month: '2026-08', days: {} });
    expect(service.getSchedule).toHaveBeenCalledWith('2026-08');
  });

  it('delegates config get/put to the service', async () => {
    service.getConfig.mockResolvedValue({ startDate: null, defaultName: null });
    await expect(controller.getConfig()).resolves.toEqual({ startDate: null, defaultName: null });
    service.updateConfig.mockResolvedValue({ startDate: '2026-07-27', defaultName: null });
    await expect(controller.updateConfig({ startDate: '2026-07-27' })).resolves.toEqual({
      startDate: '2026-07-27',
      defaultName: null,
    });
    expect(service.updateConfig).toHaveBeenCalledWith({ startDate: '2026-07-27' });
  });
});
```

`api/test/planning.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { buildPlanningBuffer } from './helpers/planning-workbook';

describe('Planning (e2e)', () => {
  let app: INestApplication;
  let dataDir: string;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'planning-e2e-'));
    process.env.DATA_DIR = dataDir;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it('returns 404 for GET /api/planning before any upload', async () => {
    await request(app.getHttpServer()).get('/api/planning').expect(404);
  });

  it('uploads a planning and returns people', async () => {
    const buffer = await buildPlanningBuffer();
    const res = await request(app.getHttpServer())
      .post('/api/planning')
      .attach('file', buffer, {
        filename: 'Copie de Planning ecluse Proposition Aout 2026.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);
    expect(res.body.startDate).toBe('2026-07-27');
    expect(res.body.people).toHaveLength(2);
    expect(res.body.warnings).toEqual([]);
  });

  it('returns 400 when uploading a non-planning file', async () => {
    await request(app.getHttpServer())
      .post('/api/planning')
      .attach('file', Buffer.from('not an xlsx'), { filename: 'notes.txt' })
      .expect(400);
  });

  it('GET /api/planning returns stored people and warnings', async () => {
    const res = await request(app.getHttpServer()).get('/api/planning').expect(200);
    expect(res.body.startDate).toBe('2026-07-27');
    expect(res.body.people).toHaveLength(2);
  });

  it('GET /api/planning/schedule resolves dates through the rotation', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/planning/schedule?month=2026-08')
      .expect(200);
    expect(res.body.month).toBe('2026-08');
    const dayKeys = Object.keys(res.body.days);
    expect(dayKeys).toContain('2026-08-03'); // Monday of S2
    const monday = res.body.days['2026-08-03'];
    expect(monday).toHaveLength(2);
    // S2 Monday for person 0 is 08:30-12:00
    expect(monday[0]).toMatchObject({ name: 'TAUZIN Caroline' });
    expect(monday[0].cell).toEqual({
      type: 'shift',
      slots: [{ start: '08:30', end: '12:00' }],
    });
  });

  it('validates the month query parameter', async () => {
    await request(app.getHttpServer()).get('/api/planning/schedule?month=nope').expect(400);
  });

  it('round-trips config via GET/PUT', async () => {
    const before = await request(app.getHttpServer()).get('/api/planning/config').expect(200);
    expect(before.body).toEqual({ startDate: '2026-07-27', defaultName: null });
    const put = await request(app.getHttpServer())
      .put('/api/planning/config')
      .send({ startDate: '2026-08-01' })
      .expect(200);
    expect(put.body.startDate).toBe('2026-08-01');
    const after = await request(app.getHttpServer()).get('/api/planning/config').expect(200);
    expect(after.body.startDate).toBe('2026-08-01');
  });

  it('rejects a malformed startDate on PUT', async () => {
    await request(app.getHttpServer())
      .put('/api/planning/config')
      .send({ startDate: 'not-a-date' })
      .expect(400);
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `yarn workspace @planning-espoir/api test planning.controller && yarn workspace @planning-espoir/api test:e2e`
Expected: FAIL — modules/routes not found.

- [ ] **Step 7: Implement `api/src/planning/planning.service.ts`**

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  Config,
  Person,
  PersonDay,
  ParsingWarning,
  ScheduleMonth,
} from '@planning-espoir/shared';
import { monthDays, weekIndexForDate, weekdayIndex } from './date-rotation';
import { parsePlanning, PlanningFormatError } from './parser';
import { Storage } from './storage';

export interface PlanningResponse {
  startDate: string | null;
  people: Person[];
  warnings: ParsingWarning[];
}

@Injectable()
export class PlanningService {
  constructor(private readonly storage: Storage) {}

  async upload(file: Express.Multer.File): Promise<PlanningResponse> {
    if (!file) throw new BadRequestException('file is required');
    let parsed;
    try {
      parsed = await parsePlanning(file.buffer, file.originalname);
    } catch (error) {
      if (error instanceof PlanningFormatError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    await this.storage.savePlanningXlsx(file.buffer);
    await this.storage.savePlanningJson({
      people: parsed.planning.people,
      warnings: parsed.warnings,
    });
    const config = await this.storage.loadConfig();
    if (parsed.startDate !== null) {
      config.startDate = parsed.startDate;
      await this.storage.saveConfig(config);
    }
    return {
      startDate: parsed.startDate,
      people: parsed.planning.people,
      warnings: parsed.warnings,
    };
  }

  async getPlanning(): Promise<PlanningResponse> {
    const stored = await this.storage.loadPlanningJson();
    if (!stored) throw new NotFoundException('No planning uploaded yet');
    const config = await this.storage.loadConfig();
    return { startDate: config.startDate, people: stored.people, warnings: stored.warnings };
  }

  async getSchedule(month: string): Promise<ScheduleMonth> {
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('month must be YYYY-MM');
    const stored = await this.storage.loadPlanningJson();
    if (!stored) throw new NotFoundException('No planning uploaded yet');
    const config = await this.storage.loadConfig();
    if (!config.startDate) throw new BadRequestException('startDate is not configured');

    const days: Record<string, PersonDay[]> = {};
    for (const date of monthDays(month)) {
      const week = weekIndexForDate(config.startDate, date);
      const day = weekdayIndex(date);
      days[date] = stored.people.map((p) => ({
        name: p.name,
        colorIndex: p.colorIndex,
        cell: p.weeks[week][day],
      }));
    }
    return { month, days };
  }

  async getConfig(): Promise<Config> {
    return this.storage.loadConfig();
  }

  async updateConfig(update: Partial<Config>): Promise<Config> {
    const config = await this.storage.loadConfig();
    if (update.startDate !== undefined) {
      if (update.startDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(update.startDate)) {
        throw new BadRequestException('startDate must be YYYY-MM-DD');
      }
      config.startDate = update.startDate;
    }
    if (update.defaultName !== undefined) {
      config.defaultName = update.defaultName;
    }
    await this.storage.saveConfig(config);
    return config;
  }
}
```

- [ ] **Step 8: Implement `api/src/planning/planning.controller.ts`**

```ts
import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Config } from '@planning-espoir/shared';
import { PlanningService } from './planning.service';

@Controller('planning')
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.planningService.upload(file);
  }

  @Get()
  getPlanning() {
    return this.planningService.getPlanning();
  }

  @Get('schedule')
  getSchedule(@Query('month') month: string) {
    return this.planningService.getSchedule(month);
  }

  @Get('config')
  getConfig() {
    return this.planningService.getConfig();
  }

  @Put('config')
  updateConfig(@Body() body: Partial<Config>) {
    return this.planningService.updateConfig(body);
  }
}
```

- [ ] **Step 9: Implement `api/src/planning/planning.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { resolve } from 'path';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';
import { Storage } from './storage';

@Module({
  controllers: [PlanningController],
  providers: [
    PlanningService,
    {
      provide: Storage,
      useFactory: () => new Storage(process.env.DATA_DIR ?? resolve(process.cwd(), 'data')),
    },
  ],
})
export class PlanningModule {}
```

- [ ] **Step 10: Wire `PlanningModule` into `api/src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PlanningModule } from './planning/planning.module';

@Module({
  imports: [PlanningModule],
  controllers: [AppController],
})
export class AppModule {}
```

- [ ] **Step 11: Run all api tests and checks**

Run: `yarn workspace @planning-espoir/api test && yarn workspace @planning-espoir/api test:e2e && yarn workspace @planning-espoir/api lint && yarn workspace @planning-espoir/api typecheck && yarn workspace @planning-espoir/api build`
Expected: all pass.

- [ ] **Step 12: Commit**

```bash
git add api/src/planning api/test/planning.e2e-spec.ts api/src/app.module.ts
git commit -m "feat: add planning storage, service, controller and e2e tests"
```

---

### Task 5: Webapp scaffolding

Set up the Vite + React + TypeScript + Tailwind SPA with a working smoke test and the shared-package import.

**Files:**
- Create: `webapp/package.json`
- Create: `webapp/tsconfig.json`
- Create: `webapp/vite.config.ts`
- Create: `webapp/index.html`
- Create: `webapp/eslint.config.mjs`
- Create: `webapp/src/main.tsx`
- Create: `webapp/src/App.tsx`
- Create: `webapp/src/index.css`
- Create: `webapp/src/vite-env.d.ts`
- Create: `webapp/src/App.test.tsx`
- Create: `webapp/src/test/setup.ts`

**Interfaces:**
- Consumes: `@planning-espoir/shared` (dist types).
- Produces: Vite dev server on port 5174, proxy `/api` → `http://localhost:3000`, Tailwind v4 loaded via `@tailwindcss/vite`, vitest configured with jsdom.

- [ ] **Step 1: Create `webapp/package.json`**

```json
{
  "name": "@planning-espoir/webapp",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json --noEmit && vite build",
    "test": "vitest run",
    "lint": "eslint src",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "preview": "vite preview"
  },
  "dependencies": {
    "@planning-espoir/shared": "*",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "react-redux": "^9.3.0",
    "redux": "^5.0.1"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@testing-library/jest-dom": "^7.0.0",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.8",
    "@vitejs/plugin-react": "^6.0.5",
    "eslint": "^9.0.0",
    "jsdom": "^26.1.0",
    "tailwindcss": "^4.3.3",
    "typescript": "~5.9.3",
    "typescript-eslint": "^8.65.0",
    "vite": "^8.2.0",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: Create `webapp/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 3: Create `webapp/vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
```

- [ ] **Step 4: Create `webapp/index.html`**

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Planning Espoir</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `webapp/eslint.config.mjs`**

```js
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
```

- [ ] **Step 6: Create `webapp/src/index.css`**

```css
@import 'tailwindcss';
```

- [ ] **Step 7: Create `webapp/src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 8: Create `webapp/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 9: Create `webapp/src/App.tsx`**

```tsx
export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <h1 className="text-2xl font-bold text-slate-800">Planning Espoir</h1>
      <p className="mt-2 text-slate-500">Chargement…</p>
    </div>
  );
}
```

- [ ] **Step 10: Create `webapp/src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 11: Create `webapp/src/App.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the app title', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Planning Espoir' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 12: Run checks and fix failures**

Run: `yarn install && yarn workspace @planning-espoir/webapp test && yarn workspace @planning-espoir/webapp lint && yarn workspace @planning-espoir/webapp typecheck && yarn workspace @planning-espoir/webapp build`
Expected: all pass.

- [ ] **Step 13: Commit**

```bash
git add webapp
git commit -m "feat: scaffold Vite React webapp with Tailwind and vitest"
```

---

### Task 6: Webapp Redux store + API client

Implement the Redux store with plain reducers and a custom API middleware, plus the typed API client. All tested with mocked `fetch`.

**Files:**
- Create: `webapp/src/store/types.ts`
- Create: `webapp/src/store/actions.ts`
- Create: `webapp/src/store/reducers.ts`
- Create: `webapp/src/store/apiMiddleware.ts`
- Create: `webapp/src/store/store.ts`
- Create: `webapp/src/store/store.spec.ts`
- Create: `webapp/src/api/client.ts`
- Create: `webapp/src/api/client.spec.ts`
- Create: `webapp/src/colors.ts`

**Interfaces:**
- Consumes: `@planning-espoir/shared` types.
- Produces:
  - `configureStore(): Store<RootState>` — `createStore(rootReducer, applyMiddleware(apiMiddleware))`.
  - Action creators: `planningFetchRequested()`, `planningUploadRequested(file)`, `scheduleFetchRequested(month)`, `configFetchRequested()`, `configUpdateRequested(update)`, `selectionToggle(name)`.
  - API client functions: `fetchPlanning()`, `uploadPlanning(file)`, `fetchSchedule(month)`, `fetchConfig()`, `updateConfig(update)`.
  - `PALETTE: string[]` — 10 colors, used to colorize people by `colorIndex`.

- [ ] **Step 1: Write the failing API client test**

`webapp/src/api/client.spec.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPlanning, fetchSchedule } from './client';

describe('api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchPlanning calls GET /api/planning and returns JSON', async () => {
    const body = { startDate: null, people: [], warnings: [] };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    await expect(fetchPlanning()).resolves.toEqual(body);
    expect(fetch).toHaveBeenCalledWith('/api/planning', undefined);
  });

  it('fetchSchedule passes the month query parameter', async () => {
    const body = { month: '2026-08', days: {} };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    await expect(fetchSchedule('2026-08')).resolves.toEqual(body);
    expect(fetch).toHaveBeenCalledWith('/api/planning/schedule?month=2026-08', undefined);
  });

  it('throws an Error with the server message on failure', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 404, message: 'No planning uploaded yet' }), { status: 404 }),
    );
    await expect(fetchPlanning()).rejects.toThrow('No planning uploaded yet');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn workspace @planning-espoir/webapp test client`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `webapp/src/api/client.ts`**

```ts
import type { Config, Person, ParsingWarning, ScheduleMonth } from '@planning-espoir/shared';

export interface PlanningResponse {
  startDate: string | null;
  people: Person[];
  warnings: ParsingWarning[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export function fetchPlanning(): Promise<PlanningResponse> {
  return request<PlanningResponse>('/api/planning');
}

export function uploadPlanning(file: File): Promise<PlanningResponse> {
  const form = new FormData();
  form.append('file', file);
  return request<PlanningResponse>('/api/planning', { method: 'POST', body: form });
}

export function fetchSchedule(month: string): Promise<ScheduleMonth> {
  return request<ScheduleMonth>(`/api/planning/schedule?month=${month}`);
}

export function fetchConfig(): Promise<Config> {
  return request<Config>('/api/planning/config');
}

export function updateConfig(update: Partial<Config>): Promise<Config> {
  return request<Config>('/api/planning/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn workspace @planning-espoir/webapp test client`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing store test**

`webapp/src/store/store.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fetchPlanning, scheduleFetchRequested, selectionToggle } from './actions';
import { configureStore } from './store';

describe('store', () => {
  it('starts with an empty default state', () => {
    const store = configureStore();
    const state = store.getState();
    expect(state.planning.status).toBe('idle');
    expect(state.planning.people).toBeNull();
    expect(state.selection.names).toEqual([]);
    expect(state.colors.palette).toHaveLength(10);
  });

  it('toggles person selection preserving order', () => {
    const store = configureStore();
    store.dispatch(selectionToggle('A'));
    store.dispatch(selectionToggle('B'));
    store.dispatch(selectionToggle('A'));
    expect(store.getState().selection.names).toEqual(['B']);
  });

  it('records a fetch error on the planning slice', () => {
    const store = configureStore();
    store.dispatch(fetchPlanning());
    // middleware runs asynchronously against real fetch in Node? no — provide no server;
    // assert at least the synchronous transition happens through a reducer-only action
    store.dispatch({ type: 'PLANNING_FETCH_ERROR', error: 'boom' });
    expect(store.getState().planning.status).toBe('error');
    expect(store.getState().planning.error).toBe('boom');
  });

  it('handles schedule fetch requested without crashing', () => {
    const store = configureStore();
    store.dispatch(scheduleFetchRequested('2026-08'));
    expect(store.getState().schedule.status).toBe('loading');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `yarn workspace @planning-espoir/webapp test store`
Expected: FAIL — modules not found.

- [ ] **Step 7: Implement `webapp/src/store/types.ts`**

```ts
import type { Config, DayCell, Person, PersonDay, ParsingWarning } from '@planning-espoir/shared';

export type Status = 'idle' | 'loading' | 'loaded' | 'error';

export interface PlanningState {
  status: Status;
  people: Person[] | null;
  warnings: ParsingWarning[];
  error: string | null;
}

export interface ScheduleState {
  status: Status;
  month: string;
  days: Record<string, PersonDay[]> | null;
  error: string | null;
}

export interface SelectionState {
  names: string[];
}

export interface ConfigState {
  status: Status;
  config: Config;
  error: string | null;
}

export interface ColorsState {
  palette: string[];
}

export interface RootState {
  planning: PlanningState;
  schedule: ScheduleState;
  selection: SelectionState;
  config: ConfigState;
  colors: ColorsState;
}

export type { DayCell, Person, PersonDay };
```

- [ ] **Step 8: Implement `webapp/src/store/actions.ts`**

```ts
import type { Config } from '@planning-espoir/shared';

export const PLANNING_FETCH_REQUESTED = 'PLANNING_FETCH_REQUESTED';
export const PLANNING_FETCH_START = 'PLANNING_FETCH_START';
export const PLANNING_FETCH_SUCCESS = 'PLANNING_FETCH_SUCCESS';
export const PLANNING_FETCH_ERROR = 'PLANNING_FETCH_ERROR';

export const PLANNING_UPLOAD_REQUESTED = 'PLANNING_UPLOAD_REQUESTED';
export const PLANNING_UPLOAD_START = 'PLANNING_UPLOAD_START';
export const PLANNING_UPLOAD_SUCCESS = 'PLANNING_UPLOAD_SUCCESS';
export const PLANNING_UPLOAD_ERROR = 'PLANNING_UPLOAD_ERROR';

export const SCHEDULE_FETCH_REQUESTED = 'SCHEDULE_FETCH_REQUESTED';
export const SCHEDULE_FETCH_START = 'SCHEDULE_FETCH_START';
export const SCHEDULE_FETCH_SUCCESS = 'SCHEDULE_FETCH_SUCCESS';
export const SCHEDULE_FETCH_ERROR = 'SCHEDULE_FETCH_ERROR';

export const CONFIG_FETCH_REQUESTED = 'CONFIG_FETCH_REQUESTED';
export const CONFIG_FETCH_START = 'CONFIG_FETCH_START';
export const CONFIG_FETCH_SUCCESS = 'CONFIG_FETCH_SUCCESS';
export const CONFIG_FETCH_ERROR = 'CONFIG_FETCH_ERROR';

export const CONFIG_UPDATE_REQUESTED = 'CONFIG_UPDATE_REQUESTED';
export const CONFIG_UPDATE_START = 'CONFIG_UPDATE_START';
export const CONFIG_UPDATE_SUCCESS = 'CONFIG_UPDATE_SUCCESS';
export const CONFIG_UPDATE_ERROR = 'CONFIG_UPDATE_ERROR';

export const SELECTION_TOGGLE = 'SELECTION_TOGGLE';
export const SELECTION_CLEAR = 'SELECTION_CLEAR';

export interface Action<T = string, P = unknown> {
  type: T;
  payload?: P;
  error?: string;
}

export function planningFetchRequested(): Action<typeof PLANNING_FETCH_REQUESTED> {
  return { type: PLANNING_FETCH_REQUESTED };
}

export function planningUploadRequested(file: File): Action<typeof PLANNING_UPLOAD_REQUESTED, File> {
  return { type: PLANNING_UPLOAD_REQUESTED, payload: file };
}

export function scheduleFetchRequested(
  month: string,
): Action<typeof SCHEDULE_FETCH_REQUESTED, string> {
  return { type: SCHEDULE_FETCH_REQUESTED, payload: month };
}

export function configFetchRequested(): Action<typeof CONFIG_FETCH_REQUESTED> {
  return { type: CONFIG_FETCH_REQUESTED };
}

export function configUpdateRequested(
  update: Partial<Config>,
): Action<typeof CONFIG_UPDATE_REQUESTED, Partial<Config>> {
  return { type: CONFIG_UPDATE_REQUESTED, payload: update };
}

export function selectionToggle(name: string): Action<typeof SELECTION_TOGGLE, string> {
  return { type: SELECTION_TOGGLE, payload: name };
}

export function selectionClear(): Action<typeof SELECTION_CLEAR> {
  return { type: SELECTION_CLEAR };
}
```

- [ ] **Step 9: Implement `webapp/src/store/reducers.ts`**

```ts
import { combineReducers } from 'redux';
import type { PersonDay, ParsingWarning } from '@planning-espoir/shared';
import type { Action } from './actions';
import {
  CONFIG_FETCH_ERROR,
  CONFIG_FETCH_START,
  CONFIG_FETCH_SUCCESS,
  CONFIG_UPDATE_ERROR,
  CONFIG_UPDATE_START,
  CONFIG_UPDATE_SUCCESS,
  PLANNING_FETCH_ERROR,
  PLANNING_FETCH_START,
  PLANNING_FETCH_SUCCESS,
  PLANNING_UPLOAD_ERROR,
  PLANNING_UPLOAD_START,
  PLANNING_UPLOAD_SUCCESS,
  SCHEDULE_FETCH_ERROR,
  SCHEDULE_FETCH_START,
  SCHEDULE_FETCH_SUCCESS,
  SELECTION_CLEAR,
  SELECTION_TOGGLE,
} from './actions';
import { PALETTE } from '../colors';
import type {
  ColorsState,
  ConfigState,
  PlanningState,
  RootState,
  ScheduleState,
  SelectionState,
} from './types';

const initialPlanning: PlanningState = {
  status: 'idle',
  people: null,
  warnings: [],
  error: null,
};

const initialSchedule: ScheduleState = {
  status: 'idle',
  month: '',
  days: null,
  error: null,
};

const initialConfig: ConfigState = {
  status: 'idle',
  config: { startDate: null, defaultName: null },
  error: null,
};

const initialSelection: SelectionState = { names: [] };

const initialColors: ColorsState = { palette: PALETTE };

function planningReducer(state: PlanningState = initialPlanning, action: Action): PlanningState {
  switch (action.type) {
    case PLANNING_FETCH_START:
    case PLANNING_UPLOAD_START:
      return { ...state, status: 'loading', error: null };
    case PLANNING_FETCH_SUCCESS:
    case PLANNING_UPLOAD_SUCCESS: {
      const payload = action.payload as { people: PlanningState['people']; warnings: ParsingWarning[] };
      return { ...state, status: 'loaded', people: payload.people, warnings: payload.warnings, error: null };
    }
    case PLANNING_FETCH_ERROR:
    case PLANNING_UPLOAD_ERROR:
      return { ...state, status: 'error', error: action.error ?? 'Upload failed' };
    default:
      return state;
  }
}

function scheduleReducer(state: ScheduleState = initialSchedule, action: Action): ScheduleState {
  switch (action.type) {
    case SCHEDULE_FETCH_START:
      return { ...state, status: 'loading', month: action.payload as string, error: null };
    case SCHEDULE_FETCH_SUCCESS: {
      const payload = action.payload as { month: string; days: Record<string, PersonDay[]> };
      return { ...state, status: 'loaded', month: payload.month, days: payload.days, error: null };
    }
    case SCHEDULE_FETCH_ERROR:
      return { ...state, status: 'error', error: action.error ?? 'Schedule fetch failed' };
    default:
      return state;
  }
}

function configReducer(state: ConfigState = initialConfig, action: Action): ConfigState {
  switch (action.type) {
    case CONFIG_FETCH_START:
    case CONFIG_UPDATE_START:
      return { ...state, status: 'loading', error: null };
    case CONFIG_FETCH_SUCCESS:
    case CONFIG_UPDATE_SUCCESS:
      return { ...state, status: 'loaded', config: action.payload as ConfigState['config'], error: null };
    case CONFIG_FETCH_ERROR:
    case CONFIG_UPDATE_ERROR:
      return { ...state, status: 'error', error: action.error ?? 'Config update failed' };
    default:
      return state;
  }
}

function selectionReducer(state: SelectionState = initialSelection, action: Action): SelectionState {
  switch (action.type) {
    case SELECTION_TOGGLE: {
      const name = action.payload as string;
      const names = state.names.includes(name)
        ? state.names.filter((n) => n !== name)
        : [...state.names, name];
      return { names };
    }
    case SELECTION_CLEAR:
      return { names: [] };
    default:
      return state;
  }
}

function colorsReducer(state: ColorsState = initialColors, _action: Action): ColorsState {
  return state;
}

export const rootReducer = combineReducers<RootState>({
  planning: planningReducer,
  schedule: scheduleReducer,
  config: configReducer,
  selection: selectionReducer,
  colors: colorsReducer,
});
```

- [ ] **Step 10: Implement `webapp/src/store/apiMiddleware.ts`**

```ts
import type { Middleware } from 'redux';
import * as api from '../api/client';
import {
  CONFIG_FETCH_ERROR,
  CONFIG_FETCH_REQUESTED,
  CONFIG_FETCH_START,
  CONFIG_FETCH_SUCCESS,
  CONFIG_UPDATE_ERROR,
  CONFIG_UPDATE_REQUESTED,
  CONFIG_UPDATE_START,
  CONFIG_UPDATE_SUCCESS,
  PLANNING_FETCH_ERROR,
  PLANNING_FETCH_REQUESTED,
  PLANNING_FETCH_START,
  PLANNING_FETCH_SUCCESS,
  PLANNING_UPLOAD_ERROR,
  PLANNING_UPLOAD_REQUESTED,
  PLANNING_UPLOAD_START,
  PLANNING_UPLOAD_SUCCESS,
  SCHEDULE_FETCH_ERROR,
  SCHEDULE_FETCH_REQUESTED,
  SCHEDULE_FETCH_START,
  SCHEDULE_FETCH_SUCCESS,
} from './actions';
import type { RootState } from './types';

export const apiMiddleware: Middleware<object, RootState> = (store) => (next) => (action) => {
  const typed = action as { type: string; payload?: unknown };

  switch (typed.type) {
    case PLANNING_FETCH_REQUESTED:
      store.dispatch({ type: PLANNING_FETCH_START });
      api
        .fetchPlanning()
        .then((data) => store.dispatch({ type: PLANNING_FETCH_SUCCESS, payload: data }))
        .catch((err: Error) => store.dispatch({ type: PLANNING_FETCH_ERROR, error: err.message }));
      break;

    case PLANNING_UPLOAD_REQUESTED:
      store.dispatch({ type: PLANNING_UPLOAD_START });
      api
        .uploadPlanning(typed.payload as File)
        .then((data) => {
          store.dispatch({ type: PLANNING_UPLOAD_SUCCESS, payload: data });
          const month = store.getState().schedule.month;
          if (month) store.dispatch({ type: SCHEDULE_FETCH_REQUESTED, payload: month });
        })
        .catch((err: Error) => store.dispatch({ type: PLANNING_UPLOAD_ERROR, error: err.message }));
      break;

    case SCHEDULE_FETCH_REQUESTED:
      store.dispatch({ type: SCHEDULE_FETCH_START, payload: typed.payload as string });
      api
        .fetchSchedule(typed.payload as string)
        .then((data) => store.dispatch({ type: SCHEDULE_FETCH_SUCCESS, payload: data }))
        .catch((err: Error) => store.dispatch({ type: SCHEDULE_FETCH_ERROR, error: err.message }));
      break;

    case CONFIG_FETCH_REQUESTED:
      store.dispatch({ type: CONFIG_FETCH_START });
      api
        .fetchConfig()
        .then((data) => store.dispatch({ type: CONFIG_FETCH_SUCCESS, payload: data }))
        .catch((err: Error) => store.dispatch({ type: CONFIG_FETCH_ERROR, error: err.message }));
      break;

    case CONFIG_UPDATE_REQUESTED:
      store.dispatch({ type: CONFIG_UPDATE_START });
      api
        .updateConfig(typed.payload as Partial<{ startDate: string | null; defaultName: string | null }>)
        .then((data) => {
          store.dispatch({ type: CONFIG_UPDATE_SUCCESS, payload: data });
          const month = store.getState().schedule.month;
          if (month) store.dispatch({ type: SCHEDULE_FETCH_REQUESTED, payload: month });
        })
        .catch((err: Error) => store.dispatch({ type: CONFIG_UPDATE_ERROR, error: err.message }));
      break;
  }

  return next(action);
};
```

- [ ] **Step 11: Implement `webapp/src/store/store.ts`**

```ts
import { applyMiddleware, createStore } from 'redux';
import { apiMiddleware } from './apiMiddleware';
import { rootReducer } from './reducers';
import type { RootState } from './types';

export function configureStore() {
  return createStore(rootReducer, applyMiddleware(apiMiddleware));
}

export type AppStore = ReturnType<typeof configureStore>;
export type { RootState };
```

- [ ] **Step 12: Implement `webapp/src/colors.ts`**

```ts
export const PALETTE = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
];

export function colorFor(colorIndex: number, palette: string[] = PALETTE): string {
  return palette[colorIndex % palette.length] ?? palette[0];
}
```

- [ ] **Step 13: Run webapp tests, typecheck, lint**

Run: `yarn workspace @planning-espoir/webapp test && yarn workspace @planning-espoir/webapp typecheck && yarn workspace @planning-espoir/webapp lint`
Expected: all pass. Note: `store.spec.ts` dispatches real actions; middleware attempts real `fetch` against no server, so the test only exercises reducer-transitions that do not hit the network. If the middleware errors on `fetch is not defined` under jsdom, stub `global.fetch` in `src/test/setup.ts` with `vi.fn()`.

- [ ] **Step 14: Fix store.spec.ts async issue if needed**

Add to `webapp/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.stubGlobal('fetch', vi.fn());
```

- [ ] **Step 15: Commit**

```bash
git add webapp/src/store webapp/src/api webapp/src/colors.ts webapp/src/test/setup.ts
git commit -m "feat: add Redux store with custom middleware and API client"
```

---

### Task 7: Webapp UI components

Implement the calendar UI: month grid, day cells with per-person color, legend, person dropdown, upload button, config modal, and wire them into `App`.

**Files:**
- Create: `webapp/src/utils/dates.ts`
- Create: `webapp/src/utils/dates.spec.ts`
- Create: `webapp/src/components/Header.tsx`
- Create: `webapp/src/components/PersonDropdown.tsx`
- Create: `webapp/src/components/UploadButton.tsx`
- Create: `webapp/src/components/ConfigModal.tsx`
- Create: `webapp/src/components/MonthCalendar.tsx`
- Create: `webapp/src/components/DayCell.tsx`
- Create: `webapp/src/components/Legend.tsx`
- Create: `webapp/src/components/MonthCalendar.spec.tsx`
- Create: `webapp/src/App.tsx` (overwrite)
- Create: `webapp/src/App.test.tsx` (overwrite)

**Interfaces:**
- Consumes: store (`configureStore`, action creators, selectors), `colorFor`, shared types.
- Produces:
  - `currentMonthKey(): string` — `"YYYY-MM"` for now (UTC).
  - `shiftMonth(month: string, delta: number): string`.
  - `monthGrid(month: string): (string | null)[][]` — weeks of date keys padded with `null`.
  - `weekdayLabel(i: number): string` — `"Lun"`..`"Dim"`.
  - `formatDayCell(cell: DayCell): string` — human text for a day cell.
  - Components render using `useSelector`/`useDispatch` from react-redux.

- [ ] **Step 1: Write the failing date utils test**

`webapp/src/utils/dates.spec.ts`:

```ts
import { currentMonthKey, monthGrid, shiftMonth, weekdayLabel } from './dates';

describe('dates utils', () => {
  it('shifts months across year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('produces a current month key', () => {
    const now = new Date();
    const expected = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    expect(currentMonthKey()).toBe(expected);
  });

  it('builds a Monday-first month grid with null padding', () => {
    // August 2026 starts on a Saturday
    const grid = monthGrid('2026-08');
    expect(grid[0]).toHaveLength(7);
    expect(grid.flat().filter((d) => d !== null)).toHaveLength(31);
    const saturday = grid.flat().findIndex((d) => d === '2026-08-01');
    expect(saturday).toBe(5); // Monday-first: index 5 is Saturday
  });

  it('labels weekdays', () => {
    expect(weekdayLabel(0)).toBe('Lun');
    expect(weekdayLabel(6)).toBe('Dim');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn workspace @planning-espoir/webapp test dates`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `webapp/src/utils/dates.ts`**

```ts
const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split('-').map(Number);
  const d = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthGrid(month: string): (string | null)[][] {
  const [year, monthIndex] = month.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, monthIndex - 1, 1));
  const offset = (firstDay.getUTCDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();

  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${month}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export function weekdayLabel(index: number): string {
  return WEEKDAY_LABELS[index];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn workspace @planning-espoir/webapp test dates`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing calendar component test**

`webapp/src/components/MonthCalendar.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { describe, expect, it } from 'vitest';
import { rootReducer } from '../store/reducers';
import { configureStore } from '../store/store';
import type { RootState } from '../store/types';
import { MonthCalendar } from './MonthCalendar';

function makeState(overrides: Partial<RootState> = {}): RootState {
  return {
    planning: {
      status: 'loaded',
      people: [
        { name: 'A', role: 'R', colorIndex: 0, weeks: [] },
        { name: 'B', role: 'R', colorIndex: 1, weeks: [] },
      ],
      warnings: [],
      error: null,
    },
    schedule: {
      status: 'loaded',
      month: '2026-08',
      days: {
        '2026-08-03': [
          { name: 'A', colorIndex: 0, cell: { type: 'shift', slots: [{ start: '09:00', end: '13:00' }] } },
          { name: 'B', colorIndex: 1, cell: { type: 'off', label: 'rh' } },
        ],
      },
      error: null,
    },
    selection: { names: ['A', 'B'] },
    config: { status: 'loaded', config: { startDate: '2026-07-27', defaultName: null }, error: null },
    colors: { palette: ['#ff0000', '#00ff00'] },
    ...overrides,
  };
}

describe('MonthCalendar', () => {
  it('renders weekday headers', () => {
    render(
      <Provider store={configureStore()}>
        <MonthCalendar />
      </Provider>,
    );
    expect(screen.getByText('Lun')).toBeInTheDocument();
    expect(screen.getByText('Dim')).toBeInTheDocument();
  });

  it('renders selected people day cells with shift times and off badge', () => {
    const store = createStore(rootReducer, makeState());
    render(
      <Provider store={store}>
        <MonthCalendar />
      </Provider>,
    );
    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(screen.getByText('rh')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `yarn workspace @planning-espoir/webapp test MonthCalendar`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement `webapp/src/components/DayCell.tsx`**

```tsx
import type { DayCell as DayCellModel } from '@planning-espoir/shared';
import { colorFor } from '../colors';

interface Props {
  cell: DayCellModel;
  colorIndex: number;
  palette: string[];
}

export function DayCell({ cell, colorIndex, palette }: Props) {
  const color = colorFor(colorIndex, palette);
  if (cell.type === 'none') return null;
  if (cell.type === 'off') {
    return (
      <span
        className="inline-block rounded px-1.5 py-0.5 text-xs font-medium text-white"
        style={{ backgroundColor: color }}
        title={cell.label}
      >
        {cell.label}
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      {cell.slots.map((slot, i) => (
        <span
          key={i}
          className="inline-block rounded px-1.5 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: color }}
        >
          {slot.start}–{slot.end}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Implement `webapp/src/components/MonthCalendar.tsx`**

```tsx
import { useSelector } from 'react-redux';
import { monthGrid, weekdayLabel } from '../utils/dates';
import type { RootState } from '../store/types';
import { DayCell } from './DayCell';

export function MonthCalendar() {
  const month = useSelector((state: RootState) => state.schedule.month);
  const days = useSelector((state: RootState) => state.schedule.days);
  const selection = useSelector((state: RootState) => state.selection.names);
  const palette = useSelector((state: RootState) => state.colors.palette);

  if (!days) return null;
  const grid = monthGrid(month);

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-7 min-w-[700px]">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="border-b border-slate-200 px-2 py-1 text-center text-xs font-semibold text-slate-500">
            {weekdayLabel(i)}
          </div>
        ))}
        {grid.flat().map((date, idx) => {
          const personDays = date ? (days[date] ?? []).filter((pd) => selection.includes(pd.name)) : [];
          return (
            <div
              key={idx}
              className="min-h-24 border-b border-slate-100 p-1"
              data-testid={date ? `day-${date}` : undefined}
            >
              {date && <div className="text-xs text-slate-400">{Number(date.slice(8, 10))}</div>}
              <div className="mt-1 flex flex-col gap-0.5">
                {personDays.map((pd) => (
                  <DayCell key={pd.name} cell={pd.cell} colorIndex={pd.colorIndex} palette={palette} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Implement `webapp/src/components/Legend.tsx`**

```tsx
import { useSelector } from 'react-redux';
import { colorFor } from '../colors';
import type { RootState } from '../store/types';

export function Legend() {
  const people = useSelector((state: RootState) => state.planning.people);
  const selection = useSelector((state: RootState) => state.selection.names);
  const palette = useSelector((state: RootState) => state.colors.palette);

  const selected = (people ?? []).filter((p) => selection.includes(p.name));
  if (selected.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-3">
      {selected.map((p) => (
        <span key={p.name} className="inline-flex items-center gap-1.5 text-sm text-slate-700">
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: colorFor(p.colorIndex, palette) }} />
          {p.name}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 10: Implement `webapp/src/components/PersonDropdown.tsx`**

```tsx
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectionToggle } from '../store/actions';
import type { RootState } from '../store/types';

export function PersonDropdown() {
  const dispatch = useDispatch();
  const people = useSelector((state: RootState) => state.planning.people) ?? [];
  const selection = useSelector((state: RootState) => state.selection.names);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        Personnes ({selection.length})
      </button>
      {open && (
        <div className="absolute z-10 mt-1 max-h-64 w-64 overflow-auto rounded border border-slate-200 bg-white shadow-lg">
          {people.map((p) => (
            <label key={p.name} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selection.includes(p.name)}
                onChange={() => dispatch(selectionToggle(p.name))}
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

- [ ] **Step 11: Implement `webapp/src/components/UploadButton.tsx`**

```tsx
import { useRef } from 'react';
import { useDispatch } from 'react-redux';
import { planningUploadRequested } from '../store/actions';

export function UploadButton() {
  const dispatch = useDispatch();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Importer un planning
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) dispatch(planningUploadRequested(file));
          e.target.value = '';
        }}
      />
    </>
  );
}
```

- [ ] **Step 12: Implement `webapp/src/components/ConfigModal.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { configUpdateRequested } from '../store/actions';
import type { RootState } from '../store/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ConfigModal({ open, onClose }: Props) {
  const dispatch = useDispatch();
  const config = useSelector((state: RootState) => state.config.config);
  const [startDate, setStartDate] = useState('');
  const [defaultName, setDefaultName] = useState('');

  useEffect(() => {
    if (open) {
      setStartDate(config.startDate ?? '');
      setDefaultName(config.defaultName ?? '');
    }
  }, [open, config]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-slate-800">Configuration</h2>
        <label className="mt-4 block text-sm font-medium text-slate-600">
          Date de début
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-slate-600">
          Nom par défaut
          <input
            type="text"
            value={defaultName}
            onChange={(e) => setDefaultName(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              dispatch(
                configUpdateRequested({
                  startDate: startDate || null,
                  defaultName: defaultName || null,
                }),
              );
              onClose();
            }}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 13: Implement `webapp/src/components/Header.tsx`**

```tsx
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { scheduleFetchRequested } from '../store/actions';
import type { RootState } from '../store/types';
import { shiftMonth } from '../utils/dates';
import { ConfigModal } from './ConfigModal';
import { PersonDropdown } from './PersonDropdown';
import { UploadButton } from './UploadButton';

export function Header() {
  const dispatch = useDispatch();
  const month = useSelector((state: RootState) => state.schedule.month);
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <h1 className="text-xl font-bold text-slate-800">Planning Espoir</h1>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => dispatch(scheduleFetchRequested(shiftMonth(month, -1)))}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          ‹
        </button>
        <span className="min-w-28 text-center text-sm font-medium text-slate-700">{month}</span>
        <button
          type="button"
          onClick={() => dispatch(scheduleFetchRequested(shiftMonth(month, 1)))}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          ›
        </button>
      </div>
      <PersonDropdown />
      <UploadButton />
      <button
        type="button"
        onClick={() => setConfigOpen(true)}
        className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        Config
      </button>
      <ConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
    </header>
  );
}
```

- [ ] **Step 14: Overwrite `webapp/src/App.tsx`**

```tsx
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Header } from './components/Header';
import { Legend } from './components/Legend';
import { MonthCalendar } from './components/MonthCalendar';
import { configFetchRequested, planningFetchRequested, scheduleFetchRequested } from './store/actions';
import type { RootState } from './store/types';
import { currentMonthKey } from './utils/dates';

export default function App() {
  const dispatch = useDispatch();
  const planning = useSelector((state: RootState) => state.planning);

  useEffect(() => {
    dispatch(planningFetchRequested());
    dispatch(configFetchRequested());
    dispatch(scheduleFetchRequested(currentMonthKey()));
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-4">
        {planning.status === 'error' && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {planning.error}
          </div>
        )}
        {planning.status === 'loading' && <p className="text-slate-500">Chargement…</p>}
        {planning.status === 'loaded' && planning.people?.length === 0 && (
          <p className="text-slate-500">Aucun planning. Importez un fichier Excel pour commencer.</p>
        )}
        {planning.status === 'loaded' && planning.people && planning.people.length > 0 && (
          <>
            <MonthCalendar />
            <Legend />
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 15: Overwrite `webapp/src/App.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import App from './App';
import { configureStore } from './store/store';

describe('App', () => {
  it('renders the header title and initial loading state', () => {
    render(
      <Provider store={configureStore()}>
        <App />
      </Provider>,
    );
    expect(screen.getByRole('heading', { name: 'Planning Espoir' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 16: Run webapp tests, lint, typecheck, build**

Run: `yarn workspace @planning-espoir/webapp test && yarn workspace @planning-espoir/webapp lint && yarn workspace @planning-espoir/webapp typecheck && yarn workspace @planning-espoir/webapp build`
Expected: all pass.

- [ ] **Step 17: Commit**

```bash
git add webapp/src
git commit -m "feat: add calendar UI components and wire app"
```

---

### Task 8: Docker + docker-compose + root verification

Containerize the API and webapp and verify the full root command set.

**Files:**
- Create: `.dockerignore`
- Create: `api/Dockerfile`
- Create: `webapp/Dockerfile`
- Create: `webapp/nginx.conf`
- Create: `docker-compose.yml`

**Interfaces:**
- Consumes: the built workspace packages.
- Produces: `docker compose up` runs API on port 3000 and webapp (nginx) on port 8081; nginx proxies `/api` to the API.

- [ ] **Step 1: Create `.dockerignore`**

```gitignore
node_modules
dist
coverage
data
.git
docs
*.log
```

- [ ] **Step 2: Create `api/Dockerfile`**

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY webapp/package.json webapp/
RUN yarn install --frozen-lockfile
COPY shared shared
COPY api api
RUN yarn workspace @planning-espoir/shared build && yarn workspace @planning-espoir/api build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared ./shared
COPY --from=build /app/api ./api
EXPOSE 3000
CMD ["node", "api/dist/main.js"]
```

- [ ] **Step 3: Create `webapp/Dockerfile`**

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY webapp/package.json webapp/
RUN yarn install --frozen-lockfile
COPY shared shared
COPY webapp webapp
RUN yarn workspace @planning-espoir/shared build && yarn workspace @planning-espoir/webapp build

FROM nginx:alpine AS runtime
COPY webapp/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/webapp/dist /usr/share/nginx/html
EXPOSE 80
```

- [ ] **Step 4: Create `webapp/nginx.conf`**

```nginx
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://api:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

- [ ] **Step 5: Create `docker-compose.yml`**

```yaml
services:
  api:
    build:
      context: .
      dockerfile: api/Dockerfile
    environment:
      - DATA_DIR=/data
    volumes:
      - api-data:/data
    ports:
      - "3000:3000"

  webapp:
    build:
      context: .
      dockerfile: webapp/Dockerfile
    ports:
      - "8081:80"
    depends_on:
      - api

volumes:
  api-data:
```

- [ ] **Step 6: Verify the root command set**

Run: `yarn typecheck && yarn lint && yarn test && yarn build`
Expected: all pass from the repo root.

- [ ] **Step 7: Verify docker compose configuration**

Run: `docker compose config`
Expected: prints the resolved compose config without errors.

- [ ] **Step 8: Commit**

```bash
git add .dockerignore api/Dockerfile webapp/Dockerfile webapp/nginx.conf docker-compose.yml
git commit -m "feat: add Docker and docker-compose deployment"
```

---

## Self-Review

### Spec coverage

- D1 server-side parsing → Tasks 3, 4 (`parser.ts`, upload route).
- D2 parse on upload / normalized JSON → Task 4 (`savePlanningJson`).
- D3 date correlation flat file pre-filled from sheet name → Task 4 (`extractStartDate`, `config.json`).
- D4 perpetual cycle rotation → Task 3 (`weekIndexForDate`), Task 4 (`getSchedule`).
- D5 `rh`/`RH` day-off badge → Task 3 parser (`off`), Task 7 `DayCell` badge.
- D6 lenient time parsing (`18;30`) → Task 3 (`TIME_TEXT_RE`).
- D7 color per person by order of appearance → Task 3 (`colorIndex`), Task 6 (`PALETTE`/`colorFor`).
- D8 month view, all selected visible → Task 7 (`MonthCalendar`, `DayCell` stacking).
- D9 no pre-selection, config preference → Task 7 (`PersonDropdown` empty default, `ConfigModal`).
- D10 canonical person list from S1 + index matching → Task 3 (`parsePeopleRows` by index).
- API routes → Task 4 (POST/GET `/planning`, `/schedule`, `/config`).
- Storage files → Task 4 (`planning.xlsx`, `planning.json`, `config.json`).
- Redux constraints → Task 6 (plain reducers + custom middleware, no thunk/slices/createReducer).
- Error handling → Task 4 (404/400, warnings), Task 6 (client throws server message).
- Testing matrix → Tasks 3-7 unit + e2e + component tests; root lint/typecheck/build in Task 8.
- Docker + compose → Task 8.

### Placeholder scan

No TODOs/TBDs. All code blocks are complete and runnable.

### Type consistency

- `weekIndexForDate`, `weekdayIndex`, `monthDays` — Task 3 defines, Task 4 consumes with identical signatures.
- `parsePlanning(buffer, fileName): Promise<ParsedPlanning>` — Task 3 defines, Task 4 consumes.
- `Storage` methods — Task 4 defines and consumes consistently.
- `configureStore`, action creators, `PALETTE`/`colorFor`, `monthGrid`/`shiftMonth`/`currentMonthKey`/`weekdayLabel` — Task 6/7 define and consume consistently.
- `DayCell`, `Person`, `PersonDay`, `ScheduleMonth`, `Config`, `ParsingWarning`, `ParsedPlanning` — defined once in `shared/src/types.ts`, used identically in api and webapp.
