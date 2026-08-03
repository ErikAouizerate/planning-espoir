import { configureStore as rtkConfigureStore } from '@reduxjs/toolkit';
import type { Middleware } from 'redux';
import { createLogger } from 'redux-logger';
import { apiMiddleware } from './apiMiddleware';
import { rootReducer } from './reducers';
import type { RootState } from './types';

const middlewares: Middleware<object, RootState>[] = [apiMiddleware];

if (import.meta.env.MODE === 'development') {
  middlewares.push(
    createLogger({
      collapsed: true,
    }) as Middleware<object, RootState>,
  );
}

export function configureStore() {
  return rtkConfigureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: false }).concat(middlewares),
  });
}

export type AppStore = ReturnType<typeof configureStore>;
export type { RootState };
