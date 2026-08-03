import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  kcInit: vi.fn().mockResolvedValue(undefined),
  kcIsEnabled: vi.fn(),
}));

vi.mock('./auth/keycloak', () => ({
  keycloak: {
    init: () => mocks.kcInit(),
    isEnabled: () => mocks.kcIsEnabled(),
    getToken: () => null,
    getUsername: () => 'test-user',
    login: () => undefined,
    signout: () => undefined,
  },
}));

describe('app entry', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    vi.resetModules();
    mocks.kcInit.mockClear();
    mocks.kcIsEnabled.mockReset();
  });

  it('mounts the app directly without keycloak init when auth is disabled', async () => {
    mocks.kcIsEnabled.mockReturnValue(false);
    await import('./main');
    expect(await screen.findByRole('heading', { name: 'Planning Espoir' })).toBeInTheDocument();
    expect(mocks.kcInit).not.toHaveBeenCalled();
  });

  it('awaits keycloak init before mounting when auth is enabled', async () => {
    mocks.kcIsEnabled.mockReturnValue(true);
    await import('./main');
    expect(mocks.kcInit).toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Planning Espoir' })).toBeInTheDocument();
  });
});
