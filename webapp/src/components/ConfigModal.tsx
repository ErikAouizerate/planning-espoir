import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { configUpdateRequested } from '../store/actions';
import type { RootState } from '../store/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ConfigModal({ open, onClose }: Props) {
  const dispatch = useDispatch();
  const config = useSelector((state: RootState) => state.config.config);
  const [startDate, setStartDate] = useState('');
  const [defaultName, setDefaultName] = useState('');

  useEffect(() => {
    if (open) {
      setStartDate(config.startDate ?? '');
      setDefaultName(config.defaultName ?? '');
    }
  }, [open, config]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-slate-800">Configuration</h2>
        <label className="mt-4 block text-sm font-medium text-slate-600">
          Date de début
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-slate-600">
          Nom par défaut
          <input
            type="text"
            value={defaultName}
            onChange={(e) => setDefaultName(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              dispatch(
                configUpdateRequested({
                  startDate: startDate || null,
                  defaultName: defaultName || null,
                }),
              );
              onClose();
            }}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
