import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { EngineAction } from '../engine/actions.ts';
import { tournamentReducer } from '../engine/reducer.ts';
import { createEmptyState, type TournamentState } from '../engine/state.ts';
import {
  createTransport,
  type ConnectionStatus,
  type DispatchOptions,
  type PresenceMeta,
  type StateEnvelope,
  type TournamentTransport,
} from '../services/transport/index.ts';
import { appEnv } from './ControlProvider.tsx';

export type AppTransport = TournamentTransport<TournamentState, EngineAction>;

interface TransportContextValue {
  transport: AppTransport;
  envelope: StateEnvelope<TournamentState> | null;
  /** True once the first hydrate attempt finished (envelope may still be null = not found). */
  hydrated: boolean;
  status: ConnectionStatus;
  peers: PresenceMeta[];
  connectError: string | null;
}

const TransportContext = createContext<TransportContextValue | null>(null);

// ---------------------------------------------------------------- shared transport cache
// One transport per tournament, ref-counted, disconnected shortly after the last
// consumer unmounts (survives StrictMode double-mounting and quick route changes).
interface CacheEntry {
  transport: Promise<AppTransport>;
  connected: Promise<void>;
  refs: number;
  timer: ReturnType<typeof setTimeout> | null;
}
const cache = new Map<string, CacheEntry>();

function acquire(tournamentId: string): CacheEntry {
  let entry = cache.get(tournamentId);
  if (!entry) {
    const transport = createTransport<TournamentState, EngineAction>(
      { tournamentId, reducer: tournamentReducer, createInitialState: createEmptyState },
      appEnv,
    );
    entry = { transport, connected: transport.then((t) => t.connect()), refs: 0, timer: null };
    entry.connected.catch(() => undefined);
    cache.set(tournamentId, entry);
  }
  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = null;
  entry.refs++;
  return entry;
}

function release(tournamentId: string) {
  const entry = cache.get(tournamentId);
  if (!entry) return;
  entry.refs--;
  if (entry.refs > 0) return;
  entry.timer = setTimeout(() => {
    cache.delete(tournamentId);
    void entry.transport.then((t) => t.disconnect()).catch(() => undefined);
  }, 2000);
}

/** Provides the realtime transport + live snapshot of one tournament to its subtree. */
export function TournamentScope({ tournamentId, children }: { tournamentId: string; children: ReactNode }) {
  return (
    <ScopeInner key={tournamentId} tournamentId={tournamentId}>
      {children}
    </ScopeInner>
  );
}

function ScopeInner({ tournamentId, children }: { tournamentId: string; children: ReactNode }) {
  const [transport, setTransport] = useState<AppTransport | null>(null);
  const [envelope, setEnvelope] = useState<StateEnvelope<TournamentState> | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [peers, setPeers] = useState<PresenceMeta[]>([]);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let offs: (() => void)[] = [];
    const entry = acquire(tournamentId);
    const flush = () => void entry.transport.then((t) => t.flush());
    window.addEventListener('pagehide', flush);

    entry.transport
      .then((t) => {
        if (cancelled) return;
        setTransport(t);
        offs = [t.onStateSync(setEnvelope), t.onStatusChange(setStatus), t.onPresenceChange(setPeers)];
        return entry.connected.then(
          () => !cancelled && setHydrated(true),
          (err: unknown) => {
            if (cancelled) return;
            setHydrated(true);
            setConnectError(err instanceof Error ? err.message : String(err));
          },
        );
      })
      .catch((err: unknown) => !cancelled && setConnectError(err instanceof Error ? err.message : String(err)));

    return () => {
      cancelled = true;
      offs.forEach((off) => off());
      window.removeEventListener('pagehide', flush);
      release(tournamentId);
    };
  }, [tournamentId]);

  if (!transport) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg-primary text-sm text-text-muted">
        {connectError ? `Failed to start: ${connectError}` : 'Connecting...'}
      </div>
    );
  }

  return (
    <TransportContext.Provider value={{ transport, envelope, hydrated, status, peers, connectError }}>
      {children}
    </TransportContext.Provider>
  );
}

export function useTransportContext(): TransportContextValue {
  const ctx = useContext(TransportContext);
  if (!ctx) throw new Error('useTransportContext must be used inside <TournamentScope>');
  return ctx;
}

/** Optional variant for components that render both inside and outside a scope. */
export function useOptionalTransportContext(): TransportContextValue | null {
  return useContext(TransportContext);
}

export function useTournamentState(): TournamentState | null {
  const { envelope } = useTransportContext();
  return envelope?.state.meta ? envelope.state : null;
}

export function useDispatch() {
  const { transport } = useTransportContext();
  return useCallback(
    (action: EngineAction, options?: DispatchOptions) =>
      transport.dispatch(action, options).catch((err: unknown) => {
        console.error('[dispatch] failed', action.type, err);
        throw err;
      }),
    [transport],
  );
}
