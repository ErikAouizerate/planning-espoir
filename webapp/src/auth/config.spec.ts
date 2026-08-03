import { beforeEach, describe, expect, it } from 'vitest';

describe('authConfig', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('reads values from import.meta.env with defaults', async () => {
    vi.stubEnv('VITE_AUTH_ENABLED', 'false');
    vi.stubEnv('VITE_KEYCLOAK_URL', 'http://kc.test');
    vi.stubEnv('VITE_KEYCLOAK_REALM', 'demo');
    vi.stubEnv('VITE_KEYCLOAK_CLIENT_ID', 'app');
    const { authConfig } = await import('./config');
    expect(authConfig.enabled).toBe(false);
    expect(authConfig.url).toBe('http://kc.test');
    expect(authConfig.realm).toBe('demo');
    expect(authConfig.clientId).toBe('app');
    vi.unstubAllEnvs();
  });

  it('applies defaults when env vars are absent', async () => {
    vi.stubEnv('VITE_AUTH_ENABLED', '');
    vi.stubEnv('VITE_KEYCLOAK_URL', '');
    vi.stubEnv('VITE_KEYCLOAK_REALM', '');
    vi.stubEnv('VITE_KEYCLOAK_CLIENT_ID', '');
    const { authConfig } = await import('./config');
    expect(authConfig.enabled).toBe(true);
    expect(authConfig.url).toBe('http://localhost:8080');
    expect(authConfig.realm).toBe('gateway');
    expect(authConfig.clientId).toBe('gateway');
    vi.unstubAllEnvs();
  });
});
