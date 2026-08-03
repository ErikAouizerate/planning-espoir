import { useRef } from 'react';
import { useDispatch } from 'react-redux';
import { planningUploadRequested } from '../store/actions';

export function UploadButton() {
  const dispatch = useDispatch();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Importer un planning
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) dispatch(planningUploadRequested(file));
          e.target.value = '';
        }}
      />
    </>
  );
}
