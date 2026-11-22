/**
 * Pluggable realtime transport contract.
 * All state sync, presence and live events go through TournamentTransport so the
 * UI never knows whether it is talking to Supabase, the LAN relay, or a loopback.
 */

export type TransportMode = 'supabase' | 'local' | 'loopback';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

export type ClientRole = 'admin' | 'scorer' | 'stage' | 'guest' | 'board-map' | 'print';

export type Unsubscribe = () => void;

/** Versioned, persisted snapshot of the whole tournament. */
export interface StateEnvelope<S> {
  tournamentId: string;
  /** Monotonic; incremented by every dispatched action. */
  version: number;
  /** UTC epoch ms of the mutation (also used as deterministic tie-breaker). */
  updatedAt: number;
  originClientId: string;
  state: S;
}

/** Ephemeral, non-persisted broadcast (dart hits, card slams, wheel spins, soundboard...). */
export interface LiveEvent<P = unknown> {
  id: string;
  type: string;
  payload: P;
  /** UTC epoch ms at sender. */
  sentAt: number;
  originClientId: string;
}

export interface PresenceMeta {
  clientId: string;
  role: ClientRole;
  /** True once a scorer/admin session is unlocked (drives the multi-scorer intrusion alert). */
  unlocked: boolean;
  /** Scorer PIN version the client unlocked with (kickout on mismatch). */
  pinVersion: number | null;
  label?: string;
  joinedAt: number;
}

/** Append-only per-dart log row; the full DartThrow type is defined by the engine (Milestone 2/3). */
export interface ThrowLogEntry {
  id: string;
  matchId: string;
  timestamp: number;
  [key: string]: unknown;
}

export type PersistPolicy = 'immediate' | 'debounced' | 'none';

export interface DispatchOptions {
  /** Defaults to 'debounced'. Use 'immediate' on visit / match completion. */
  persist?: PersistPolicy;
}

export interface ConnectOptions {
  presence?: Partial<Omit<PresenceMeta, 'clientId' | 'joinedAt'>>;
}

export interface TournamentTransport<S, A> {
  readonly mode: TransportMode;
  readonly clientId: string;
  readonly tournamentId: string;

  connect(options?: ConnectOptions): Promise<void>;
  disconnect(): Promise<void>;

  /** Apply action locally via the pure reducer, broadcast the new snapshot, persist per policy. */
  dispatch(action: A, options?: DispatchOptions): Promise<StateEnvelope<S>>;
  /** Fire-and-forget live event delivered to every connected client (including the sender). */
  emitLiveEvent<P>(type: string, payload: P): Promise<void>;
  /** Persist append-only dart throw logs (requires an authorized session token). */
  appendThrowLog(entries: ThrowLogEntry[]): Promise<void>;

  onStateSync(cb: (envelope: StateEnvelope<S>) => void): Unsubscribe;
  onLiveEvent(cb: (event: LiveEvent) => void): Unsubscribe;
  onPresenceChange(cb: (peers: PresenceMeta[]) => void): Unsubscribe;
  onStatusChange(cb: (status: ConnectionStatus) => void): Unsubscribe;

  updatePresence(meta: Partial<Omit<PresenceMeta, 'clientId' | 'joinedAt'>>): Promise<void>;
  /** Round-trip time in ms through the realtime backbone. */
  measureLatency(): Promise<number>;

  getSnapshot(): StateEnvelope<S> | null;
  getStatus(): ConnectionStatus;
  getPresence(): PresenceMeta[];

  /** Session token returned by admin / scorer auth RPCs; required for persisted writes. */
  setAuthToken(token: string | null): void;
  /** Force any pending debounced persistence to run now. */
  flush(): Promise<void>;
}

export type Reducer<S, A> = (state: S, action: A) => S;

export interface TransportConfig<S, A> {
  tournamentId: string;
  reducer: Reducer<S, A>;
  createInitialState: () => S;
  /** Debounce window for 'debounced' persistence (ms). */
  persistDebounceMs?: number;
}
