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
  [key: string]: unknown;
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
