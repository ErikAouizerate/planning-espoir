import { describe, expect, it } from 'vitest';
import { planningFetchRequested, scheduleFetchRequested, selectionToggle } from './actions';
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

  it('records a fetch error on the planning slice', () => {
    const store = configureStore();
    store.dispatch(planningFetchRequested());
    // middleware runs asynchronously against real fetch in Node? no — provide no server;
    // assert at least the synchronous transition happens through a reducer-only action
    store.dispatch({ type: 'PLANNING_FETCH_ERROR', error: 'boom' });
    expect(store.getState().planning.status).toBe('error');
    expect(store.getState().planning.error).toBe('boom');
  });

  it('handles schedule fetch requested without crashing', () => {
    const store = configureStore();
    store.dispatch(scheduleFetchRequested('2026-08'));
    expect(store.getState().schedule.status).toBe('loading');
  });
});
