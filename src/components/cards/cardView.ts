import { CARD_BY_ID, type CardRarity, type CardTypeId } from '../../engine/cardCatalog.ts';
import { cardCost, limitModeOf, rarityIn } from '../../engine/cardConfig.ts';
import type { CardSettings, CardStyle } from '../../engine/types.ts';
import { PRESET, presetFor, type RenderCard } from '../../powercards/power-card.js';

/** 'new' = dartboard-back reveal (src/powercards/reveal.js); 'legacy' = the old CS2 crate / prize wheel. Visual only. */
export const CARD_REVEAL: 'new' | 'legacy' = 'new';

/** Visual-only data per power for the card renderer (icon, type badge, art). Rules text stays in cardCatalog. */
interface View {
  icon: string;
  kind: string;
  board?: 'even' | 'odd' | 'double' | 'triple';
  /** After "Play ", lowercase. Pieces of CardType.rules unless marked WRITTEN. */
  when: string;
  effect: string;
  limit: string;
}

const OWN = 'before your visit';
const OPP = "before the opponent's visit";
const ONE = 'One card per visit.'; // WRITTEN: restates checkPlay ("A card already targets that visit")
const DART1 = 'Dart 1 only.'; // WRITTEN: restates the card name

export const CARD_VIEW: Record<CardTypeId, View> = {
  ALL_OR_NOTHING: { icon: 'coinflip', kind: 'GAMBLE', when: OWN, effect: 'Score at least the quota (50) with your 3 darts and an extra bonus (25) comes off. Miss the quota and the visit scores 0.', limit: 'You need more than 85.' },
  FIRST_THROW: { icon: 'bolt', kind: 'BOOST', when: 'before the first dart of the match', effect: 'Your team throws first in leg 1 and every odd leg after it (legs 1 and 3 in a BO3).', limit: 'Only once per match.' /* WRITTEN: checkPlay "First throw already taken" */ },
  DOUBLE_EDGED_SWORD: { icon: 'crossed-swords', kind: 'GAMBLE', board: 'double', when: OWN, effect: "Your darts score 2x. The opponent's first dart of their next visit also scores 2x.", limit: 'A doubled dart that would finish the leg is a bust.' },
  EXTRA_DART: { icon: 'dart', kind: 'BOOST', when: OWN, effect: 'You throw 4 darts instead of 3.', limit: 'Normal bust and checkout rules apply.' },
  STEAL_DART: { icon: 'robber-hand', kind: 'RESTRICT', when: OPP, effect: 'They throw only 2 darts on that visit.', limit: ONE },
  PARITY_LOCK_FULL: { icon: 'padlock', kind: 'RESTRICT', when: OPP, effect: 'Pick EVEN or ODD: their darts on the wrong parity score 0.', limit: 'They need more than 60. Outer bull 25 is odd, bull 50 is even.' },
  BOTTOM_HALF_FULL: { icon: 'dartboard', kind: 'RESTRICT', when: OPP, effect: 'Only segments 1-10 score for all of their darts; everything else (including bulls) scores 0.', limit: 'They need more than 60.' },
  MULLIGAN_ANY: { icon: 'anticlockwise-rotation', kind: 'REPLAY', when: 'right after your dart 1, 2 or 3', effect: 'Void that dart and throw again.', limit: 'Not allowed on a bust, a checkout, or when you needed 70 or less before the dart.' },
  RANDOM_POWER: { icon: 'dice-six-faces-five', kind: 'GAMBLE', when: 'at the start of any visit', effect: 'A roulette picks a random full-visit card that is legal right now and activates it immediately.', limit: 'Only a legal card can come up.' /* WRITTEN */ },
  TEAMMATE_SWAP: { icon: 'body-swapping', kind: 'RESTRICT', when: OPP, effect: 'Their other player throws this visit instead.', limit: 'Opponent needs two players.' /* WRITTEN: checkPlay "Opponent has one player" */ },
  SHOT_CLOCK: { icon: 'stopwatch', kind: 'RESTRICT', when: OPP, effect: 'A countdown (10 s) runs on the stage: all darts must be thrown before it hits zero.', limit: ONE },
  PARITY_LOCK_1DART: { icon: 'padlock', kind: 'RESTRICT', when: OPP, effect: 'Pick EVEN or ODD: their first dart scores 0 on the wrong parity.', limit: DART1 },
  BOTTOM_HALF_1DART: { icon: 'dartboard', kind: 'RESTRICT', when: OPP, effect: 'Their first dart only scores in segments 1-10.', limit: DART1 },
  WEAK_HAND_1DART: { icon: 'hand', kind: 'RESTRICT', when: OPP, effect: 'Their first dart is thrown with the non-dominant hand.', limit: DART1 },
  STEP_BACK_1DART: { icon: 'footsteps', kind: 'RESTRICT', when: OPP, effect: 'Their first dart is thrown from one step behind the oche.', limit: DART1 },
  MULLIGAN_DART1: { icon: 'backward-time', kind: 'REPLAY', when: 'right after your first dart of a visit', effect: 'Void it and throw again.', limit: 'Not allowed on a bust, a checkout, or when you needed 70 or less.' },
  SHOWBOAT_DOUBLE: { icon: 'stars', kind: 'GAMBLE', board: 'double', when: OWN, effect: 'Hitting any double (or bull 50) during the visit earns +0.5 tiebreaker bonus points, even without checking out.', limit: ONE },
};

export type RendererRarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export const rendererRarity = (r: CardRarity): RendererRarity => r.toLowerCase() as RendererRarity;

export function renderData(id: CardTypeId, rarity: CardRarity, image?: string, cost?: number): RenderCard {
  const { name } = CARD_BY_ID[id];
  const v = CARD_VIEW[id];
  return { name, rarity: rendererRarity(rarity), kind: v.kind, icon: v.icon, board: v.board, when: v.when, effect: v.effect, limit: v.limit, image, cost };
}

export interface ResolvedStyle {
  look: string;
  colors: Record<string, unknown>;
  options: Record<string, unknown>;
  back: string;
}

/** Colours + options for one rarity: the admin's saved style, or the built-in PRESET. The cost badge only shows when the card has a cost (energy mode). */
export function resolveStyle(style: CardStyle | null | undefined, rarity: RendererRarity): ResolvedStyle {
  if (!style) {
    const d = presetFor(PRESET.look, rarity);
    return { look: PRESET.look, colors: d.colors, options: d.options, back: PRESET.back };
  }
  const c = style.colors[style.look] ?? {};
  const { patK, patGlow, ...colors } = { ...c.all, ...c[rarity] } as Record<string, unknown>;
  const options: Record<string, unknown> = { ...(style.opts[style.look] ?? PRESET.options[style.look]) };
  if (patK != null) options.patternK = patK;
  if (patGlow != null) options.patternGlow = patGlow;
  return { look: style.look, colors, options, back: style.back || PRESET.back };
}

/** Everything the renderer needs for one power: data (with the admin's picture) and the saved or default style. */
export function cardFace(settings: CardSettings | undefined, id: CardTypeId, rarityOverride?: CardRarity) {
  const rarity = rarityOverride ?? (settings ? rarityIn(settings, id) : CARD_BY_ID[id].rarity);
  return { card: renderData(id, rarity, settings?.images?.[id], settings && limitModeOf(settings) === 'ENERGY' ? cardCost(settings, id) : undefined), style: resolveStyle(settings?.style, rendererRarity(rarity)) };
}
