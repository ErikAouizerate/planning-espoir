import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configFetchRequested,
  configUpdateRequested,
  planningUploadRequested,
  scheduleFetchRequested,
  scheduleFetchStart,
} from './actions';
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
        JSON.stringify({
          startDate: '2026-07-27',
          defaultNames: ['TAUZIN Caroline'],
          fileName: null,
        }),
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

  it('does not select anything when the default names are empty', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ startDate: null, defaultNames: [], fileName: null }), {
        status: 200,
      }),
    );

    const store = configureStore();
    store.dispatch(configFetchRequested());

    await vi.waitFor(() => {
      expect(store.getState().selection.names).toEqual([]);
    });
  });

  it('keeps the default user selected when a second config fetch resolves', async () => {
    const fetchMock = vi.mocked(fetch);
    const configBody = () =>
      new Response(
        JSON.stringify({
          startDate: '2026-07-27',
          defaultNames: ['TAUZIN Caroline'],
          fileName: null,
        }),
        { status: 200 },
      );
    fetchMock.mockResolvedValueOnce(configBody()).mockResolvedValueOnce(configBody());

    const store = configureStore();
    store.dispatch({
      type: 'PLANNING_FETCH_SUCCESS',
      payload: {
        startDate: '2026-07-27',
        people: [{ name: 'TAUZIN Caroline', role: 'R', colorIndex: 0, weeks: [] }],
        warnings: [],
      },
    });

    // Simulates StrictMode double-invocation of the config fetch effect
    store.dispatch(configFetchRequested());
    store.dispatch(configFetchRequested());

    await vi.waitFor(() => {
      expect(store.getState().selection.names).toEqual(['TAUZIN Caroline']);
    });
  });

  it('selects all default names present in the planning after a config fetch', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          startDate: '2026-07-27',
          defaultNames: ['TAUZIN Caroline', 'BOB Dylan', 'Inconnu'],
          fileName: null,
        }),
        { status: 200 },
      ),
    );

    const store = configureStore();
    store.dispatch({
      type: 'PLANNING_FETCH_SUCCESS',
      payload: {
        startDate: '2026-07-27',
        people: [
          { name: 'TAUZIN Caroline', role: 'R', colorIndex: 0, weeks: [] },
          { name: 'BOB Dylan', role: 'R', colorIndex: 1, weeks: [] },
        ],
        warnings: [],
      },
    });

    store.dispatch(configFetchRequested());

    await vi.waitFor(() => {
      expect(store.getState().selection.names).toEqual(['TAUZIN Caroline', 'BOB Dylan']);
    });
  });

  it('does not change the selection after a config update', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          startDate: '2026-07-27',
          defaultNames: ['BOB Dylan'],
          fileName: null,
        }),
        { status: 200 },
      ),
    );

    const store = configureStore();
    store.dispatch(configUpdateRequested({ defaultNames: ['BOB Dylan'] }));

    await vi.waitFor(() => {
      expect(store.getState().config.config.defaultNames).toEqual(['BOB Dylan']);
    });
    expect(store.getState().selection.names).toEqual([]);
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
      new Response(JSON.stringify({ startDate: '2026-07-27', defaultNames: [] }), { status: 200 }),
    );
    // 3-5. schedule refetch after upload (previous, current and next month)
    for (const month of ['2026-07', '2026-08', '2026-09']) {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ month, days: {}, mondayWeeks: {} }), { status: 200 }),
      );
    }

    const store = configureStore();
    // seed the displayed month so the schedule refetch fires
    store.dispatch(scheduleFetchStart('2026-08'));

    store.dispatch(planningUploadRequested(new File(['x'], 'planning.xlsx')));

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(5);
    });

    const configRequests = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/api/planning/config'),
    );
    expect(configRequests).toHaveLength(1);

    await vi.waitFor(() => {
      expect(store.getState().config.config.startDate).toBe('2026-07-27');
    });
  });

  it('fetches the previous, current and next month schedules and merges them', async () => {
    const fetchMock = vi.mocked(fetch);
    const monthBody = (month: string, dayKey: string) =>
      new Response(
        JSON.stringify({ month, days: { [dayKey]: [] }, mondayWeeks: { [dayKey]: 1 } }),
        { status: 200 },
      );
    fetchMock
      .mockResolvedValueOnce(monthBody('2026-07', '2026-07-27'))
      .mockResolvedValueOnce(monthBody('2026-08', '2026-08-03'))
      .mockResolvedValueOnce(monthBody('2026-09', '2026-08-31'));

    const store = configureStore();
    store.dispatch(scheduleFetchRequested('2026-08'));

    await vi.waitFor(() => {
      expect(store.getState().schedule.status).toBe('loaded');
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toContain('/api/planning/schedule?month=2026-07');
    expect(urls).toContain('/api/planning/schedule?month=2026-08');
    expect(urls).toContain('/api/planning/schedule?month=2026-09');

    const schedule = store.getState().schedule;
    expect(schedule.month).toBe('2026-08');
    expect(Object.keys(schedule.days ?? {})).toEqual(['2026-07-27', '2026-08-03', '2026-08-31']);
    expect(schedule.mondayWeeks).toEqual({
      '2026-07-27': 1,
      '2026-08-03': 1,
      '2026-08-31': 1,
    });
  });

  it('dispatches a schedule error when any of the three month fetches fails', async () => {
    const fetchMock = vi.mocked(fetch);
    const okBody = (month: string) =>
      new Response(JSON.stringify({ month, days: {}, mondayWeeks: {} }), { status: 200 });
    fetchMock
      .mockResolvedValueOnce(okBody('2026-07'))
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(okBody('2026-09'));

    const store = configureStore();
    store.dispatch(scheduleFetchRequested('2026-08'));

    await vi.waitFor(() => {
      expect(store.getState().schedule.status).toBe('error');
    });
    expect(store.getState().schedule.error).toBe('boom');
  });
});
