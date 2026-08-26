import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import { createTestStore } from '../test/store';
import type { RootState } from '../store/types';
import { ConfigModal } from './ConfigModal';

function makeState(overrides: Partial<RootState> = {}): RootState {
  return {
    planning: {
      status: 'loaded',
      people: [
        { name: 'TAUZIN Caroline', role: 'ES -1 ETP', colorIndex: 0, weeks: [] },
        { name: 'Nathalie Simakha', role: 'TISF 1 ETP /36', colorIndex: 1, weeks: [] },
      ],
      warnings: [],
      error: null,
    },
    schedule: {
      status: 'loaded',
      month: '2026-08',
      days: {},
      mondayWeeks: null,
      error: null,
    },
    selection: { names: [] },
    config: {
      status: 'loaded',
      config: { startDate: '2026-07-27', defaultNames: [], fileName: null },
      error: null,
    },
    colors: { palette: ['#ff0000'] },
    auth: { status: 'loaded', username: null, error: null },
    ...overrides,
  };
}

describe('ConfigModal', () => {
  it('shows the current start date as the selected Monday', () => {
    const store = createTestStore(makeState());
    render(
      <Provider store={store}>
        <ConfigModal open onClose={() => {}} />
      </Provider>,
    );
    expect(
      screen.getByText('La semaine 1 correspond à la semaine du lundi 27 juillet 2026'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lundi 27 juillet/i })).toBeInTheDocument();
  });

  it('proposes the people list in the default names multi-select', async () => {
    const user = userEvent.setup();
    const store = createTestStore(makeState());
    render(
      <Provider store={store}>
        <ConfigModal open onClose={() => {}} />
      </Provider>,
    );

    expect(screen.getByText('Noms par défaut')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Personnes (0)' }));

    expect(screen.getByRole('checkbox', { name: 'TAUZIN Caroline' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Nathalie Simakha' })).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'TAUZIN Caroline' }));
    await user.click(screen.getByRole('checkbox', { name: 'Nathalie Simakha' }));
    expect(screen.getByRole('button', { name: 'Personnes (2)' })).toBeInTheDocument();
  });

  it('navigates months and lists the Mondays of the displayed month', async () => {
    const user = userEvent.setup();
    const store = createTestStore(makeState());
    render(
      <Provider store={store}>
        <ConfigModal open onClose={() => {}} />
      </Provider>,
    );

    // displayed month starts at the month of the current startDate (July 2026)
    expect(screen.getByText('juillet 2026')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mois suivant' }));
    expect(screen.getByText('août 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lundi 3 août/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lundi 31 août/i })).toBeInTheDocument();
  });

  it('updates the label when a Monday is selected', async () => {
    const user = userEvent.setup();
    const store = createTestStore(makeState());
    render(
      <Provider store={store}>
        <ConfigModal open onClose={() => {}} />
      </Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'Mois suivant' }));
    await user.click(screen.getByRole('button', { name: /lundi 10 août/i }));
    expect(
      screen.getByText('La semaine 1 correspond à la semaine du lundi 10 août 2026'),
    ).toBeInTheDocument();
  });
});
