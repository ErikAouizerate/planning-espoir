import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configFetchRequested, planningUploadRequested, scheduleFetchStart } from './actions';
import { configureStore } from './store';

describe('apiMiddleware', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('selects the default config user after a config fetch', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ startDate: '2026-07-27', defaultName: 'TAUZIN Caroline', fileName: null }),
        { status: 200 },
      ),
    );

    const store = configureStore();
    store.dispatch({
      type: 'PLANNING_FETCH_SUCCESS',
      payload: {
        startDate: '2026-07-27',
        people: [{ name: 'TAUZIN Caroline', role: 'R', colorIndex: 0, weeks: [] }],
        warnings: [],
      },
    });

    store.dispatch(configFetchRequested());

    await vi.waitFor(() => {
      expect(store.getState().selection.names).toContain('TAUZIN Caroline');
    });
  });

  it('does not select anything when the default name is null', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ startDate: null, defaultName: null, fileName: null }), {
        status: 200,
      }),
    );

    const store = configureStore();
    store.dispatch(configFetchRequested());

    await vi.waitFor(() => {
      expect(store.getState().selection.names).toEqual([]);
    });
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
      new Response(JSON.stringify({ startDate: '2026-07-27', defaultName: null }), { status: 200 }),
    );
    // 3. schedule fetch after upload
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ month: '2026-08', days: {} }), { status: 200 }),
    );

    const store = configureStore();
    // seed the displayed month so the schedule refetch fires
    store.dispatch(scheduleFetchStart('2026-08'));

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
