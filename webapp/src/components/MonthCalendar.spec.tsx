import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { createTestStore } from '../test/store';
import { todayKey } from '../utils/dates';
import type { RootState } from '../store/types';
import { MonthCalendar } from './MonthCalendar';

function makeState(overrides: Partial<RootState> = {}): RootState {
  return {
    planning: {
      status: 'loaded',
      people: [
        { name: 'A', role: 'R', colorIndex: 0, weeks: [] },
        { name: 'B', role: 'R', colorIndex: 1, weeks: [] },
      ],
      warnings: [],
      error: null,
    },
    schedule: {
      status: 'loaded',
      month: '2026-08',
      days: {
        '2026-08-03': [
          {
            name: 'A',
            colorIndex: 0,
            cell: { type: 'shift', slots: [{ start: '09:00', end: '13:00' }] },
          },
          { name: 'B', colorIndex: 1, cell: { type: 'off', label: 'rh' } },
        ],
      },
      sundayWeeks: null,
      error: null,
    },
    selection: { names: ['A', 'B'] },
    config: {
      status: 'loaded',
      config: { startDate: '2026-07-27', defaultNames: [], fileName: null },
      error: null,
    },
    colors: { palette: ['#ff0000', '#00ff00'] },
    auth: { status: 'loaded', username: null, error: null },
    ...overrides,
  };
}

describe('MonthCalendar', () => {
  it('renders weekday headers', () => {
    render(
      <Provider store={createTestStore(makeState())}>
        <MonthCalendar />
      </Provider>,
    );
    expect(screen.getByText('Lun')).toBeInTheDocument();
    expect(screen.getByText('Dim')).toBeInTheDocument();
  });

  it('renders selected people day cells with shift times and off badge', () => {
    const store = createTestStore(makeState());
    render(
      <Provider store={store}>
        <MonthCalendar />
      </Provider>,
    );
    expect(screen.getByText('09:00–13:00')).toBeInTheDocument();
    expect(screen.getByText('rh')).toBeInTheDocument();
  });

  it('shows the displayed month and year above the grid', () => {
    render(
      <Provider store={createTestStore(makeState())}>
        <MonthCalendar />
      </Provider>,
    );
    expect(screen.getByRole('heading', { name: 'août 2026' })).toBeInTheDocument();
  });

  it('renders previous and next month navigation buttons', () => {
    const store = createTestStore(makeState());
    render(
      <Provider store={store}>
        <MonthCalendar />
      </Provider>,
    );
    expect(screen.getByRole('button', { name: 'Mois précédent' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mois suivant' })).toBeInTheDocument();
  });

  it('renders S{n} in Sunday cells and nothing in other cells', () => {
    render(
      <Provider
        store={createTestStore(
          makeState({
            schedule: {
              status: 'loaded',
              month: '2026-08',
              days: {},
              sundayWeeks: { '2026-08-02': 1, '2026-08-09': 2 },
              error: null,
            },
          }),
        )}
      >
        <MonthCalendar />
      </Provider>,
    );
    expect(screen.getByTestId('day-2026-08-02')).toHaveTextContent('S1');
    expect(screen.getByTestId('day-2026-08-09')).toHaveTextContent('S2');
    expect(screen.getByTestId('day-2026-08-01')).not.toHaveTextContent('S');
    expect(screen.getByTestId('day-2026-08-03')).not.toHaveTextContent('S');
  });

  it('highlights the current day cell with a distinct background', () => {
    const today = todayKey();
    const [year, month] = today.split('-');
    render(
      <Provider
        store={createTestStore(
          makeState({
            schedule: {
              status: 'loaded',
              month: `${year}-${month}`,
              days: {},
              sundayWeeks: null,
              error: null,
            },
          }),
        )}
      >
        <MonthCalendar />
      </Provider>,
    );
    const cell = document.querySelector(`[data-testid="day-${today}"]`);
    expect(cell).toBeInTheDocument();
    expect(cell?.className).toContain('bg-blue-200');
  });
});
