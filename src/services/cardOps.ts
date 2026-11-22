import type { EngineAction } from '../engine/actions.ts';
import type { CardPool, CardTypeId } from '../engine/cardCatalog.ts';
import type { TournamentState } from '../engine/state.ts';
import type { CardDrawKind, Parity } from '../engine/types.ts';
import { createId } from './transport/ids.ts';
import type { TournamentTransport } from './transport/types.ts';

type AppTransport = TournamentTransport<TournamentState, EngineAction>;

/** Cryptographic roll in [0, 1): the reducer turns it into a card, so every device lands on the same one. */
export function secureRoll(): number {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return n[0]! / 4294967296;
}

export async function playCard(transport: AppTransport, instanceId: string, parity?: Parity): Promise<boolean> {
  const id = createId('play');
  const env = await transport.dispatch({ type: 'PLAY_CARD', id, instanceId, parity, roll: secureRoll(), at: Date.now() }, { persist: 'immediate' });
  return env.state.cards.plays.some((p) => p.id === id);
}

export async function drawCard(transport: AppTransport, teamId: string, kind: CardDrawKind, pool?: CardPool | 'ANY'): Promise<boolean> {
  const id = createId('draw');
  const env = await transport.dispatch({ type: 'DRAW_CARD', id, teamId, kind, pool, roll: secureRoll(), at: Date.now() }, { persist: 'immediate' });
  return env.state.cards.draws.some((d) => d.id === id);
}

export async function grantCard(transport: AppTransport, teamId: string, cardTypeId: CardTypeId): Promise<void> {
  await transport.dispatch({ type: 'GRANT_CARD', id: createId('grant'), teamId, cardTypeId, at: Date.now() }, { persist: 'immediate' });
}
