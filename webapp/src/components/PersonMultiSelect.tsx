import { useRef, useState } from 'react';
import type { Person } from '@planning-espoir/shared';
import { useClickOutside } from '../hooks/useClickOutside';

interface Props {
  people: Person[];
  selected: string[];
  onToggle: (name: string) => void;
}

export function PersonMultiSelect({ people, selected, onToggle }: Props) {
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
        Personnes ({selected.length})
      </button>
      {open && (
        <div className="absolute z-10 mt-1 max-h-64 w-64 overflow-auto rounded border border-slate-200 bg-white shadow-lg">
          {people.map((p) => (
            <label
              key={p.name}
              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(p.name)}
                onChange={() => onToggle(p.name)}
              />
              {p.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
