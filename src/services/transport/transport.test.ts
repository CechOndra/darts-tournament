import { describe, expect, it } from 'vitest';
import { BaseTransport, type PersistResult } from './BaseTransport.ts';
import { resolveTransportEnv } from './config.ts';
import { INLINE_STATE_MAX_BYTES, isNewer, shouldInlineState } from './protocol.ts';
import type { LiveEvent, PresenceMeta, StateEnvelope, TransportConfig } from './types.ts';

type S = { count: number };
type A = { type: 'inc' };

class FakeTransport extends BaseTransport<S, A> {
  readonly mode = 'loopback' as const;
  published: StateEnvelope<S>[] = [];
  persisted: StateEnvelope<S>[] = [];
  live: LiveEvent[] = [];
  nextPersist: PersistResult<S> = { ok: true };

  constructor(config: TransportConfig<S, A>, clientId: string) {
    super(config, clientId);
  }
  protected async doConnect() {
    this.setStatus('connected');
  }
  protected async doDisconnect() {}
  protected async publishState(e: StateEnvelope<S>) {
    this.published.push(e);
  }
  protected async publishLiveEvent(e: LiveEvent) {
    this.live.push(e);
    this.deliverLiveEvent(e);
  }
  protected async publishPresence(_m: PresenceMeta) {}
  protected async doMeasureLatency() {
    return 1;
  }
  protected async persistState(e: StateEnvelope<S>) {
    this.persisted.push(e);
    return this.nextPersist;
  }
  protected async doAppendThrowLog() {}
  receive(e: StateEnvelope<S>) {
    return this.acceptRemoteEnvelope(e);
  }
}

const config: TransportConfig<S, A> = {
  tournamentId: 't1',
  reducer: (s) => ({ count: s.count + 1 }),
  createInitialState: () => ({ count: 0 }),
  persistDebounceMs: 10_000,
};

const env = (version: number, updatedAt: number, originClientId = 'x', count = version): StateEnvelope<S> => ({
  tournamentId: 't1',
  version,
  updatedAt,
  originClientId,
  state: { count },
});

describe('isNewer', () => {
  it('orders by version, then timestamp, then client id', () => {
    expect(isNewer(env(2, 1), env(1, 5))).toBe(true);
    expect(isNewer(env(1, 5), env(2, 1))).toBe(false);
    expect(isNewer(env(2, 6), env(2, 5))).toBe(true);
    expect(isNewer(env(2, 5, 'b'), env(2, 5, 'a'))).toBe(true);
    expect(isNewer(env(2, 5, 'a'), env(2, 5, 'a'))).toBe(false);
    expect(isNewer(env(1, 1), null)).toBe(true);
  });
});

describe('shouldInlineState', () => {
  it('inlines small snapshots and hints large ones', () => {
    expect(shouldInlineState(env(1, 1))).toBe(true);
    const big = { ...env(1, 1), state: { blob: 'x'.repeat(INLINE_STATE_MAX_BYTES) } };
    expect(shouldInlineState(big)).toBe(false);
  });
});

describe('BaseTransport', () => {
  it('dispatch applies the reducer, bumps version and publishes', async () => {
    const t = new FakeTransport(config, 'c1');
    await t.connect();
    const seen: number[] = [];
    t.onStateSync((e) => seen.push(e.version));
    const e1 = await t.dispatch({ type: 'inc' });
    const e2 = await t.dispatch({ type: 'inc' });
    expect(e1.version).toBe(1);
    expect(e2.version).toBe(2);
    expect(e2.state.count).toBe(2);
    expect(e2.updatedAt).toBeGreaterThan(e1.updatedAt);
    expect(t.published.map((e) => e.version)).toEqual([1, 2]);
    expect(seen).toEqual([1, 2]);
  });

  it('debounces persistence and persists only the latest snapshot on flush', async () => {
    const t = new FakeTransport(config, 'c1');
    await t.dispatch({ type: 'inc' });
    await t.dispatch({ type: 'inc' });
    expect(t.persisted).toHaveLength(0);
    await t.flush();
    expect(t.persisted.map((e) => e.version)).toEqual([2]);
  });

  it('persists immediately when asked', async () => {
    const t = new FakeTransport(config, 'c1');
    await t.dispatch({ type: 'inc' }, { persist: 'immediate' });
    await t.flush();
    expect(t.persisted).toHaveLength(1);
  });

  it('ignores stale or foreign snapshots', () => {
    const t = new FakeTransport(config, 'c1');
    expect(t.receive(env(3, 10))).toBe(true);
    expect(t.receive(env(2, 99))).toBe(false);
    expect(t.receive({ ...env(9, 9), tournamentId: 'other' })).toBe(false);
    expect(t.getSnapshot()?.version).toBe(3);
  });

  it('adopts the authoritative snapshot when persistence is rejected', async () => {
    const t = new FakeTransport(config, 'zzz');
    await t.dispatch({ type: 'inc' });
    t.nextPersist = { ok: false, reason: 'stale_version', latest: env(1, 1, 'aaa', 42) };
    await t.flush();
    expect(t.getSnapshot()?.state.count).toBe(42);
    expect(t.getSnapshot()?.originClientId).toBe('aaa');
  });

  it('delivers live events to local listeners', async () => {
    const t = new FakeTransport(config, 'c1');
    const types: string[] = [];
    t.onLiveEvent((e) => types.push(e.type));
    await t.emitLiveEvent('DART_THROWN', { segment: 20 });
    expect(types).toEqual(['DART_THROWN']);
    expect(t.live[0]?.originClientId).toBe('c1');
  });
});

describe('resolveTransportEnv', () => {
  it('falls back to loopback when Supabase credentials are missing', () => {
    const r = resolveTransportEnv({});
    expect(r.mode).toBe('loopback');
    expect(r.fallbackReason).not.toBeNull();
    expect(r.tournamentId).toBe('main');
  });

  it('uses supabase when configured and the LAN relay on request', () => {
    expect(resolveTransportEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' }).mode).toBe(
      'supabase',
    );
    const local = resolveTransportEnv({ VITE_TRANSPORT_MODE: 'local' }, '192.168.1.5');
    expect(local.mode).toBe('local');
    expect(local.localServerUrl).toBe('http://192.168.1.5:3000');
  });
});
