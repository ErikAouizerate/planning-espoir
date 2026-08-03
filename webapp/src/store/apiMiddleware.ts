import type { Middleware } from "redux";
import * as api from "../api/client";
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
  selectionToggle,
} from "./actions";
import type { RootState } from "./types";

export const apiMiddleware: Middleware<object, RootState> =
  (store) => (next) => (action) => {
    const typed = action as { type: string; payload?: unknown };

    switch (typed.type) {
      case PLANNING_FETCH_REQUESTED:
        store.dispatch({ type: PLANNING_FETCH_START });
        api
          .fetchPlanning()
          .then((data) =>
            store.dispatch({ type: PLANNING_FETCH_SUCCESS, payload: data }),
          )
          .catch((err: Error) =>
            store.dispatch({ type: PLANNING_FETCH_ERROR, error: err.message }),
          );
        break;

      case PLANNING_UPLOAD_REQUESTED:
        store.dispatch({ type: PLANNING_UPLOAD_START });
        api
          .uploadPlanning(typed.payload as File)
          .then((data) => {
            store.dispatch({ type: PLANNING_UPLOAD_SUCCESS, payload: data });
            store.dispatch({ type: CONFIG_FETCH_REQUESTED });
            const month = store.getState().schedule.month;
            if (month)
              store.dispatch({
                type: SCHEDULE_FETCH_REQUESTED,
                payload: month,
              });
          })
          .catch((err: Error) =>
            store.dispatch({ type: PLANNING_UPLOAD_ERROR, error: err.message }),
          );
        break;

      case SCHEDULE_FETCH_REQUESTED:
        store.dispatch({
          type: SCHEDULE_FETCH_START,
          payload: typed.payload as string,
        });
        api
          .fetchSchedule(typed.payload as string)
          .then((data) =>
            store.dispatch({ type: SCHEDULE_FETCH_SUCCESS, payload: data }),
          )
          .catch((err: Error) =>
            store.dispatch({ type: SCHEDULE_FETCH_ERROR, error: err.message }),
          );
        break;

      case CONFIG_FETCH_REQUESTED:
        store.dispatch({ type: CONFIG_FETCH_START });
        api
          .fetchConfig()
          .then((data) => {
            store.dispatch(selectionToggle(data.defaultName ?? ""));
            store.dispatch({ type: CONFIG_FETCH_SUCCESS, payload: data });
          })
          .catch((err: Error) =>
            store.dispatch({ type: CONFIG_FETCH_ERROR, error: err.message }),
          );
        break;

      case CONFIG_UPDATE_REQUESTED:
        store.dispatch({ type: CONFIG_UPDATE_START });
        api
          .updateConfig(
            typed.payload as Partial<{
              startDate: string | null;
              defaultName: string | null;
            }>,
          )
          .then((data) => {
            store.dispatch({ type: CONFIG_UPDATE_SUCCESS, payload: data });
            const month = store.getState().schedule.month;
            if (month)
              store.dispatch({
                type: SCHEDULE_FETCH_REQUESTED,
                payload: month,
              });
          })
          .catch((err: Error) =>
            store.dispatch({ type: CONFIG_UPDATE_ERROR, error: err.message }),
          );
        break;
    }

    return next(action);
  };
