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
  fileName: string | null; // original name of the uploaded planning file
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
