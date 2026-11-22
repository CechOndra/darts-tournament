import { createId, getClientId } from './ids.ts';
import { isNewer } from './protocol.ts';
import type {
  ConnectionStatus,
  ConnectOptions,
  DispatchOptions,
  LiveEvent,
  PersistPolicy,
  PresenceMeta,
  StateEnvelope,
  ThrowLogEntry,
  TournamentTransport,
  TransportConfig,
  TransportMode,
  Unsubscribe,
} from './types.ts';

export type PersistResult<S> = { ok: true } | { ok: false; latest: StateEnvelope<S> | null; reason: string };

type PresenceInput = Partial<Omit<PresenceMeta, 'clientId' | 'joinedAt'>>;

/**
 * Shared, backend-agnostic transport logic: reducer application, version gating,
 * listener fan-out, ordered + debounced persistence. Concrete transports only
 * implement the wire-level hooks below.
 */
export abstract class BaseTransport<S, A> implements TournamentTransport<S, A> {
  abstract readonly mode: TransportMode;
  readonly clientId: string;
  readonly tournamentId: string;

  protected envelope: StateEnvelope<S> | null = null;
  protected status: ConnectionStatus = 'idle';
  protected peers: PresenceMeta[] = [];
  protected presence: PresenceMeta;
  protected authToken: string | null = null;

  private readonly stateListeners = new Set<(e: StateEnvelope<S>) => void>();
  private readonly liveListeners = new Set<(e: LiveEvent) => void>();
  private readonly presenceListeners = new Set<(p: PresenceMeta[]) => void>();
  private readonly statusListeners = new Set<(s: ConnectionStatus) => void>();

  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPersist: StateEnvelope<S> | null = null;
  private persistChain: Promise<void> = Promise.resolve();
  private readonly persistDebounceMs: number;

  protected constructor(
    protected readonly config: TransportConfig<S, A>,
    clientId: string = getClientId(),
  ) {
    this.clientId = clientId;
    this.tournamentId = config.tournamentId;
    this.persistDebounceMs = config.persistDebounceMs ?? 1200;
    this.presence = { clientId, role: 'guest', unlocked: false, pinVersion: null, joinedAt: Date.now() };
  }

  // ---------------------------------------------------------------- wire hooks
  protected abstract doConnect(): Promise<void>;
  protected abstract doDisconnect(): Promise<void>;
  /** Deliver a freshly dispatched snapshot to peers. */
  protected abstract publishState(envelope: StateEnvelope<S>): Promise<void>;
  protected abstract publishLiveEvent(event: LiveEvent): Promise<void>;
  protected abstract publishPresence(meta: PresenceMeta): Promise<void>;
  protected abstract doMeasureLatency(): Promise<number>;
  /** Durable storage write. Transports whose relay persists on publish return ok. */
  protected abstract persistState(envelope: StateEnvelope<S>): Promise<PersistResult<S>>;
  protected abstract doAppendThrowLog(entries: ThrowLogEntry[]): Promise<void>;

  // ---------------------------------------------------------------- lifecycle
  async connect(options?: ConnectOptions): Promise<void> {
    if (options?.presence) this.presence = { ...this.presence, ...options.presence };
    this.setStatus('connecting');
    try {
      await this.doConnect();
    } catch (err) {
      this.setStatus('error');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    await this.flush();
    await this.doDisconnect();
    this.setStatus('disconnected');
  }

  // ---------------------------------------------------------------- state
  async dispatch(action: A, options?: DispatchOptions): Promise<StateEnvelope<S>> {
    const base = this.envelope?.state ?? this.config.createInitialState();
    const nextState = this.config.reducer(base, action);
    const envelope: StateEnvelope<S> = {
      tournamentId: this.tournamentId,
      version: (this.envelope?.version ?? 0) + 1,
      updatedAt: Math.max(Date.now(), (this.envelope?.updatedAt ?? 0) + 1),
      originClientId: this.clientId,
      state: nextState,
    };
    this.adoptEnvelope(envelope);
    this.queuePersist(envelope, options?.persist ?? 'debounced');
    await this.publishState(envelope);
    return envelope;
  }

  /** Accept a snapshot from the network / storage if it is newer. Returns true if adopted. */
  protected acceptRemoteEnvelope(envelope: StateEnvelope<S> | null | undefined): boolean {
    if (!envelope || envelope.tournamentId !== this.tournamentId) return false;
    if (!isNewer(envelope, this.envelope)) return false;
    this.adoptEnvelope(envelope);
    return true;
  }

  /**
   * Accept a snapshot from the durable store / relay, which is authoritative:
   * it wins ties at the same version (resolves concurrent-dispatch races).
   */
  protected acceptAuthoritativeEnvelope(envelope: StateEnvelope<S> | null | undefined): boolean {
    if (!envelope || envelope.tournamentId !== this.tournamentId) return false;
    const current = this.envelope;
    if (current) {
      if (envelope.version < current.version) return false;
      if (
        envelope.version === current.version &&
        envelope.updatedAt === current.updatedAt &&
        envelope.originClientId === current.originClientId
      ) {
        return false;
      }
    }
    this.adoptEnvelope(envelope);
    return true;
  }

  /** Called after the durable store rejected our write (e.g. stale version). */
  protected onPersistRejected(): void {}

  private adoptEnvelope(envelope: StateEnvelope<S>) {
    this.envelope = envelope;
    for (const cb of this.stateListeners) cb(envelope);
  }

  getSnapshot(): StateEnvelope<S> | null {
    return this.envelope;
  }

  // ---------------------------------------------------------------- persistence
  private queuePersist(envelope: StateEnvelope<S>, policy: PersistPolicy) {
    if (policy === 'none') return;
    this.pendingPersist = envelope;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    if (policy === 'immediate') {
      void this.flush();
    } else {
      this.persistTimer = setTimeout(() => void this.flush(), this.persistDebounceMs);
    }
  }

  flush(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    const envelope = this.pendingPersist;
    this.pendingPersist = null;
    if (!envelope) return this.persistChain;
    this.persistChain = this.persistChain.then(async () => {
      try {
        const result = await this.persistState(envelope);
        if (!result.ok) {
          console.warn(`[transport] persist rejected (${result.reason})`);
          this.acceptAuthoritativeEnvelope(result.latest);
          this.onPersistRejected();
        }
      } catch (err) {
        console.error('[transport] persist failed', err);
      }
    });
    return this.persistChain;
  }

  setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  async appendThrowLog(entries: ThrowLogEntry[]): Promise<void> {
    if (entries.length) await this.doAppendThrowLog(entries);
  }

  // ---------------------------------------------------------------- live events
  async emitLiveEvent<P>(type: string, payload: P): Promise<void> {
    const event: LiveEvent<P> = { id: createId('evt'), type, payload, sentAt: Date.now(), originClientId: this.clientId };
    await this.publishLiveEvent(event);
  }

  protected deliverLiveEvent(event: LiveEvent) {
    for (const cb of this.liveListeners) cb(event);
  }

  // ---------------------------------------------------------------- presence
  async updatePresence(meta: PresenceInput): Promise<void> {
    this.presence = { ...this.presence, ...meta };
    if (this.status === 'connected') await this.publishPresence(this.presence);
  }

  protected setPeers(peers: PresenceMeta[]) {
    this.peers = [...peers].sort((a, b) => a.joinedAt - b.joinedAt);
    for (const cb of this.presenceListeners) cb(this.peers);
  }

  getPresence(): PresenceMeta[] {
    return this.peers;
  }

  // ---------------------------------------------------------------- status & latency
  protected setStatus(status: ConnectionStatus) {
    if (status === this.status) return;
    this.status = status;
    for (const cb of this.statusListeners) cb(status);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  measureLatency(): Promise<number> {
    return this.doMeasureLatency();
  }

  // ---------------------------------------------------------------- subscriptions
  onStateSync(cb: (envelope: StateEnvelope<S>) => void): Unsubscribe {
    this.stateListeners.add(cb);
    if (this.envelope) cb(this.envelope);
    return () => this.stateListeners.delete(cb);
  }

  onLiveEvent(cb: (event: LiveEvent) => void): Unsubscribe {
    this.liveListeners.add(cb);
    return () => this.liveListeners.delete(cb);
  }

  onPresenceChange(cb: (peers: PresenceMeta[]) => void): Unsubscribe {
    this.presenceListeners.add(cb);
    cb(this.peers);
    return () => this.presenceListeners.delete(cb);
  }

  onStatusChange(cb: (status: ConnectionStatus) => void): Unsubscribe {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }
}

/** Promise that rejects after `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
