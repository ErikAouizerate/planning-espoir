import { combineReducers } from 'redux';
import type { PersonDay, ParsingWarning } from '@planning-espoir/shared';
import type { Action } from './actions';
import {
  AUTH_FETCH_ERROR,
  AUTH_FETCH_START,
  AUTH_FETCH_SUCCESS,
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
  SELECTION_ADD,
  SELECTION_TOGGLE,
} from './actions';
import { PALETTE } from '../colors';
import type {
  AuthState,
  ColorsState,
  ConfigState,
  PlanningState,
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
  mondayWeeks: null,
  error: null,
};

const initialConfig: ConfigState = {
  status: 'idle',
  config: { startDate: null, defaultNames: [], fileName: null },
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
      const payload = action.payload as {
        people: PlanningState['people'];
        warnings: ParsingWarning[];
      };
      return {
        ...state,
        status: 'loaded',
        people: payload.people,
        warnings: payload.warnings,
        error: null,
      };
    }
    case PLANNING_FETCH_ERROR:
    case PLANNING_UPLOAD_ERROR:
      return {
        ...state,
        status: 'error',
        error: action.error ?? 'Upload failed',
      };
    default:
      return state;
  }
}

function scheduleReducer(state: ScheduleState = initialSchedule, action: Action): ScheduleState {
  switch (action.type) {
    case SCHEDULE_FETCH_START:
      return {
        ...state,
        status: 'loading',
        month: action.payload as string,
        error: null,
      };
    case SCHEDULE_FETCH_SUCCESS: {
      const payload = action.payload as {
        month: string;
        days: Record<string, PersonDay[]>;
        mondayWeeks: Record<string, number>;
      };
      return {
        ...state,
        status: 'loaded',
        month: payload.month,
        days: payload.days,
        mondayWeeks: payload.mondayWeeks,
        error: null,
      };
    }
    case SCHEDULE_FETCH_ERROR:
      return {
        ...state,
        status: 'error',
        error: action.error ?? 'Schedule fetch failed',
      };
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
      return {
        ...state,
        status: 'loaded',
        config: action.payload as ConfigState['config'],
        error: null,
      };
    case CONFIG_FETCH_ERROR:
    case CONFIG_UPDATE_ERROR:
      return {
        ...state,
        status: 'error',
        error: action.error ?? 'Config update failed',
      };
    default:
      return state;
  }
}

function selectionReducer(
  state: SelectionState = initialSelection,
  action: Action,
): SelectionState {
  switch (action.type) {
    case SELECTION_TOGGLE: {
      const name = action.payload as string;
      const names = state.names.includes(name)
        ? state.names.filter((n) => n !== name)
        : [...state.names, name];
      return { names };
    }
    case SELECTION_ADD: {
      const name = action.payload as string;
      if (state.names.includes(name)) return state;
      return { names: [...state.names, name] };
    }
    case SELECTION_CLEAR:
      return { names: [] };
    default:
      return state;
  }
}

function colorsReducer(state: ColorsState = initialColors): ColorsState {
  return state;
}

const initialAuth: AuthState = {
  status: 'idle',
  username: null,
  error: null,
};

function authReducer(state: AuthState = initialAuth, action: Action): AuthState {
  switch (action.type) {
    case AUTH_FETCH_START:
      return { ...state, status: 'loading', error: null };
    case AUTH_FETCH_SUCCESS:
      return { ...state, status: 'loaded', username: action.payload as string, error: null };
    case AUTH_FETCH_ERROR:
      return { ...state, status: 'error', error: action.error ?? 'Auth fetch failed' };
    default:
      return state;
  }
}

export const rootReducer = combineReducers({
  planning: planningReducer,
  schedule: scheduleReducer,
  config: configReducer,
  selection: selectionReducer,
  colors: colorsReducer,
  auth: authReducer,
});
