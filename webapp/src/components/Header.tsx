import { useState } from 'react';
import { useSelector } from 'react-redux';
import { keycloak } from '../auth/keycloak';
import type { RootState } from '../store/types';
import { ConfigModal } from './ConfigModal';
import { PersonDropdown } from './PersonDropdown';
import { UploadButton } from './UploadButton';

export function Header() {
  const fileName = useSelector((state: RootState) => state.config.config.fileName);
  const username = useSelector((state: RootState) => state.auth.username);
  const authEnabled = keycloak.isEnabled();
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <header className="border-b border-slate-200 bg-white px-4 py-3">
      <div className="grid grid-cols-3 items-center gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-800">Planning Espoir</h1>
          {fileName && <p className="text-xs text-slate-400">{fileName}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <PersonDropdown />
          <UploadButton />
          <button
            type="button"
            onClick={() => setConfigOpen(true)}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Config
          </button>
        </div>
        <div className="flex items-center justify-end gap-2">
          {username && <span className="text-sm text-slate-700">{username}</span>}
          <button
            type="button"
            onClick={() => keycloak.signout()}
            disabled={!authEnabled}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Signout
          </button>
        </div>
      </div>
      <ConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
    </header>
  );
}
