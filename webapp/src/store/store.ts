import { applyMiddleware, createStore } from 'redux';
import { apiMiddleware } from './apiMiddleware';
import { rootReducer } from './reducers';
import type { RootState } from './types';

export function configureStore() {
  return createStore(rootReducer, applyMiddleware(apiMiddleware));
}

export type AppStore = ReturnType<typeof configureStore>;
export type { RootState };
