import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createControlApi, type ControlApi } from '../services/control/index.ts';
import { sessionStore } from '../services/control/sessionStore.ts';
import { readTransportEnv, type ResolvedTransportEnv } from '../services/transport/index.ts';

interface ControlContextValue {
  api: ControlApi;
  env: ResolvedTransportEnv;
  /** Tournament every stage / scorer / guest device follows. undefined = still loading. */
  activeTournamentId: string | null | undefined;
  refreshActive: () => Promise<void>;
  hostToken: string | null;
  setHostToken: (token: string | null) => void;
}

const ControlContext = createContext<ControlContextValue | null>(null);

export const appEnv = readTransportEnv();
let apiPromise: Promise<ControlApi> | null = null;

export function ControlProvider({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<ControlApi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTournamentId, setActive] = useState<string | null | undefined>(undefined);
  const [hostToken, setHostTokenState] = useState<string | null>(() => sessionStore.getHostToken());

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    apiPromise ??= createControlApi(appEnv);
    apiPromise
      .then((a) => {
        if (cancelled) return;
        setApi(a);
        unsubscribe = a.subscribeActiveTournament((id) => setActive(id));
        return a.getActiveTournamentId().then((id) => !cancelled && setActive(id));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.warn('[control] failed to load active tournament', err);
        setError(err instanceof Error ? err.message : String(err));
        setActive(null);
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const setHostToken = useCallback((token: string | null) => {
    sessionStore.setHostToken(token);
    setHostTokenState(token);
  }, []);

  const refreshActive = useCallback(async () => {
    if (api) setActive(await api.getActiveTournamentId());
  }, [api]);

  if (!api) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg-primary p-6 text-center text-sm text-text-muted">
        {error ? `Could not reach the server: ${error}` : 'Connecting...'}
      </div>
    );
  }

  return (
    <ControlContext.Provider value={{ api, env: appEnv, activeTournamentId, refreshActive, hostToken, setHostToken }}>
      {children}
    </ControlContext.Provider>
  );
}

export function useControl(): ControlContextValue {
  const ctx = useContext(ControlContext);
  if (!ctx) throw new Error('useControl must be used inside <ControlProvider>');
  return ctx;
}

/** Tournament for display routes: `?t=<id>` pins one explicitly, otherwise follow the live one. */
export function useLiveTournamentId(): string | null | undefined {
  const { activeTournamentId } = useControl();
  const [params] = useSearchParams();
  const pinned = params.get('t');
  return pinned && /^[A-Za-z0-9_-]{1,64}$/.test(pinned) ? pinned : activeTournamentId;
}
