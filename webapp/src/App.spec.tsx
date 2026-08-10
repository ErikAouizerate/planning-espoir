import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import App from './App';
import { createTestStore } from './test/store';
import type { RootState } from './store/types';

function makeState(overrides: Partial<RootState> = {}): RootState {
  return {
    planning: {
      status: 'loaded',
      people: [],
      warnings: [],
      error: null,
    },
    schedule: {
      status: 'loaded',
      month: '2026-08',
      days: {},
      sundayWeeks: null,
      error: null,
    },
    selection: { names: [] },
    config: {
      status: 'loaded',
      config: { startDate: null, defaultNames: [], fileName: null },
      error: null,
    },
    colors: { palette: ['#ff0000'] },
    auth: { status: 'loaded', username: null, error: null },
    ...overrides,
  };
}

describe('App', () => {
  it('renders a discreet warnings banner when the planning has warnings', () => {
    const warning = { week: 1, row: 6, column: 'B', value: '9?30' };
    const store = createTestStore(
      makeState({
        planning: { status: 'loaded', people: [], warnings: [warning], error: null },
      }),
    );
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );
    expect(
      screen.getByText('Attention : quelques cellules non reconnues ont été ignorées'),
    ).toBeInTheDocument();
    expect(screen.getByText('S1 B6 : 9?30')).toBeInTheDocument();
  });

  it('renders the schedule error banner when the schedule fetch failed', () => {
    const store = createTestStore(
      makeState({
        schedule: {
          status: 'error',
          month: '',
          days: null,
          sundayWeeks: null,
          error: 'Schedule fetch failed',
        },
      }),
    );
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );
    expect(screen.getByText('Schedule fetch failed')).toBeInTheDocument();
  });

  it('renders the config error banner when the config fetch failed', () => {
    const store = createTestStore(
      makeState({
        config: {
          status: 'error',
          config: { startDate: null, defaultNames: [], fileName: null },
          error: 'Config fetch failed',
        },
      }),
    );
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );
    expect(screen.getByText('Config fetch failed')).toBeInTheDocument();
  });
});
