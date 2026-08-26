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
import { shiftMonth } from '../utils/dates';

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

    case SCHEDULE_FETCH_REQUESTED: {
      const month = typed.payload as string;
      store.dispatch(scheduleFetchStart(month));
      Promise.all(
        [shiftMonth(month, -1), month, shiftMonth(month, 1)].map((m) => api.fetchSchedule(m)),
      )
        .then(([prev, cur, next]) =>
          store.dispatch(
            scheduleFetchSuccess({
              month,
              days: { ...prev.days, ...cur.days, ...next.days },
              mondayWeeks: { ...prev.mondayWeeks, ...cur.mondayWeeks, ...next.mondayWeeks },
            }),
          ),
        )
        .catch((err: Error) => store.dispatch(scheduleFetchError(err.message)));
      break;
    }

    case CONFIG_FETCH_REQUESTED:
      store.dispatch(configFetchStart());
      api
        .fetchConfig()
        .then((data) => {
          store.dispatch(configFetchSuccess(data));
          const people = store.getState().planning.people ?? [];
          for (const name of data.defaultNames) {
            if (people.some((p) => p.name === name)) {
              store.dispatch(selectionAdd(name));
            }
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
