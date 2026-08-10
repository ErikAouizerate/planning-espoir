import { useDispatch, useSelector } from 'react-redux';
import { monthGrid, monthLabel, shiftMonth, todayKey, weekdayLabel } from '../utils/dates';
import { scheduleFetchRequested } from '../store/actions';
import type { RootState } from '../store/types';
import { DayCell } from './DayCell';

export function MonthCalendar() {
  const dispatch = useDispatch();
  const month = useSelector((state: RootState) => state.schedule.month);
  const days = useSelector((state: RootState) => state.schedule.days);
  const sundayWeeks = useSelector((state: RootState) => state.schedule.sundayWeeks);
  const selection = useSelector((state: RootState) => state.selection.names);
  const palette = useSelector((state: RootState) => state.colors.palette);
  const today = todayKey();

  if (!days) return null;
  const grid = monthGrid(month);

  return (
    <div>
      <div className="mb-2 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => dispatch(scheduleFetchRequested(shiftMonth(month, -1)))}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          aria-label="Mois précédent"
        >
          ‹
        </button>
        <h2 className="font-display text-center text-lg font-semibold text-slate-800">
          {monthLabel(month)}
        </h2>
        <button
          type="button"
          onClick={() => dispatch(scheduleFetchRequested(shiftMonth(month, 1)))}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          aria-label="Mois suivant"
        >
          ›
        </button>
      </div>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              className="border-b border-r border-slate-200 bg-slate-50 px-1 py-1 text-center text-[10px] font-semibold text-slate-500 sm:px-2 sm:text-xs"
            >
              {weekdayLabel(i)}
            </div>
          ))}
          {grid.flat().map((date, idx) => {
            const personDays = date
              ? (days[date] ?? []).filter((pd) => selection.includes(pd.name))
              : [];
            const isLastCol = idx % 7 === 6;
            const isToday = date === today;
            return (
              <div
                key={idx}
                className={`min-h-20 border-b p-0.5 sm:min-h-24 sm:p-1 ${
                  isToday ? 'bg-blue-200' : ''
                } ${isLastCol ? 'border-slate-200' : 'border-r border-b border-slate-200'}`}
                data-testid={date ? `day-${date}` : undefined}
              >
                {date && (
                  <div className="flex items-baseline justify-between text-[10px] text-slate-400 sm:text-xs">
                    <span>{Number(date.slice(8, 10))}</span>
                    {sundayWeeks?.[date] !== undefined && <span>S{sundayWeeks[date]}</span>}
                  </div>
                )}
                <div className="mt-0.5 flex flex-col gap-0.5 sm:mt-1">
                  {personDays.map((pd) => (
                    <DayCell
                      key={pd.name}
                      cell={pd.cell}
                      colorIndex={pd.colorIndex}
                      palette={palette}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
