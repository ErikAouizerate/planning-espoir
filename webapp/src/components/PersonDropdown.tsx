import { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useClickOutside } from '../hooks/useClickOutside';
import { selectionToggle } from '../store/actions';
import type { RootState } from '../store/types';

export function PersonDropdown() {
  const dispatch = useDispatch();
  const people = useSelector((state: RootState) => state.planning.people) ?? [];
  const selection = useSelector((state: RootState) => state.selection.names);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false));

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        Personnes ({selection.length})
      </button>
      {open && (
        <div className="absolute z-10 mt-1 max-h-64 w-64 overflow-auto rounded border border-slate-200 bg-white shadow-lg">
          {people.map((p) => (
            <label key={p.name} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selection.includes(p.name)}
                onChange={() => dispatch(selectionToggle(p.name))}
              />
              {p.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
