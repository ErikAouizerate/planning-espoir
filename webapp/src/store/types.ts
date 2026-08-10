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
  sundayWeeks: Record<string, number> | null;
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

export interface AuthState {
  status: Status;
  username: string | null;
  error: string | null;
}

export interface RootState {
  planning: PlanningState;
  schedule: ScheduleState;
  selection: SelectionState;
  config: ConfigState;
  colors: ColorsState;
  auth: AuthState;
}

export type { DayCell, Person, PersonDay };
