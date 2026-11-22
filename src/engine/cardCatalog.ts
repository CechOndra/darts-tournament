/**
 * The 17 Power Cards. Pure data: names, rarity, pool and when each may be played.
 * Effects are applied by the match replay (see cards.ts / match.ts).
 */

export type CardRarity = 'COMMON' | 'SILVER' | 'RARE' | 'LEGENDARY';
export type CardPool = 'LOSER' | 'WINNER';

/**
 * When a card can be played:
 *  - PRE_MATCH: before dart 1 of leg 1
 *  - OWN_VISIT: before the owner's visit (owner's turn with 0 darts, or during the opponent's visit)
 *  - OPP_VISIT: before the opponent's visit (opponent's turn with 0 darts, or during the owner's visit)
 *  - MULLIGAN: right after the owner's dart
 *  - RANDOM: at the start of any visit (0 darts thrown)
 */
export type CardTiming = 'PRE_MATCH' | 'OWN_VISIT' | 'OPP_VISIT' | 'MULLIGAN' | 'RANDOM';

export type CardTypeId =
  | 'ALL_OR_NOTHING'
  | 'FIRST_THROW'
  | 'DOUBLE_EDGED_SWORD'
  | 'EXTRA_DART'
  | 'STEAL_DART'
  | 'PARITY_LOCK_FULL'
  | 'BOTTOM_HALF_FULL'
  | 'MULLIGAN_ANY'
  | 'RANDOM_POWER'
  | 'TEAMMATE_SWAP'
  | 'SHOT_CLOCK'
  | 'PARITY_LOCK_1DART'
  | 'BOTTOM_HALF_1DART'
  | 'WEAK_HAND_1DART'
  | 'STEP_BACK_1DART'
  | 'MULLIGAN_DART1'
  | 'SHOWBOAT_DOUBLE';

export interface CardType {
  id: CardTypeId;
  name: string;
  rarity: CardRarity;
  pool: CardPool;
  timing: CardTiming;
  /** Needs an EVEN / ODD choice when played. */
  needsParity?: boolean;
  /** One line for buttons and the stage. */
  short: string;
  /** Full rules text (guest phones, admin, print deck). */
  rules: string;
}

export const CARD_TYPES: CardType[] = [
  {
    id: 'ALL_OR_NOTHING',
    name: 'All or Nothing',
    rarity: 'LEGENDARY',
    pool: 'LOSER',
    timing: 'OWN_VISIT',
    short: 'Hit the quota for a bonus, or score 0',
    rules: 'Play before your visit (you need more than 85). Score at least the quota (50) with your 3 darts and an extra bonus (25) comes off. Miss the quota and the visit scores 0.',
  },
  {
    id: 'FIRST_THROW',
    name: 'First Throw',
    rarity: 'LEGENDARY',
    pool: 'LOSER',
    timing: 'PRE_MATCH',
    short: 'Steal the throw in leg 1 (and 3, 5...)',
    rules: 'Play before the first dart of the match. Your team throws first in leg 1 and every odd leg after it (legs 1 and 3 in a BO3).',
  },
  {
    id: 'DOUBLE_EDGED_SWORD',
    name: 'Double-Edged Sword',
    rarity: 'LEGENDARY',
    pool: 'LOSER',
    timing: 'OWN_VISIT',
    short: 'Your 3 darts score double, their next dart 1 too',
    rules: 'Play before your visit. Your darts score 2x (you cannot check out using the boost). The opponent\'s first dart of their next visit also scores 2x.',
  },
  {
    id: 'EXTRA_DART',
    name: 'Extra Dart',
    rarity: 'LEGENDARY',
    pool: 'LOSER',
    timing: 'OWN_VISIT',
    short: 'Throw 4 darts this visit',
    rules: 'Play before your visit. You throw 4 darts instead of 3. Normal bust and checkout rules apply.',
  },
  {
    id: 'STEAL_DART',
    name: 'Steal a Dart',
    rarity: 'LEGENDARY',
    pool: 'LOSER',
    timing: 'OPP_VISIT',
    short: 'Opponent throws only 2 darts',
    rules: 'Play before the opponent\'s visit. They throw only 2 darts on that visit.',
  },
  {
    id: 'PARITY_LOCK_FULL',
    name: 'Parity Lock',
    rarity: 'RARE',
    pool: 'LOSER',
    timing: 'OPP_VISIT',
    needsParity: true,
    short: 'Opponent: even or odd segments only',
    rules: 'Play before the opponent\'s visit (they need more than 60). Pick EVEN or ODD: their darts on the wrong parity score 0. Outer bull 25 is odd, bull 50 is even.',
  },
  {
    id: 'BOTTOM_HALF_FULL',
    name: 'Bottom Half',
    rarity: 'RARE',
    pool: 'LOSER',
    timing: 'OPP_VISIT',
    short: 'Opponent: only 1-10 scores',
    rules: 'Play before the opponent\'s visit (they need more than 60). Only segments 1-10 score for all of their darts; everything else (including bulls) scores 0.',
  },
  {
    id: 'MULLIGAN_ANY',
    name: 'Mulligan',
    rarity: 'RARE',
    pool: 'LOSER',
    timing: 'MULLIGAN',
    short: 'Void your last dart and rethrow it',
    rules: 'Play right after your dart 1, 2 or 3 to void it and throw again. Not allowed on a bust, a checkout, or when you needed 70 or less before the dart.',
  },
  {
    id: 'RANDOM_POWER',
    name: 'Random Power',
    rarity: 'RARE',
    pool: 'LOSER',
    timing: 'RANDOM',
    short: 'Wildcard roulette: a random legal card',
    rules: 'Play at the start of any visit. A roulette picks a random full-visit card that is legal right now and activates it immediately.',
  },
  {
    id: 'TEAMMATE_SWAP',
    name: 'Teammate Swap',
    rarity: 'COMMON',
    pool: 'LOSER',
    timing: 'OPP_VISIT',
    short: 'Opponent must switch throwers',
    rules: 'Play before the opponent\'s visit. Their other player throws this visit instead.',
  },
  {
    id: 'SHOT_CLOCK',
    name: 'Shot Clock',
    rarity: 'COMMON',
    pool: 'LOSER',
    timing: 'OPP_VISIT',
    short: 'Opponent visit on a countdown',
    rules: 'Play before the opponent\'s visit. A countdown (10 s) runs on the stage: all darts must be thrown before it hits zero.',
  },
  {
    id: 'PARITY_LOCK_1DART',
    name: 'Parity Lock: Dart 1',
    rarity: 'SILVER',
    pool: 'WINNER',
    timing: 'OPP_VISIT',
    needsParity: true,
    short: 'Opponent dart 1: even or odd only',
    rules: 'Play before the opponent\'s visit. Pick EVEN or ODD: their first dart scores 0 on the wrong parity.',
  },
  {
    id: 'BOTTOM_HALF_1DART',
    name: 'Bottom Half: Dart 1',
    rarity: 'SILVER',
    pool: 'WINNER',
    timing: 'OPP_VISIT',
    short: 'Opponent dart 1: only 1-10 scores',
    rules: 'Play before the opponent\'s visit. Their first dart only scores in segments 1-10.',
  },
  {
    id: 'WEAK_HAND_1DART',
    name: 'Weak Hand',
    rarity: 'SILVER',
    pool: 'WINNER',
    timing: 'OPP_VISIT',
    short: 'Opponent dart 1 with the other hand',
    rules: 'Play before the opponent\'s visit. Their first dart is thrown with the non-dominant hand.',
  },
  {
    id: 'STEP_BACK_1DART',
    name: 'Step Back',
    rarity: 'SILVER',
    pool: 'WINNER',
    timing: 'OPP_VISIT',
    short: 'Opponent dart 1 from one step back',
    rules: 'Play before the opponent\'s visit. Their first dart is thrown from one step behind the oche.',
  },
  {
    id: 'MULLIGAN_DART1',
    name: 'Mulligan: Dart 1',
    rarity: 'SILVER',
    pool: 'WINNER',
    timing: 'MULLIGAN',
    short: 'Void your dart 1 and rethrow it',
    rules: 'Play right after your first dart of a visit to void it and throw again. Not allowed on a bust, a checkout, or when you needed 70 or less.',
  },
  {
    id: 'SHOWBOAT_DOUBLE',
    name: 'Showboat Double',
    rarity: 'SILVER',
    pool: 'WINNER',
    timing: 'OWN_VISIT',
    short: 'Hit any double: +0.5 bonus point',
    rules: 'Play before your visit. Hitting any double (or bull 50) during the visit earns +0.5 tiebreaker bonus points, even without checking out.',
  },
];

export const CARD_BY_ID = Object.fromEntries(CARD_TYPES.map((c) => [c.id, c])) as Record<CardTypeId, CardType>;
export const isCardTypeId = (id: string): id is CardTypeId => id in CARD_BY_ID;

export const RARITY_COPIES: Record<CardRarity, number> = { COMMON: 4, SILVER: 3, RARE: 2, LEGENDARY: 1 };
export const RARITY_LABEL: Record<CardRarity, string> = { COMMON: 'Common', SILVER: 'Silver', RARE: 'Rare', LEGENDARY: 'Legendary' };

export const defaultCopies = (): Record<CardTypeId, number> =>
  Object.fromEntries(CARD_TYPES.map((c) => [c.id, RARITY_COPIES[c.rarity]])) as Record<CardTypeId, number>;

/** Full-visit cards RANDOM_POWER may land on. */
export const RANDOM_OWN: CardTypeId[] = ['ALL_OR_NOTHING', 'DOUBLE_EDGED_SWORD', 'EXTRA_DART'];
export const RANDOM_OPP: CardTypeId[] = ['STEAL_DART', 'PARITY_LOCK_FULL', 'BOTTOM_HALF_FULL', 'TEAMMATE_SWAP', 'SHOT_CLOCK'];
