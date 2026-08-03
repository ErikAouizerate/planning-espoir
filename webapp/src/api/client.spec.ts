import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAuthMe, fetchPlanning, fetchSchedule } from './client';

const tokenMock = vi.hoisted(() => vi.fn());
vi.mock('../auth/keycloak', () => ({
  keycloak: { getToken: () => tokenMock() },
}));

describe('api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
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
});
