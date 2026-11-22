import { CARD_BY_ID, CARD_TYPES, type CardPool, type CardTypeId } from './cardCatalog.ts';
import type { CardInstance, CardSettings, CardsState } from './types.ts';

/** Physical card pool bookkeeping (pure, no match logic). */

export function emptyCards(): CardsState {
  return { instances: [], plays: [], draws: [], pendingDiscard: null, nextInstanceSeq: 1, handsExpired: false };
}

export const instanceId = (seq: number) => `card_inst_${String(seq).padStart(3, '0')}`;

export function newInstance(cards: CardsState, cardTypeId: CardTypeId): { cards: CardsState; instance: CardInstance } {
  const instance: CardInstance = { instanceId: instanceId(cards.nextInstanceSeq), cardTypeId, pool: CARD_BY_ID[cardTypeId].pool, ownerTeamId: null, status: 'IN_POOL' };
  return { cards: { ...cards, instances: [...cards.instances, instance], nextInstanceSeq: cards.nextInstanceSeq + 1 }, instance };
}

/** Match the printed copy counts: add missing copies to the pool, remove extra copies that are still in the pool. */
export function syncInstances(cards: CardsState, settings: CardSettings): CardsState {
  let next = cards;
  for (const type of CARD_TYPES) {
    const target = Math.max(0, Math.round(settings.copies[type.id] ?? 0));
    const mine = next.instances.filter((i) => i.cardTypeId === type.id && i.status !== 'DISCARDED');
    if (mine.length < target) {
      for (let n = mine.length; n < target; n++) next = newInstance(next, type.id).cards;
    } else if (mine.length > target) {
      const removable = new Set(
        mine
          .filter((i) => i.status === 'IN_POOL')
          .slice(0, mine.length - target)
          .map((i) => i.instanceId),
      );
      next = { ...next, instances: next.instances.filter((i) => !removable.has(i.instanceId)) };
    }
  }
  return next;
}

/** Deterministic PRNG (mulberry32) for seeded deals and animation strips. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const handOf = (cards: CardsState, teamId: string): CardInstance[] =>
  cards.instances.filter((i) => i.status === 'IN_HAND' && i.ownerTeamId === teamId);

export const poolInstances = (cards: CardsState, pool: CardPool | 'ANY'): CardInstance[] =>
  cards.instances.filter((i) => i.status === 'IN_POOL' && (pool === 'ANY' || i.pool === pool));

export function giveTo(cards: CardsState, id: string, teamId: string | null): CardsState {
  return {
    ...cards,
    instances: cards.instances.map((i) => (i.instanceId === id ? { ...i, ownerTeamId: teamId, status: teamId ? 'IN_HAND' : 'IN_POOL' } : i)),
  };
}

/** Deal the starting hands (seeded so every device builds the same tournament). */
export function dealStartingHands(cards: CardsState, teamIds: string[], perTeam: number, seed: number): CardsState {
  const rand = seededRandom(seed);
  let next = cards;
  for (let round = 0; round < perTeam; round++) {
    for (const teamId of teamIds) {
      const pool = poolInstances(next, 'ANY');
      if (!pool.length) return next;
      next = giveTo(next, pool[Math.floor(rand() * pool.length)]!.instanceId, teamId);
    }
  }
  return next;
}
