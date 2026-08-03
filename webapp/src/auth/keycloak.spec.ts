import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  kcInit: vi.fn(),
  kcLogin: vi.fn(),
  kcLogout: vi.fn(),
  kcToken: vi.fn(),
  kcTokenParsed: vi.fn(),
}));

vi.mock('keycloak-js', () => ({
  default: vi.fn(function () {
    return {
      init: mocks.kcInit,
      login: mocks.kcLogin,
      logout: mocks.kcLogout,
      get token() {
        return mocks.kcToken();
      },
      get tokenParsed() {
        return mocks.kcTokenParsed();
      },
    };
  }),
}));

describe('keycloak wrapper', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_AUTH_ENABLED', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is disabled and uses the mock user when auth is disabled', async () => {
    const { keycloak } = await import('./keycloak');
    expect(keycloak.isEnabled()).toBe(false);
    expect(keycloak.getUsername()).toBe('test-user');
    expect(keycloak.getToken()).toBeNull();
    keycloak.signout();
    keycloak.login();
    expect(mocks.kcLogout).not.toHaveBeenCalled();
    expect(mocks.kcLogin).not.toHaveBeenCalled();
  });

  it('initializes keycloak with onLoad login-required and reads the username when enabled', async () => {
    vi.stubEnv('VITE_AUTH_ENABLED', 'true');
    mocks.kcInit.mockResolvedValue(undefined);
    mocks.kcToken.mockReturnValue('abc.def.ghi');
    mocks.kcTokenParsed.mockReturnValue({ preferred_username: 'admin@example.com' });
    const { keycloak } = await import('./keycloak');
    expect(keycloak.isEnabled()).toBe(true);
    await keycloak.init();
    expect(mocks.kcInit).toHaveBeenCalledWith({ onLoad: 'login-required' });
    expect(keycloak.getToken()).toBe('abc.def.ghi');
    expect(keycloak.getUsername()).toBe('admin@example.com');
  });

  it('starts the keycloak login flow when enabled', async () => {
    vi.stubEnv('VITE_AUTH_ENABLED', 'true');
    const { keycloak } = await import('./keycloak');
    keycloak.login();
    expect(mocks.kcLogin).toHaveBeenCalled();
  });
});
