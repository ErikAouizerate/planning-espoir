import { useSelector } from 'react-redux';
import { monthGrid, weekdayLabel } from '../utils/dates';
import type { RootState } from '../store/types';
import { DayCell } from './DayCell';

export function MonthCalendar() {
  const month = useSelector((state: RootState) => state.schedule.month);
  const days = useSelector((state: RootState) => state.schedule.days);
  const selection = useSelector((state: RootState) => state.selection.names);
  const palette = useSelector((state: RootState) => state.colors.palette);

  if (!days) return null;
  const grid = monthGrid(month);

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-7 min-w-[700px]">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="border-b border-slate-200 px-2 py-1 text-center text-xs font-semibold text-slate-500">
            {weekdayLabel(i)}
          </div>
        ))}
        {grid.flat().map((date, idx) => {
          const personDays = date ? (days[date] ?? []).filter((pd) => selection.includes(pd.name)) : [];
          return (
            <div
              key={idx}
              className="min-h-24 border-b border-slate-100 p-1"
              data-testid={date ? `day-${date}` : undefined}
            >
              {date && <div className="text-xs text-slate-400">{Number(date.slice(8, 10))}</div>}
              <div className="mt-1 flex flex-col gap-0.5">
                {personDays.map((pd) => (
                  <DayCell key={pd.name} cell={pd.cell} colorIndex={pd.colorIndex} palette={palette} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
