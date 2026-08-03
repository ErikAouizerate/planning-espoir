import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from '../store/reducers';
import type { RootState } from '../store/types';

export function createTestStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState: preloadedState as RootState | undefined,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({ thunk: false }),
  });
}
