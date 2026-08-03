import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { describe, expect, it } from 'vitest';
import { rootReducer } from '../store/reducers';
import type { RootState } from '../store/types';
import { PersonDropdown } from './PersonDropdown';

function makeState(overrides: Partial<RootState> = {}): RootState {
  return {
    planning: {
      status: 'loaded',
      people: [{ name: 'A', role: 'R', colorIndex: 0, weeks: [] }],
      warnings: [],
      error: null,
    },
    schedule: { status: 'loaded', month: '2026-08', days: {}, error: null },
    selection: { names: [] },
    config: {
      status: 'loaded',
      config: { startDate: null, defaultName: null, fileName: null },
      error: null,
    },
    colors: { palette: ['#ff0000'] },
    ...overrides,
  };
}

describe('PersonDropdown', () => {
  it('closes when clicking outside the dropdown', async () => {
    const user = userEvent.setup();
    render(
      <Provider store={createStore(rootReducer, makeState())}>
        <div>
          <PersonDropdown />
          <button data-testid="outside">outside</button>
        </div>
      </Provider>,
    );

    await user.click(screen.getByRole('button', { name: /Personnes/i }));
    expect(screen.getByRole('checkbox')).toBeInTheDocument();

    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
