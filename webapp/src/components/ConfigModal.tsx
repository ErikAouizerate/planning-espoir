import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useClickOutside } from '../hooks/useClickOutside';
import { configUpdateRequested } from '../store/actions';
import type { RootState } from '../store/types';
import { formatFullDate, mondaysInMonth, monthLabel, shiftMonth } from '../utils/dates';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ConfigModal({ open, onClose }: Props) {
  const dispatch = useDispatch();
  const config = useSelector((state: RootState) => state.config.config);
  const people = useSelector((state: RootState) => state.planning.people) ?? [];

  const [startDate, setStartDate] = useState<string | null>(null);
  const [defaultName, setDefaultName] = useState('');
  const [month, setMonth] = useState('');
  const [nameOpen, setNameOpen] = useState(false);
  const nameRef = useRef<HTMLDivElement>(null);

  useClickOutside(nameRef, () => setNameOpen(false));

  useEffect(() => {
    if (open) {
      setStartDate(config.startDate);
      setDefaultName(config.defaultName ?? '');
      const initial = config.startDate?.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
      setMonth(initial);
      setNameOpen(false);
    }
  }, [open, config]);

  if (!open) return null;

  const mondays = mondaysInMonth(month);

  const selectMonday = (date: string) => {
    setStartDate(date);
    setMonth(date.slice(0, 7));
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-semibold text-slate-800">Configuration</h2>

        <div className="mt-4">
          <p className="text-sm font-medium text-slate-600">
            {startDate
              ? `La semaine 1 correspond à la semaine du ${formatFullDate(startDate)}`
              : 'La semaine 1 correspond à la semaine du …'}
          </p>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              aria-label="Mois précédent"
              onClick={() => setMonth(shiftMonth(month, -1))}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            >
              ‹
            </button>
            <span className="text-sm font-medium text-slate-700">{monthLabel(month)}</span>
            <button
              type="button"
              aria-label="Mois suivant"
              onClick={() => setMonth(shiftMonth(month, 1))}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            >
              ›
            </button>
          </div>

          <div className="mt-2 flex max-h-48 flex-col gap-1 overflow-auto">
            {mondays.map((monday) => {
              const selected = monday === startDate;
              return (
                <button
                  key={monday}
                  type="button"
                  onClick={() => selectMonday(monday)}
                  className={`rounded border px-3 py-1.5 text-left text-sm ${
                    selected
                      ? 'border-blue-600 bg-blue-50 font-medium text-blue-700'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {formatFullDate(monday)}
                </button>
              );
            })}
          </div>
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-600">
          Nom par défaut
          <div className="relative mt-1" ref={nameRef}>
            <button
              type="button"
              onClick={() => setNameOpen((v) => !v)}
              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              {defaultName || 'Aucun'}
            </button>
            {nameOpen && (
              <ul
                role="listbox"
                className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded border border-slate-200 bg-white shadow-lg"
              >
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setDefaultName('');
                      setNameOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-50"
                  >
                    Aucun
                  </button>
                </li>
                {people.map((p) => (
                  <li key={p.name}>
                    <button
                      type="button"
                      onClick={() => {
                        setDefaultName(p.name);
                        setNameOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
                        defaultName === p.name ? 'font-medium text-blue-700' : 'text-slate-700'
                      }`}
                    >
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
