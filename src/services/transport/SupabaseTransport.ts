import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabase/client.ts';
import { BaseTransport, withTimeout, type PersistResult } from './BaseTransport.ts';
import { createId } from './ids.ts';
import { BROADCAST_EVENTS, channelName, shouldInlineState } from './protocol.ts';
import type { LiveEvent, PresenceMeta, StateEnvelope, ThrowLogEntry, TransportConfig } from './types.ts';

interface TournamentRow {
  id: string;
  state: unknown;
  version: number;
  updated_at_ms: number;
  origin_client_id: string | null;
}

interface HeadRow {
  id: string;
  version: number;
}

interface StateHint {
  version: number;
  originClientId: string;
  /** Set after a rejected write: receivers must re-read Postgres and let it win ties. */
  authoritative?: boolean;
}

interface SaveResult {
  ok: boolean;
  reason?: string;
  version?: number;
}

export interface SupabaseTransportOptions {
  url: string;
  anonKey: string;
}

/**
 * Primary transport for GitHub Pages hosting:
 *  - Realtime Broadcast (self: true) for sub-100 ms state + live events
 *  - Realtime Presence for active scorer tracking
 *  - Postgres (via SECURITY DEFINER RPCs in supabase/schema.sql) for durable snapshots + dart logs
 *  - postgres_changes on the tiny `tournament_heads` row as a reliable catch-up signal
 */
export class SupabaseTransport<S, A> extends BaseTransport<S, A> {
  readonly mode = 'supabase' as const;

  private readonly client: SupabaseClient;
  private channel: RealtimeChannel | null = null;
  private readonly pendingPings = new Map<string, () => void>();
  private warnedNoToken = false;
  private manualDisconnect = false;

  constructor(config: TransportConfig<S, A>, options: SupabaseTransportOptions) {
    super(config);
    this.client = getSupabaseClient(options.url, options.anonKey);
  }

  // ---------------------------------------------------------------- connect
  protected async doConnect(): Promise<void> {
    this.manualDisconnect = false;
    await this.refreshFromDatabase(true).catch((err) => console.warn('[supabase] initial hydrate failed', err));

    const channel = this.client.channel(channelName(this.tournamentId), {
      config: { broadcast: { self: true, ack: false }, presence: { key: this.clientId } },
    });
    this.channel = channel;

    channel
      .on('broadcast', { event: BROADCAST_EVENTS.STATE_SYNC }, ({ payload }) => {
        const envelope = payload as StateEnvelope<S>;
        if (envelope.originClientId !== this.clientId) this.acceptRemoteEnvelope(envelope);
      })
      .on('broadcast', { event: BROADCAST_EVENTS.STATE_HINT }, ({ payload }) => {
        const hint = payload as StateHint;
        if (hint.originClientId === this.clientId) return;
        const current = this.envelope?.version ?? 0;
        if (hint.authoritative || hint.version > current) void this.refreshFromDatabase(Boolean(hint.authoritative));
      })
      .on('broadcast', { event: BROADCAST_EVENTS.LIVE_EVENT }, ({ payload }) => {
        this.deliverLiveEvent(payload as LiveEvent);
      })
      .on('broadcast', { event: BROADCAST_EVENTS.PING }, ({ payload }) => {
        const { nonce, clientId } = payload as { nonce: string; clientId: string };
        if (clientId === this.clientId) this.pendingPings.get(nonce)?.();
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceMeta>();
        const peers: PresenceMeta[] = [];
        for (const entries of Object.values(state)) {
          const latest = entries[entries.length - 1];
          if (latest) {
            const { clientId, role, unlocked, pinVersion, label, joinedAt } = latest;
            peers.push({ clientId, role, unlocked, pinVersion, label, joinedAt });
          }
        }
        this.setPeers(peers);
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournament_heads', filter: `id=eq.${this.tournamentId}` },
        (change) => {
          const row = change.new as Partial<HeadRow>;
          if (typeof row.version === 'number' && row.version > (this.envelope?.version ?? 0)) {
            void this.refreshFromDatabase(false);
          }
        },
      );

    let firstSubscribe = true;
    const subscribed = new Promise<void>((resolve) => {
      channel.subscribe((status, err) => {
        switch (status) {
          case 'SUBSCRIBED':
            this.setStatus('connected');
            void channel.track(this.presence);
            if (!firstSubscribe) void this.refreshFromDatabase(false); // catch up after reconnect
            firstSubscribe = false;
            resolve();
            break;
          case 'CHANNEL_ERROR':
          case 'TIMED_OUT':
            console.warn(`[supabase] realtime ${status}`, err ?? '');
            this.setStatus('reconnecting');
            break;
          case 'CLOSED':
            this.setStatus(this.manualDisconnect ? 'disconnected' : 'reconnecting');
            break;
        }
      });
    });
    await withTimeout(subscribed, 15_000, 'Supabase realtime subscribe');
  }

  protected async doDisconnect(): Promise<void> {
    this.manualDisconnect = true;
    if (this.channel) {
      await this.channel.untrack().catch(() => undefined);
      await this.client.removeChannel(this.channel);
      this.channel = null;
    }
  }

  // ---------------------------------------------------------------- state
  private async fetchLatest(): Promise<StateEnvelope<S> | null> {
    const { data, error } = await this.client
      .from('tournaments')
      .select('id, state, version, updated_at_ms, origin_client_id')
      .eq('id', this.tournamentId)
      .maybeSingle<TournamentRow>();
    if (error) throw error;
    if (!data) return null;
    return {
      tournamentId: data.id,
      version: Number(data.version),
      updatedAt: Number(data.updated_at_ms),
      originClientId: data.origin_client_id ?? 'database',
      state: data.state as S,
    };
  }

  private async refreshFromDatabase(authoritative: boolean): Promise<void> {
    const latest = await this.fetchLatest();
    if (authoritative) this.acceptAuthoritativeEnvelope(latest);
    else this.acceptRemoteEnvelope(latest);
  }

  protected async publishState(envelope: StateEnvelope<S>): Promise<void> {
    if (!this.channel) return;
    if (shouldInlineState(envelope)) {
      await this.channel.send({ type: 'broadcast', event: BROADCAST_EVENTS.STATE_SYNC, payload: envelope });
      return;
    }
    // Too large for a broadcast frame (e.g. many player photos): persist first, then hint peers to re-read.
    await this.flush();
    const hint: StateHint = { version: envelope.version, originClientId: this.clientId };
    await this.channel.send({ type: 'broadcast', event: BROADCAST_EVENTS.STATE_HINT, payload: hint });
  }

  protected async persistState(envelope: StateEnvelope<S>): Promise<PersistResult<S>> {
    if (!this.authToken) {
      if (!this.warnedNoToken) {
        console.info('[supabase] no admin/scorer session token: snapshot broadcast only, not persisted');
        this.warnedNoToken = true;
      }
      return { ok: true };
    }
    const { data, error } = await this.client.rpc('save_tournament_state', {
      p_token: this.authToken,
      p_id: envelope.tournamentId,
      p_state: envelope.state,
      p_version: envelope.version,
      p_updated_at_ms: envelope.updatedAt,
      p_client_id: envelope.originClientId,
    });
    if (error) throw error;
    const result = data as SaveResult;
    if (result.ok) return { ok: true };
    return { ok: false, reason: result.reason ?? 'rejected', latest: await this.fetchLatest() };
  }

  protected onPersistRejected(): void {
    const hint: StateHint = {
      version: this.envelope?.version ?? 0,
      originClientId: this.clientId,
      authoritative: true,
    };
    void this.channel?.send({ type: 'broadcast', event: BROADCAST_EVENTS.STATE_HINT, payload: hint });
  }

  protected async doAppendThrowLog(entries: ThrowLogEntry[]): Promise<void> {
    if (!this.authToken) return;
    const { error } = await this.client.rpc('append_dart_throws', {
      p_token: this.authToken,
      p_id: this.tournamentId,
      p_throws: entries,
    });
    if (error) throw error;
  }

  // ---------------------------------------------------------------- live events & presence
  protected async publishLiveEvent(event: LiveEvent): Promise<void> {
    if (!this.channel) return;
    await this.channel.send({ type: 'broadcast', event: BROADCAST_EVENTS.LIVE_EVENT, payload: event });
  }

  protected async publishPresence(meta: PresenceMeta): Promise<void> {
    await this.channel?.track(meta);
  }

  protected doMeasureLatency(): Promise<number> {
    const channel = this.channel;
    if (!channel || this.status !== 'connected') return Promise.reject(new Error('not connected'));
    const nonce = createId('ping');
    const start = performance.now();
    const echoed = new Promise<number>((resolve) => {
      this.pendingPings.set(nonce, () => resolve(Math.round(performance.now() - start)));
    });
    void channel.send({ type: 'broadcast', event: BROADCAST_EVENTS.PING, payload: { nonce, clientId: this.clientId } });
    return withTimeout(echoed, 5000, 'ping').finally(() => this.pendingPings.delete(nonce));
  }
}
