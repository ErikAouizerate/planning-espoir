import type { Middleware } from 'redux';
import * as api from '../api/client';
import type { Config } from '@planning-espoir/shared';
import {
  AUTH_FETCH_REQUESTED,
  CONFIG_FETCH_REQUESTED,
  CONFIG_UPDATE_REQUESTED,
  PLANNING_FETCH_REQUESTED,
  PLANNING_UPLOAD_REQUESTED,
  SCHEDULE_FETCH_REQUESTED,
  authFetchError,
  authFetchStart,
  authFetchSuccess,
  configFetchError,
  configFetchRequested,
  configFetchStart,
  configFetchSuccess,
  configUpdateError,
  configUpdateStart,
  configUpdateSuccess,
  planningFetchError,
  planningFetchStart,
  planningFetchSuccess,
  planningUploadError,
  planningUploadStart,
  planningUploadSuccess,
  scheduleFetchError,
  scheduleFetchRequested,
  scheduleFetchStart,
  scheduleFetchSuccess,
  selectionAdd,
} from './actions';
import type { RootState } from './types';

export const apiMiddleware: Middleware<object, RootState> = (store) => (next) => (action) => {
  const typed = action as { type: string; payload?: unknown };

  switch (typed.type) {
    case AUTH_FETCH_REQUESTED:
      store.dispatch(authFetchStart());
      api
        .fetchAuthMe()
        .then((data) => store.dispatch(authFetchSuccess(data.username)))
        .catch((err: Error) => store.dispatch(authFetchError(err.message)));
      break;

    case PLANNING_FETCH_REQUESTED:
      store.dispatch(planningFetchStart());
      api
        .fetchPlanning()
        .then((data) => store.dispatch(planningFetchSuccess(data)))
        .catch((err: Error) => store.dispatch(planningFetchError(err.message)));
      break;

    case PLANNING_UPLOAD_REQUESTED:
      store.dispatch(planningUploadStart());
      api
        .uploadPlanning(typed.payload as File)
        .then((data) => {
          store.dispatch(planningUploadSuccess(data));
          store.dispatch(configFetchRequested());
          const month = store.getState().schedule.month;
          if (month) store.dispatch(scheduleFetchRequested(month));
        })
        .catch((err: Error) => store.dispatch(planningUploadError(err.message)));
      break;

    case SCHEDULE_FETCH_REQUESTED:
      store.dispatch(scheduleFetchStart(typed.payload as string));
      api
        .fetchSchedule(typed.payload as string)
        .then((data) => store.dispatch(scheduleFetchSuccess(data)))
        .catch((err: Error) => store.dispatch(scheduleFetchError(err.message)));
      break;

    case CONFIG_FETCH_REQUESTED:
      store.dispatch(configFetchStart());
      api
        .fetchConfig()
        .then((data) => {
          store.dispatch(configFetchSuccess(data));
          const name = data.defaultName;
          const people = store.getState().planning.people ?? [];
          if (name && people.some((p) => p.name === name)) {
            store.dispatch(selectionAdd(name));
          }
        })
        .catch((err: Error) => store.dispatch(configFetchError(err.message)));
      break;

    case CONFIG_UPDATE_REQUESTED:
      store.dispatch(configUpdateStart());
      api
        .updateConfig(typed.payload as Partial<Config>)
        .then((data) => {
          store.dispatch(configUpdateSuccess(data));
          const month = store.getState().schedule.month;
          if (month) store.dispatch(scheduleFetchRequested(month));
        })
        .catch((err: Error) => store.dispatch(configUpdateError(err.message)));
      break;
  }

  return next(action);
};
