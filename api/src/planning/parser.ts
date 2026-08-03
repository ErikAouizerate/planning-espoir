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
  janvier: 1,
  fevrier: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
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

  const hasAny = raw.some(
    (v) => v !== null && v !== undefined && (typeof v !== 'string' || v.trim() !== ''),
  );
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
  const monthKey = m[2]
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const month = FRENCH_MONTHS[monthKey];
  if (!month || day < 1 || day > 31) return null;
  const yearMatch = fileName.match(/(20\d{2})/);
  const year = yearMatch ? Number(yearMatch[1]) : new Date().getUTCFullYear();
  return `${year}-${pad(month)}-${pad(day)}`;
}

export async function parsePlanning(buffer: Buffer, fileName: string): Promise<ParsedPlanning> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new PlanningFormatError('Not a valid Excel workbook');
  }

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

function nextBlockRow(
  blocks: { week: number; row: number }[],
  row: number,
  rowCount: number,
): number {
  const next = blocks.find((b) => b.row > row);
  return next ? next.row : rowCount + 1;
}
