import type { DayCell as DayCellModel } from '@planning-espoir/shared';
import { colorFor } from '../colors';

interface Props {
  cell: DayCellModel;
  colorIndex: number;
  palette: string[];
}

export function DayCell({ cell, colorIndex, palette }: Props) {
  const color = colorFor(colorIndex, palette);
  if (cell.type === 'none') return null;
  if (cell.type === 'off') {
    return (
      <span
        className="inline-block rounded px-1 py-0.5 text-[9px] font-medium text-white sm:px-1.5 sm:text-xs"
        style={{ backgroundColor: color }}
        title={cell.label}
      >
        {cell.label}
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      {cell.slots.map((slot, i) => (
        <span
          key={i}
          className="inline-block rounded px-1 py-0.5 text-[9px] font-medium text-white sm:px-1.5 sm:text-xs"
          style={{ backgroundColor: color }}
        >
          {slot.start}–{slot.end}
        </span>
      ))}
    </div>
  );
}
