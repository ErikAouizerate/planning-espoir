import { useSelector } from 'react-redux';
import { colorFor } from '../colors';
import type { RootState } from '../store/types';

export function Legend() {
  const people = useSelector((state: RootState) => state.planning.people);
  const selection = useSelector((state: RootState) => state.selection.names);
  const palette = useSelector((state: RootState) => state.colors.palette);

  const selected = (people ?? []).filter((p) => selection.includes(p.name));
  if (selected.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-3">
      {selected.map((p) => (
        <span key={p.name} className="inline-flex items-center gap-1.5 text-sm text-slate-700">
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: colorFor(p.colorIndex, palette) }} />
          {p.name}
        </span>
      ))}
    </div>
  );
}
