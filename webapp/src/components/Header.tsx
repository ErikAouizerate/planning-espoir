import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { scheduleFetchRequested } from '../store/actions';
import type { RootState } from '../store/types';
import { monthLabel, shiftMonth } from '../utils/dates';
import { ConfigModal } from './ConfigModal';
import { PersonDropdown } from './PersonDropdown';
import { UploadButton } from './UploadButton';

export function Header() {
  const dispatch = useDispatch();
  const month = useSelector((state: RootState) => state.schedule.month);
  const fileName = useSelector((state: RootState) => state.config.config.fileName);
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Planning Espoir</h1>
        {fileName && <p className="text-xs text-slate-400">{fileName}</p>}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => dispatch(scheduleFetchRequested(shiftMonth(month, -1)))}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          aria-label="Mois précédent"
        >
          ‹
        </button>
        <span className="min-w-28 text-center text-sm font-medium text-slate-700">{monthLabel(month)}</span>
        <button
          type="button"
          onClick={() => dispatch(scheduleFetchRequested(shiftMonth(month, 1)))}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          aria-label="Mois suivant"
        >
          ›
        </button>
      </div>
      <PersonDropdown />
      <UploadButton />
      <button
        type="button"
        onClick={() => setConfigOpen(true)}
        className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        Config
      </button>
      <ConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
    </header>
  );
}
