import { useRegisterSW } from 'virtual:pwa-register/react';

export function PWAUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      if (r) {
        setInterval(
          () => {
            r.update();
          },
          60 * 60 * 1000,
        );
      }
    },
    onRegisterError(error: unknown) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) {
    return null;
  }

  return (
    <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className="flex w-full max-w-sm items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
        <div className="flex-1 text-sm text-slate-700">
          {offlineReady ? (
            <span>Application prête pour une utilisation hors ligne</span>
          ) : (
            <span>Nouveau contenu disponible, cliquez sur Recharger pour mettre à jour.</span>
          )}
        </div>
        <div className="flex gap-2">
          {needRefresh && (
            <button
              type="button"
              onClick={() => updateServiceWorker(true)}
              className="rounded border border-slate-300 bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
            >
              Recharger
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
