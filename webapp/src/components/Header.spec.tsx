import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { createTestStore } from '../test/store';
import type { RootState } from '../store/types';
import { Header } from './Header';

function makeState(overrides: Partial<RootState> = {}): RootState {
  return {
    planning: {
      status: 'loaded',
      people: [{ name: 'A', role: 'R', colorIndex: 0, weeks: [] }],
      warnings: [],
      error: null,
    },
    schedule: {
      status: 'loaded',
      month: '2026-08',
      days: {},
      error: null,
    },
    selection: { names: [] },
    config: {
      status: 'loaded',
      config: { startDate: '2026-07-27', defaultName: null, fileName: 'Planning.xlsx' },
      error: null,
    },
    colors: { palette: ['#ff0000'] },
    ...overrides,
  };
}

describe('Header', () => {
  it('shows the displayed month as a French label', () => {
    render(
      <Provider store={createTestStore(makeState())}>
        <Header />
      </Provider>,
    );
    expect(screen.getByText('août 2026')).toBeInTheDocument();
  });

  it('shows the uploaded file name', () => {
    render(
      <Provider store={createTestStore(makeState())}>
        <Header />
      </Provider>,
    );
    expect(screen.getByText('Planning.xlsx')).toBeInTheDocument();
  });
});
