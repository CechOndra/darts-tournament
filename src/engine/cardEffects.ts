import { dartPoints, evaluatePoints, type DartInput, type DartOutcome } from './scoring.ts';
import type { CardParams, CardPlay, CheckoutMode, Parity } from './types.ts';

/**
 * Per-visit scoring modifiers derived from the card plays of a match.
 * Pure and dependency-free so the match replay can apply them.
 */
export interface VisitMods {
  maxDarts: number;
  doubleAll: boolean;
  doubleDart1: boolean;
  parity: Parity | null;
  parityDart1Only: boolean;
  bottomHalf: boolean;
  bottomHalfDart1Only: boolean;
  allOrNothing: { quota: number; bonus: number } | null;
  showboat: number;
  swapThrower: boolean;
  shotClockSeconds: number | null;
  weakHand: boolean;
  stepBack: boolean;
  /** Plays that affect this visit (for badges and activeCardId). */
  plays: CardPlay[];
}

export const NO_MODS: VisitMods = {
  maxDarts: 3,
  doubleAll: false,
  doubleDart1: false,
  parity: null,
  parityDart1Only: false,
  bottomHalf: false,
  bottomHalfDart1Only: false,
  allOrNothing: null,
  showboat: 0,
  swapThrower: false,
  shotClockSeconds: null,
  weakHand: false,
  stepBack: false,
  plays: [],
};

export type ModsMap = Map<string, VisitMods>;
export const modsKey = (legIndex: number, visitIndex: number) => `${legIndex}:${visitIndex}`;
export const modsFor = (map: ModsMap | undefined, legIndex: number, visitIndex: number): VisitMods => map?.get(modsKey(legIndex, visitIndex)) ?? NO_MODS;

/** Build visit modifiers from the plays of one match. */
export function buildVisitMods(plays: CardPlay[], params: CardParams): ModsMap {
  const map: ModsMap = new Map();
  const edit = (leg: number, visit: number, play: CardPlay, patch: Partial<VisitMods>) => {
    const k = modsKey(leg, visit);
    const cur = map.get(k) ?? { ...NO_MODS, plays: [] };
    map.set(k, { ...cur, ...patch, plays: [...cur.plays, play] });
  };
  for (const p of plays) {
    const { legIndex: l, visitIndex: v } = p;
    switch (p.effectCardTypeId) {
      case 'ALL_OR_NOTHING':
        edit(l, v, p, { allOrNothing: { quota: params.allOrNothingQuota, bonus: params.allOrNothingBonus } });
        break;
      case 'DOUBLE_EDGED_SWORD':
        edit(l, v, p, { doubleAll: true });
        edit(l, v + 1, p, { doubleDart1: true });
        break;
      case 'EXTRA_DART':
        edit(l, v, p, { maxDarts: 4 });
        break;
      case 'STEAL_DART':
        edit(l, v, p, { maxDarts: 2 });
        break;
      case 'PARITY_LOCK_FULL':
        edit(l, v, p, { parity: p.parity ?? 'EVEN', parityDart1Only: false });
        break;
      case 'PARITY_LOCK_1DART':
        edit(l, v, p, { parity: p.parity ?? 'EVEN', parityDart1Only: true });
        break;
      case 'BOTTOM_HALF_FULL':
        edit(l, v, p, { bottomHalf: true, bottomHalfDart1Only: false });
        break;
      case 'BOTTOM_HALF_1DART':
        edit(l, v, p, { bottomHalf: true, bottomHalfDart1Only: true });
        break;
      case 'TEAMMATE_SWAP':
        edit(l, v, p, { swapThrower: true });
        break;
      case 'SHOT_CLOCK':
        edit(l, v, p, { shotClockSeconds: params.shotClockSeconds });
        break;
      case 'WEAK_HAND_1DART':
        edit(l, v, p, { weakHand: true });
        break;
      case 'STEP_BACK_1DART':
        edit(l, v, p, { stepBack: true });
        break;
      case 'SHOWBOAT_DOUBLE':
        edit(l, v, p, { showboat: params.showboatBonus });
        break;
      // FIRST_THROW changes the leg setup; mulligans flag the dart itself.
      default:
        break;
    }
  }
  return map;
}

const segmentParity = (segment: number): Parity | null => (segment === 0 ? null : segment === 25 ? 'ODD' : segment === 50 ? 'EVEN' : segment % 2 === 0 ? 'EVEN' : 'ODD');

/** Points a dart is worth under the visit's card restrictions, before any 2x boost. */
export function restrictedPoints(d: DartInput, dartNo: number, mods: VisitMods): number {
  const raw = dartPoints(d);
  if (mods.parity && (!mods.parityDart1Only || dartNo === 1) && segmentParity(d.segment) !== mods.parity) return 0;
  if (mods.bottomHalf && (!mods.bottomHalfDart1Only || dartNo === 1) && !(d.segment >= 1 && d.segment <= 10)) return 0;
  return raw;
}

/** Score one dart (dartNo is 1-based among non-voided darts of the visit). */
export function evaluateCardDart(
  d: DartInput,
  dartNo: number,
  before: number,
  mode: CheckoutMode,
  mods: VisitMods,
  allowBoostedCheckout = false,
): { outcome: DartOutcome; remaining: number; points: number; boosted: boolean } {
  const base = restrictedPoints(d, dartNo, mods);
  const boost = mods.doubleAll || (mods.doubleDart1 && dartNo === 1);
  if (!boost || base === 0) return { ...evaluatePoints(d, base, before, mode), points: base, boosted: false };
  // Boosted darts always count double. A boosted dart that would finish is a bust
  // unless the organizer allows boosted checkouts (Double-Edged Sword is a risk).
  const r = evaluatePoints(d, base * 2, before, mode);
  if (r.outcome === 'CHECKOUT' && !allowBoostedCheckout) return { outcome: 'BUST', remaining: before, points: base * 2, boosted: true };
  return { ...r, points: base * 2, boosted: true };
}
