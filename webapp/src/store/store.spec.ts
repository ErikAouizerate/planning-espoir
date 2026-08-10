import { describe, expect, it } from 'vitest';
import {
  planningFetchError,
  scheduleFetchRequested,
  scheduleFetchSuccess,
  selectionAdd,
  selectionToggle,
} from './actions';
import { configureStore } from './store';

describe('store', () => {
  it('starts with an empty default state', () => {
    const store = configureStore();
    const state = store.getState();
    expect(state.planning.status).toBe('idle');
    expect(state.planning.people).toBeNull();
    expect(state.selection.names).toEqual([]);
    expect(state.colors.palette).toHaveLength(10);
  });

  it('toggles person selection preserving order', () => {
    const store = configureStore();
    store.dispatch(selectionToggle('A'));
    store.dispatch(selectionToggle('B'));
    store.dispatch(selectionToggle('A'));
    expect(store.getState().selection.names).toEqual(['B']);
  });

  it('adds a person without removing it on repeated adds', () => {
    const store = configureStore();
    store.dispatch(selectionAdd('A'));
    store.dispatch(selectionAdd('A'));
    store.dispatch(selectionAdd('B'));
    expect(store.getState().selection.names).toEqual(['A', 'B']);
  });

  it('records a fetch error on the planning slice', () => {
    const store = configureStore();
    store.dispatch(planningFetchError('boom'));
    expect(store.getState().planning.status).toBe('error');
    expect(store.getState().planning.error).toBe('boom');
  });

  it('handles schedule fetch requested without crashing', () => {
    const store = configureStore();
    store.dispatch(scheduleFetchRequested('2026-08'));
    expect(store.getState().schedule.status).toBe('loading');
  });

  it('stores sundayWeeks on schedule fetch success', () => {
    const store = configureStore();
    store.dispatch(
      scheduleFetchSuccess({ month: '2026-08', days: {}, sundayWeeks: { '2026-08-02': 1 } }),
    );
    expect(store.getState().schedule.sundayWeeks).toEqual({ '2026-08-02': 1 });
  });

  it('starts with an empty auth state', () => {
    const store = configureStore();
    expect(store.getState().auth).toEqual({ status: 'idle', username: null, error: null });
  });
});
