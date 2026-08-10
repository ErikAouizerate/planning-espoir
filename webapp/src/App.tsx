import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Header } from './components/Header';
import { Legend } from './components/Legend';
import { MonthCalendar } from './components/MonthCalendar';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';
import {
  authFetchRequested,
  configFetchRequested,
  planningFetchRequested,
  scheduleFetchRequested,
} from './store/actions';
import type { RootState } from './store/types';
import { currentMonthKey } from './utils/dates';

export default function App() {
  const dispatch = useDispatch();
  const planning = useSelector((state: RootState) => state.planning);
  const schedule = useSelector((state: RootState) => state.schedule);
  const config = useSelector((state: RootState) => state.config);

  useEffect(() => {
    dispatch(planningFetchRequested());
    dispatch(scheduleFetchRequested(currentMonthKey()));
    dispatch(authFetchRequested());
  }, [dispatch]);

  useEffect(() => {
    dispatch(configFetchRequested());
  }, [planning.people?.length]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-4">
        {planning.status === 'error' && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {planning.error}
          </div>
        )}
        {schedule.status === 'error' && schedule.error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {schedule.error}
          </div>
        )}
        {config.status === 'error' && config.error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {config.error}
          </div>
        )}
        {planning.status === 'loaded' && planning.warnings.length > 0 && (
          <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <p>Attention : quelques cellules non reconnues ont été ignorées</p>
            <ul className="mt-1 list-disc pl-5">
              {planning.warnings.map((warning) => (
                <li key={`${warning.week}-${warning.column}-${warning.row}`}>
                  S{warning.week} {warning.column}
                  {warning.row} : {warning.value}
                </li>
              ))}
            </ul>
          </div>
        )}
        {planning.status === 'loading' && <p className="text-slate-500">Chargement…</p>}
        {planning.status === 'loaded' && planning.people?.length === 0 && (
          <p className="text-slate-500">
            Aucun planning. Importez un fichier Excel pour commencer.
          </p>
        )}
        {planning.status === 'loaded' && planning.people && planning.people.length > 0 && (
          <>
            <MonthCalendar />
            <Legend />
          </>
        )}
      </main>
      <PWAUpdatePrompt />
    </div>
  );
}
