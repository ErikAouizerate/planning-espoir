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
    vi.stubEnv('VITE_GATEWAY_URL', 'http://gateway.test');
    vi.stubEnv('VITE_APP_GROUP', 'app-other');
    const { authConfig } = await import('./config');
    expect(authConfig.enabled).toBe(false);
    expect(authConfig.url).toBe('http://kc.test');
    expect(authConfig.realm).toBe('demo');
    expect(authConfig.clientId).toBe('app');
    expect(authConfig.gatewayUrl).toBe('http://gateway.test');
    expect(authConfig.appGroup).toBe('app-other');
    vi.unstubAllEnvs();
  });

  it('applies defaults when env vars are absent', async () => {
    vi.stubEnv('VITE_AUTH_ENABLED', '');
    vi.stubEnv('VITE_KEYCLOAK_URL', '');
    vi.stubEnv('VITE_KEYCLOAK_REALM', '');
    vi.stubEnv('VITE_KEYCLOAK_CLIENT_ID', '');
    vi.stubEnv('VITE_GATEWAY_URL', '');
    vi.stubEnv('VITE_APP_GROUP', '');
    const { authConfig } = await import('./config');
    expect(authConfig.enabled).toBe(true);
    expect(authConfig.url).toBe('http://localhost:8080');
    expect(authConfig.realm).toBe('gateway');
    expect(authConfig.clientId).toBe('gateway');
    expect(authConfig.gatewayUrl).toBe('http://localhost:5173');
    expect(authConfig.appGroup).toBe('app-planning-espoir');
    vi.unstubAllEnvs();
  });
});
