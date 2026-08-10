import type { Config, Person, PersonDay, ParsingWarning } from '@planning-espoir/shared';

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
export const SELECTION_ADD = 'SELECTION_ADD';
export const SELECTION_CLEAR = 'SELECTION_CLEAR';

export const AUTH_FETCH_REQUESTED = 'AUTH_FETCH_REQUESTED';
export const AUTH_FETCH_START = 'AUTH_FETCH_START';
export const AUTH_FETCH_SUCCESS = 'AUTH_FETCH_SUCCESS';
export const AUTH_FETCH_ERROR = 'AUTH_FETCH_ERROR';

export interface Action<T = string, P = unknown> {
  type: T;
  payload?: P;
  error?: string;
  [key: string]: unknown;
}

export interface PlanningPayload {
  startDate: string | null;
  people: Person[];
  warnings: ParsingWarning[];
}

export interface SchedulePayload {
  month: string;
  days: Record<string, PersonDay[]>;
  sundayWeeks: Record<string, number>;
}

export function planningFetchRequested(): Action<typeof PLANNING_FETCH_REQUESTED> {
  return { type: PLANNING_FETCH_REQUESTED };
}

export function planningFetchStart(): Action<typeof PLANNING_FETCH_START> {
  return { type: PLANNING_FETCH_START };
}

export function planningFetchSuccess(
  payload: PlanningPayload,
): Action<typeof PLANNING_FETCH_SUCCESS, PlanningPayload> {
  return { type: PLANNING_FETCH_SUCCESS, payload };
}

export function planningFetchError(error: string): Action<typeof PLANNING_FETCH_ERROR> {
  return { type: PLANNING_FETCH_ERROR, error };
}

export function planningUploadRequested(
  file: File,
): Action<typeof PLANNING_UPLOAD_REQUESTED, File> {
  return { type: PLANNING_UPLOAD_REQUESTED, payload: file };
}

export function planningUploadStart(): Action<typeof PLANNING_UPLOAD_START> {
  return { type: PLANNING_UPLOAD_START };
}

export function planningUploadSuccess(
  payload: PlanningPayload,
): Action<typeof PLANNING_UPLOAD_SUCCESS, PlanningPayload> {
  return { type: PLANNING_UPLOAD_SUCCESS, payload };
}

export function planningUploadError(error: string): Action<typeof PLANNING_UPLOAD_ERROR> {
  return { type: PLANNING_UPLOAD_ERROR, error };
}

export function scheduleFetchRequested(
  month: string,
): Action<typeof SCHEDULE_FETCH_REQUESTED, string> {
  return { type: SCHEDULE_FETCH_REQUESTED, payload: month };
}

export function scheduleFetchStart(month: string): Action<typeof SCHEDULE_FETCH_START, string> {
  return { type: SCHEDULE_FETCH_START, payload: month };
}

export function scheduleFetchSuccess(
  payload: SchedulePayload,
): Action<typeof SCHEDULE_FETCH_SUCCESS, SchedulePayload> {
  return { type: SCHEDULE_FETCH_SUCCESS, payload };
}

export function scheduleFetchError(error: string): Action<typeof SCHEDULE_FETCH_ERROR> {
  return { type: SCHEDULE_FETCH_ERROR, error };
}

export function configFetchRequested(): Action<typeof CONFIG_FETCH_REQUESTED> {
  return { type: CONFIG_FETCH_REQUESTED };
}

export function configFetchStart(): Action<typeof CONFIG_FETCH_START> {
  return { type: CONFIG_FETCH_START };
}

export function configFetchSuccess(payload: Config): Action<typeof CONFIG_FETCH_SUCCESS, Config> {
  return { type: CONFIG_FETCH_SUCCESS, payload };
}

export function configFetchError(error: string): Action<typeof CONFIG_FETCH_ERROR> {
  return { type: CONFIG_FETCH_ERROR, error };
}

export function configUpdateRequested(
  update: Partial<Config>,
): Action<typeof CONFIG_UPDATE_REQUESTED, Partial<Config>> {
  return { type: CONFIG_UPDATE_REQUESTED, payload: update };
}

export function configUpdateStart(): Action<typeof CONFIG_UPDATE_START> {
  return { type: CONFIG_UPDATE_START };
}

export function configUpdateSuccess(payload: Config): Action<typeof CONFIG_UPDATE_SUCCESS, Config> {
  return { type: CONFIG_UPDATE_SUCCESS, payload };
}

export function configUpdateError(error: string): Action<typeof CONFIG_UPDATE_ERROR> {
  return { type: CONFIG_UPDATE_ERROR, error };
}

export function selectionToggle(name: string): Action<typeof SELECTION_TOGGLE, string> {
  return { type: SELECTION_TOGGLE, payload: name };
}

export function selectionAdd(name: string): Action<typeof SELECTION_ADD, string> {
  return { type: SELECTION_ADD, payload: name };
}

export function selectionClear(): Action<typeof SELECTION_CLEAR> {
  return { type: SELECTION_CLEAR };
}

export function authFetchRequested(): Action<typeof AUTH_FETCH_REQUESTED> {
  return { type: AUTH_FETCH_REQUESTED };
}

export function authFetchStart(): Action<typeof AUTH_FETCH_START> {
  return { type: AUTH_FETCH_START };
}

export function authFetchSuccess(username: string): Action<typeof AUTH_FETCH_SUCCESS, string> {
  return { type: AUTH_FETCH_SUCCESS, payload: username };
}

export function authFetchError(error: string): Action<typeof AUTH_FETCH_ERROR> {
  return { type: AUTH_FETCH_ERROR, error };
}
