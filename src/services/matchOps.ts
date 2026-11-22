import type { EngineAction } from '../engine/actions.ts';
import { computeMatchView } from '../engine/match.ts';
import type { Multiplier } from '../engine/scoring.ts';
import type { TournamentState } from '../engine/state.ts';
import type { Side } from '../engine/types.ts';
import { createId } from './transport/ids.ts';
import type { TournamentTransport } from './transport/types.ts';

type AppTransport = TournamentTransport<TournamentState, EngineAction>;

export const MATCH_EVENTS = {
  DART_THROWN: 'DART_THROWN',
  DART_UNDONE: 'DART_UNDONE',
  COIN_TOSS: 'COIN_TOSS',
} as const;

export interface DartThrownEvent {
  segment: number;
  multiplier: Multiplier;
  isCheckout: boolean;
  bust: boolean;
}

/**
 * Score one dart. Persists immediately when the dart ends a visit (spec: snapshot on
 * every visit / match completion) and appends the finished visit to the dart log.
 */
export async function throwDart(transport: AppTransport, segment: number, multiplier: Multiplier): Promise<void> {
  const before = transport.getSnapshot()?.state;
  const beforeView = before ? computeMatchView(before) : null;
  if (!beforeView?.turn) return;
  const id = createId('dart');
  const env = await transport.dispatch({ type: 'THROW_DART', id, segment, multiplier, at: Date.now() }, { persist: 'debounced' });
  const after = computeMatchView(env.state);
  const thrown = env.state.throws.find((t) => t.id === id);
  if (!thrown) return; // rejected by the reducer (e.g. phase changed on another device)

  const visit = after?.legs[thrown.legIndex]?.visits.find((v) => v.visitIndex === thrown.visitIndex);
  void transport.emitLiveEvent<DartThrownEvent>(MATCH_EVENTS.DART_THROWN, {
    segment,
    multiplier,
    isCheckout: thrown.isCheckoutDart,
    bust: !!visit?.bust,
  });
  if (visit?.complete) {
    void transport.flush();
    void transport.appendThrowLog(visit.darts.map((d) => ({ ...d }))).catch((err) => console.warn('[log] append failed', err));
  }
}

export async function undoDart(transport: AppTransport): Promise<void> {
  const state = transport.getSnapshot()?.state;
  const live = state?.live;
  if (!state || !live) return;
  const last = [...state.throws].reverse().find((t) => t.matchId === live.matchId);
  const env = await transport.dispatch({ type: 'UNDO_DART' }, { persist: 'immediate' });
  // UNDO_DART may have undone a card play instead of a dart; only log removed darts.
  if (!last || env.state.throws.some((t) => t.id === last.id)) return;
  void transport.emitLiveEvent(MATCH_EVENTS.DART_UNDONE, { id: last.id });
  void transport.appendThrowLog([{ ...last, undone: true }]).catch(() => undefined);
}

export function flipCoin(): Side {
  const n = new Uint8Array(1);
  crypto.getRandomValues(n);
  return n[0]! % 2 === 0 ? 'home' : 'away';
}

/** Resolve a pending virtual coin toss and let the stage animate it. */
export async function runCoinToss(transport: AppTransport, legIndex: number): Promise<Side> {
  const result = flipCoin();
  await transport.emitLiveEvent(MATCH_EVENTS.COIN_TOSS, { result, legIndex });
  await transport.dispatch({ type: 'SET_LEG_START', legIndex, firstTeam: result, resolvedBy: 'COIN_TOSS' }, { persist: 'immediate' });
  return result;
}
