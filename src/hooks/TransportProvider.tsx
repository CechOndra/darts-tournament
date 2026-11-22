import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { EngineAction } from '../engine/actions.ts';
import { tournamentReducer } from '../engine/reducer.ts';
import { createEmptyState, type TournamentState } from '../engine/state.ts';
import {
  createTransport,
  readTransportEnv,
  type ConnectionStatus,
  type PresenceMeta,
  type ResolvedTransportEnv,
  type StateEnvelope,
  type TournamentTransport,
} from '../services/transport/index.ts';

export type AppTransport = TournamentTransport<TournamentState, EngineAction>;

interface TransportContextValue {
  transport: AppTransport;
  env: ResolvedTransportEnv;
  envelope: StateEnvelope<TournamentState> | null;
  status: ConnectionStatus;
  peers: PresenceMeta[];
  connectError: string | null;
}

const TransportContext = createContext<TransportContextValue | null>(null);

const env = readTransportEnv();

// One transport per page load (survives React StrictMode double-mounting).
let transportPromise: Promise<AppTransport> | null = null;
let connectPromise: Promise<void> | null = null;

function loadTransport(): Promise<AppTransport> {
  transportPromise ??= createTransport<TournamentState, EngineAction>(
    { reducer: tournamentReducer, createInitialState: createEmptyState },
    env,
  );
  return transportPromise;
}

export function TransportProvider({ children }: { children: ReactNode }) {
  const [transport, setTransport] = useState<AppTransport | null>(null);
  const [envelope, setEnvelope] = useState<StateEnvelope<TournamentState> | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [peers, setPeers] = useState<PresenceMeta[]>([]);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let offs: (() => void)[] = [];
    const flush = () => void transportPromise?.then((t) => t.flush());
    window.addEventListener('pagehide', flush);

    loadTransport()
      .then((t) => {
        if (cancelled) return;
        setTransport(t);
        offs = [t.onStateSync(setEnvelope), t.onStatusChange(setStatus), t.onPresenceChange(setPeers)];
        connectPromise ??= t.connect();
        connectPromise.catch((err: unknown) => {
          if (!cancelled) setConnectError(err instanceof Error ? err.message : String(err));
        });
      })
      .catch((err: unknown) => !cancelled && setConnectError(err instanceof Error ? err.message : String(err)));

    return () => {
      cancelled = true;
      offs.forEach((off) => off());
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  if (!transport) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg-primary text-sm text-text-muted">
        {connectError ? `Failed to start: ${connectError}` : 'Connecting...'}
      </div>
    );
  }

  return (
    <TransportContext.Provider value={{ transport, env, envelope, status, peers, connectError }}>
      {children}
    </TransportContext.Provider>
  );
}

export function useTransportContext(): TransportContextValue {
  const ctx = useContext(TransportContext);
  if (!ctx) throw new Error('useTransportContext must be used inside <TransportProvider>');
  return ctx;
}
