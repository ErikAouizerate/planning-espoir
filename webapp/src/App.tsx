import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Header } from './components/Header';
import { Legend } from './components/Legend';
import { MonthCalendar } from './components/MonthCalendar';
import { configFetchRequested, planningFetchRequested, scheduleFetchRequested } from './store/actions';
import type { RootState } from './store/types';
import { currentMonthKey } from './utils/dates';

export default function App() {
  const dispatch = useDispatch();
  const planning = useSelector((state: RootState) => state.planning);

  useEffect(() => {
    dispatch(planningFetchRequested());
    dispatch(configFetchRequested());
    dispatch(scheduleFetchRequested(currentMonthKey()));
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-4">
        {planning.status === 'error' && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {planning.error}
          </div>
        )}
        {planning.status === 'loading' && <p className="text-slate-500">Chargement…</p>}
        {planning.status === 'loaded' && planning.people?.length === 0 && (
          <p className="text-slate-500">Aucun planning. Importez un fichier Excel pour commencer.</p>
        )}
        {planning.status === 'loaded' && planning.people && planning.people.length > 0 && (
          <>
            <MonthCalendar />
            <Legend />
          </>
        )}
      </main>
    </div>
  );
}
