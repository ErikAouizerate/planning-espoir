import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAuthMe, fetchPlanning, fetchSchedule } from './client';

const tokenMock = vi.hoisted(() => vi.fn());
const isEnabledMock = vi.hoisted(() => vi.fn());
const loginMock = vi.hoisted(() => vi.fn());
vi.mock('../auth/keycloak', () => ({
  keycloak: {
    getToken: () => tokenMock(),
    isEnabled: () => isEnabledMock(),
    login: () => loginMock(),
  },
}));

describe('api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    isEnabledMock.mockReset();
    loginMock.mockReset();
    tokenMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchPlanning calls GET /api/planning and returns JSON', async () => {
    const body = { startDate: null, people: [], warnings: [] };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    await expect(fetchPlanning()).resolves.toEqual(body);
    expect(fetch).toHaveBeenCalledWith('/api/planning', expect.any(Object));
  });

  it('fetchSchedule passes the month query parameter', async () => {
    const body = { month: '2026-08', days: {} };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    await expect(fetchSchedule('2026-08')).resolves.toEqual(body);
    expect(fetch).toHaveBeenCalledWith('/api/planning/schedule?month=2026-08', expect.any(Object));
  });

  it('prefixes API calls with VITE_API_BASE when configured', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_BASE', 'http://api.planning-espoir.localhost/api');
    const body = { startDate: null, people: [], warnings: [] };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    const { fetchPlanning: freshFetchPlanning } = await import('./client');
    await expect(freshFetchPlanning()).resolves.toEqual(body);
    expect(fetch).toHaveBeenCalledWith(
      'http://api.planning-espoir.localhost/api/planning',
      expect.any(Object),
    );
  });

  it('throws an Error with the server message on failure', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 404, message: 'No planning uploaded yet' }), {
        status: 404,
      }),
    );
    await expect(fetchPlanning()).rejects.toThrow('No planning uploaded yet');
  });

  it('attaches the Bearer token when present', async () => {
    tokenMock.mockReturnValue('token-123');
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ username: 'test-user' }), { status: 200 }),
    );
    await fetchAuthMe();
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe('/api/auth/me');
    expect((init?.headers as Headers).get('Authorization')).toBe('Bearer token-123');
  });

  it('triggers the keycloak login flow on a 401 when auth is enabled', async () => {
    isEnabledMock.mockReturnValue(true);
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 401, message: 'Unauthorized' }), { status: 401 }),
    );
    await expect(fetchPlanning()).rejects.toThrow('Unauthorized');
    expect(loginMock).toHaveBeenCalled();
  });

  it('does not trigger the keycloak login flow on a 401 when auth is disabled', async () => {
    isEnabledMock.mockReturnValue(false);
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 401, message: 'Unauthorized' }), { status: 401 }),
    );
    await expect(fetchPlanning()).rejects.toThrow('Unauthorized');
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('redirects to the gateway URL on a 403 when auth is enabled', async () => {
    vi.resetModules();
    isEnabledMock.mockReturnValue(true);
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 403, message: 'Forbidden' }), { status: 403 }),
    );
    const { fetchPlanning: freshFetchPlanning } = await import('./client');
    const assignSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, assign: assignSpy, href: originalLocation.href },
      writable: true,
    });
    try {
      await expect(freshFetchPlanning()).rejects.toThrow('Forbidden');
      expect(assignSpy).toHaveBeenCalledWith('http://localhost:5173');
    } finally {
      Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
    }
  });

  it('does not redirect on a 403 when auth is disabled', async () => {
    isEnabledMock.mockReturnValue(false);
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 403, message: 'Forbidden' }), { status: 403 }),
    );
    const assignSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, assign: assignSpy, href: originalLocation.href },
      writable: true,
    });
    try {
      await expect(fetchPlanning()).rejects.toThrow('Forbidden');
      expect(assignSpy).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
    }
  });
});
