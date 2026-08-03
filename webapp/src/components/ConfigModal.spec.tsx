import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { describe, expect, it } from 'vitest';
import { rootReducer } from '../store/reducers';
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
      error: null,
    },
    selection: { names: [] },
    config: { status: 'loaded', config: { startDate: '2026-07-27', defaultName: null, fileName: null }, error: null },
    colors: { palette: ['#ff0000'] },
    ...overrides,
  };
}

describe('ConfigModal', () => {
  it('shows the current start date as the selected Monday', () => {
    const store = createStore(rootReducer, makeState());
    render(
      <Provider store={store}>
        <ConfigModal open onClose={() => {}} />
      </Provider>,
    );
    expect(screen.getByText('La semaine 1 correspond à la semaine du lundi 27 juillet 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lundi 27 juillet/i })).toBeInTheDocument();
  });

  it('proposes the people list in the default name dropdown', async () => {
    const user = userEvent.setup();
    const store = createStore(rootReducer, makeState());
    render(
      <Provider store={store}>
        <ConfigModal open onClose={() => {}} />
      </Provider>,
    );

    const dropdown = screen.getByRole('button', { name: /nom par défaut/i });
    await user.click(dropdown);

    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByText('TAUZIN Caroline')).toBeInTheDocument();
    expect(within(listbox).getByText('Nathalie Simakha')).toBeInTheDocument();
  });

  it('navigates months and lists the Mondays of the displayed month', async () => {
    const user = userEvent.setup();
    const store = createStore(rootReducer, makeState());
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
    const store = createStore(rootReducer, makeState());
    render(
      <Provider store={store}>
        <ConfigModal open onClose={() => {}} />
      </Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'Mois suivant' }));
    await user.click(screen.getByRole('button', { name: /lundi 10 août/i }));
    expect(screen.getByText('La semaine 1 correspond à la semaine du lundi 10 août 2026')).toBeInTheDocument();
  });
});
