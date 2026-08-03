import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPlanning, fetchSchedule } from './client';

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
    expect(fetch).toHaveBeenCalledWith('/api/planning', undefined);
  });

  it('fetchSchedule passes the month query parameter', async () => {
    const body = { month: '2026-08', days: {} };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    await expect(fetchSchedule('2026-08')).resolves.toEqual(body);
    expect(fetch).toHaveBeenCalledWith('/api/planning/schedule?month=2026-08', undefined);
  });

  it('throws an Error with the server message on failure', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 404, message: 'No planning uploaded yet' }), { status: 404 }),
    );
    await expect(fetchPlanning()).rejects.toThrow('No planning uploaded yet');
  });
});
