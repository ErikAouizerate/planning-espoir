import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planningUploadRequested } from './actions';
import { configureStore } from './store';

describe('apiMiddleware', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refetches config after a successful planning upload', async () => {
    const fetchMock = vi.mocked(fetch);

    // 1. uploadPlanning -> POST /api/planning
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          startDate: '2026-07-27',
          people: [],
          warnings: [],
        }),
        { status: 200 },
      ),
    );
    // 2. config refetch (dispatched before the schedule refetch)
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ startDate: '2026-07-27', defaultName: null }),
        { status: 200 },
      ),
    );
    // 3. schedule fetch after upload
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ month: '2026-08', days: {} }), { status: 200 }),
    );

    const store = configureStore();
    // seed the displayed month so the schedule refetch fires
    store.dispatch({ type: 'SCHEDULE_FETCH_START', payload: '2026-08' });

    store.dispatch(planningUploadRequested(new File(['x'], 'planning.xlsx')));

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    const configRequests = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/api/planning/config'),
    );
    expect(configRequests).toHaveLength(1);

    await vi.waitFor(() => {
      expect(store.getState().config.config.startDate).toBe('2026-07-27');
    });
  });
});
