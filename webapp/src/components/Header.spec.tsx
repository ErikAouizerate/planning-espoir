import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';
import { createTestStore } from '../test/store';
import type { RootState } from '../store/types';
import { Header } from './Header';

const enabledMock = vi.hoisted(() => vi.fn());

vi.mock('../auth/keycloak', () => ({
  keycloak: { isEnabled: () => enabledMock(), signout: vi.fn() },
}));

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
    auth: { status: 'loaded', username: null, error: null },
    ...overrides,
  };
}

describe('Header', () => {
  it('shows the uploaded file name', () => {
    render(
      <Provider store={createTestStore(makeState())}>
        <Header />
      </Provider>,
    );
    expect(screen.getByText('Planning.xlsx')).toBeInTheDocument();
  });

  it('shows the connected username', () => {
    enabledMock.mockReturnValue(true);
    render(
      <Provider
        store={createTestStore(
          makeState({ auth: { status: 'loaded', username: 'admin@example.com', error: null } }),
        )}
      >
        <Header />
      </Provider>,
    );
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
  });

  it('disables the Signout button in mock mode', () => {
    enabledMock.mockReturnValue(false);
    render(
      <Provider store={createTestStore(makeState())}>
        <Header />
      </Provider>,
    );
    expect(screen.getByRole('button', { name: 'Signout' })).toBeDisabled();
  });
});
