import { BaseTransport, type PersistResult } from './BaseTransport.ts';
import type { LiveEvent, PresenceMeta, StateEnvelope, TransportConfig } from './types.ts';

type LoopbackMessage<S> =
  | { kind: 'state'; envelope: StateEnvelope<S> }
  | { kind: 'live'; event: LiveEvent }
  | { kind: 'presence'; meta: PresenceMeta }
  | { kind: 'leave'; clientId: string };

const HEARTBEAT_MS = 2000;
const PEER_TTL_MS = 6000;

/**
 * Zero-backend fallback used when Supabase credentials are not configured:
 * syncs tabs of the same browser via BroadcastChannel and persists to localStorage.
 * Lets every route render and be developed before Milestone 2 credentials exist.
 */
export class LoopbackTransport<S, A> extends BaseTransport<S, A> {
  readonly mode = 'loopback' as const;

  private channel: BroadcastChannel | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private readonly remotePeers = new Map<string, { meta: PresenceMeta; seenAt: number }>();
  private readonly storageKey: string;

  constructor(config: TransportConfig<S, A>) {
    super(config);
    this.storageKey = `darts.loopback.${config.tournamentId}`;
  }

  protected async doConnect(): Promise<void> {
    this.acceptRemoteEnvelope(this.readStorage());
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(this.storageKey);
      this.channel.onmessage = (e: MessageEvent<LoopbackMessage<S>>) => this.handle(e.data);
    }
    this.setStatus('connected');
    this.post({ kind: 'presence', meta: this.presence });
    this.heartbeat = setInterval(() => {
      this.post({ kind: 'presence', meta: this.presence });
      this.refreshPeers();
    }, HEARTBEAT_MS);
    this.refreshPeers();
  }

  protected async doDisconnect(): Promise<void> {
    this.post({ kind: 'leave', clientId: this.clientId });
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    this.channel?.close();
    this.channel = null;
  }

  private handle(msg: LoopbackMessage<S>) {
    switch (msg.kind) {
      case 'state':
        this.acceptRemoteEnvelope(msg.envelope);
        break;
      case 'live':
        this.deliverLiveEvent(msg.event);
        break;
      case 'presence':
        this.remotePeers.set(msg.meta.clientId, { meta: msg.meta, seenAt: Date.now() });
        this.refreshPeers();
        break;
      case 'leave':
        this.remotePeers.delete(msg.clientId);
        this.refreshPeers();
        break;
    }
  }

  private refreshPeers() {
    const now = Date.now();
    for (const [id, p] of this.remotePeers) if (now - p.seenAt > PEER_TTL_MS) this.remotePeers.delete(id);
    this.setPeers([this.presence, ...Array.from(this.remotePeers.values(), (p) => p.meta)]);
  }

  private post(msg: LoopbackMessage<S>) {
    this.channel?.postMessage(msg);
  }

  private readStorage(): StateEnvelope<S> | null {
    try {
      const raw = globalThis.localStorage?.getItem(this.storageKey);
      return raw ? (JSON.parse(raw) as StateEnvelope<S>) : null;
    } catch {
      return null;
    }
  }

  protected async publishState(envelope: StateEnvelope<S>): Promise<void> {
    this.post({ kind: 'state', envelope });
  }

  protected async persistState(envelope: StateEnvelope<S>): Promise<PersistResult<S>> {
    try {
      globalThis.localStorage?.setItem(this.storageKey, JSON.stringify(envelope));
    } catch (err) {
      console.warn('[loopback] localStorage write failed', err);
    }
    return { ok: true };
  }

  protected async doAppendThrowLog(): Promise<void> {
    // Throw logs live inside the snapshot in loopback mode.
  }

  protected async publishLiveEvent(event: LiveEvent): Promise<void> {
    this.post({ kind: 'live', event });
    this.deliverLiveEvent(event); // self-delivery, matching Supabase `self: true`
  }

  protected async publishPresence(meta: PresenceMeta): Promise<void> {
    this.post({ kind: 'presence', meta });
    this.refreshPeers();
  }

  protected async doMeasureLatency(): Promise<number> {
    return 0;
  }
}
