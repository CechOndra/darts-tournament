import { io, type Socket } from 'socket.io-client';
import { BaseTransport, withTimeout, type PersistResult } from './BaseTransport.ts';
import { createId } from './ids.ts';
import { SOCKET_EVENTS } from './protocol.ts';
import type { LiveEvent, PresenceMeta, StateEnvelope, ThrowLogEntry, TransportConfig } from './types.ts';

interface JoinAck<S> {
  envelope: StateEnvelope<S> | null;
  peers: PresenceMeta[];
}

interface PushAck<S> {
  ok: boolean;
  reason?: string;
  current?: StateEnvelope<S> | null;
}

export interface LocalSocketTransportOptions {
  url: string;
}

const ACK_TIMEOUT_MS = 5000;

/**
 * Optional <10 ms LAN relay (server/index.js: Express + Socket.io on 0.0.0.0:3000).
 * The relay persists every accepted snapshot atomically to JSON and is the
 * authority for version conflicts.
 */
export class LocalSocketTransport<S, A> extends BaseTransport<S, A> {
  readonly mode = 'local' as const;

  private readonly url: string;
  private socket: Socket | null = null;
  private manualDisconnect = false;

  constructor(config: TransportConfig<S, A>, options: LocalSocketTransportOptions) {
    super(config);
    this.url = options.url;
  }

  protected async doConnect(): Promise<void> {
    this.manualDisconnect = false;
    const socket = io(this.url, { transports: ['websocket', 'polling'], reconnection: true });
    this.socket = socket;

    socket.on(SOCKET_EVENTS.STATE_SYNC, (envelope: StateEnvelope<S>) => this.acceptRemoteEnvelope(envelope));
    socket.on(SOCKET_EVENTS.LIVE_EVENT, (event: LiveEvent) => this.deliverLiveEvent(event));
    socket.on(SOCKET_EVENTS.PRESENCE_SYNC, (peers: PresenceMeta[]) => this.setPeers(peers));
    socket.on('disconnect', () => this.setStatus(this.manualDisconnect ? 'disconnected' : 'reconnecting'));
    socket.on('connect_error', (err) => {
      console.warn('[local] connect error', err.message);
      this.setStatus('reconnecting');
    });

    const joined = new Promise<void>((resolve) => {
      // Fires on first connect and on every reconnect: (re)join the room and catch up.
      socket.on('connect', async () => {
        try {
          const ack = (await socket
            .timeout(ACK_TIMEOUT_MS)
            .emitWithAck(SOCKET_EVENTS.JOIN, { tournamentId: this.tournamentId, presence: this.presence })) as JoinAck<S>;
          this.acceptAuthoritativeEnvelope(ack.envelope);
          this.setPeers(ack.peers);
          this.setStatus('connected');
          resolve();
        } catch (err) {
          console.warn('[local] join failed', err);
          this.setStatus('error');
        }
      });
    });
    await withTimeout(joined, 10_000, `LAN relay connect (${this.url})`);
  }

  protected async doDisconnect(): Promise<void> {
    this.manualDisconnect = true;
    this.socket?.disconnect();
    this.socket = null;
  }

  protected async publishState(envelope: StateEnvelope<S>, _delta: unknown): Promise<void> {
    if (!this.socket?.connected) return;
    const ack = (await this.socket
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck(SOCKET_EVENTS.STATE_PUSH, { envelope, token: this.authToken })) as PushAck<S>;
    if (!ack.ok) {
      console.warn(`[local] relay rejected snapshot (${ack.reason ?? 'unknown'})`);
      this.acceptAuthoritativeEnvelope(ack.current);
    }
  }

  /** The relay persists on every accepted push. */
  protected async persistState(): Promise<PersistResult<S>> {
    return { ok: true };
  }

  protected async doAppendThrowLog(entries: ThrowLogEntry[]): Promise<void> {
    if (!this.socket?.connected) return;
    await this.socket
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck(SOCKET_EVENTS.THROWS_APPEND, { tournamentId: this.tournamentId, entries, token: this.authToken });
  }

  protected async publishLiveEvent(event: LiveEvent): Promise<void> {
    this.socket?.emit(SOCKET_EVENTS.LIVE_EMIT, event); // relay echoes to the whole room incl. sender
  }

  protected async publishPresence(meta: PresenceMeta): Promise<void> {
    this.socket?.emit(SOCKET_EVENTS.PRESENCE_UPDATE, meta);
  }

  protected async doMeasureLatency(): Promise<number> {
    if (!this.socket?.connected) throw new Error('not connected');
    const start = performance.now();
    await this.socket.timeout(ACK_TIMEOUT_MS).emitWithAck(SOCKET_EVENTS.PING, createId('ping'));
    return Math.round(performance.now() - start);
  }
}
