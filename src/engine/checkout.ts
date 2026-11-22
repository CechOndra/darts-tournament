import { dartLabel, dartPoints, isDoubleDart, isTripleDart, isValidFinishDart, type DartInput } from './scoring.ts';
import type { CheckoutMode, SpecialRules } from './types.ts';

/**
 * Dual-Path Checkout Solver.
 *  - "safe" route: the easiest legal finish under the checkout mode.
 *  - "bonus" route: the easiest finish that also earns a special-rule bonus
 *    (double / triple checkout), shown in gold when it differs from the safe route.
 */

export interface CheckoutRoute {
  darts: DartInput[];
  labels: string[];
  cost: number;
}

export interface DualCheckout {
  safe: CheckoutRoute | null;
  safeLabel: string;
  bonus: CheckoutRoute | null;
  bonusLabel: string | null;
}

const ALL_DARTS: DartInput[] = [
  ...[1, 2, 3].flatMap((multiplier) =>
    Array.from({ length: 20 }, (_, i) => ({ segment: 20 - i, multiplier: multiplier as 1 | 2 | 3 })),
  ),
  { segment: 25, multiplier: 1 },
  { segment: 50, multiplier: 1 },
];

/**
 * Route cost = sum of -ln(hit probability) for a social-league player, so the
 * "safe" route is the most likely one to come off (singles >> doubles > trebles > bull).
 */
const P_SINGLE = 0.8;
const P_DOUBLE = 0.3;
const P_TREBLE = 0.25;
const P_OUTER_BULL = 0.35;
const P_BULL = 0.12;
/** Favoured finishing doubles (split-friendly) get a small preference. */
const DOUBLE_PREFERENCE: Record<number, number> = { 20: -0.08, 16: -0.12, 8: -0.08, 10: -0.05, 18: -0.03, 12: -0.03, 4: -0.03 };

function dartCost(d: DartInput, finishing: boolean): number {
  if (d.segment === 50) return -Math.log(P_BULL);
  if (d.segment === 25) return -Math.log(P_OUTER_BULL);
  if (d.multiplier === 3) return -Math.log(P_TREBLE);
  if (d.multiplier === 2) return -Math.log(P_DOUBLE) + (finishing ? (DOUBLE_PREFERENCE[d.segment] ?? 0) : 0);
  return -Math.log(P_SINGLE);
}

type FinishFilter = 'ANY' | 'DOUBLE' | 'TRIPLE';

const cache = new Map<string, CheckoutRoute | null>();

function passesFilter(d: DartInput, filter: FinishFilter): boolean {
  return filter === 'ANY' || (filter === 'DOUBLE' ? isDoubleDart(d) : isTripleDart(d));
}

/** Cheapest route that finishes exactly `score` within `dartsLeft` darts. */
export function bestCheckout(score: number, dartsLeft: number, mode: CheckoutMode, filter: FinishFilter = 'ANY'): CheckoutRoute | null {
  if (score < 2 && mode !== 'STRAIGHT_OUT') return null;
  if (score < 1 || score > 180 || dartsLeft < 1) return null;
  const key = `${score}|${dartsLeft}|${mode}|${filter}`;
  if (cache.has(key)) return cache.get(key)!;

  let best: CheckoutRoute | null = null;
  const consider = (darts: DartInput[]) => {
    const cost = darts.reduce((sum, d, i) => sum + dartCost(d, i === darts.length - 1), 0) + darts.length * 0.02;
    if (!best || cost < best.cost - 1e-9) best = { darts, labels: darts.map(dartLabel), cost };
  };
  const finishers = (remaining: number) =>
    ALL_DARTS.filter((d) => dartPoints(d) === remaining && isValidFinishDart(d, remaining, mode) && passesFilter(d, filter));

  for (const f of finishers(score)) consider([f]);
  if (dartsLeft >= 2) {
    for (const a of ALL_DARTS) {
      const r1 = score - dartPoints(a);
      if (r1 <= 0) continue;
      for (const f of finishers(r1)) consider([a, f]);
      if (dartsLeft >= 3) {
        for (const b of ALL_DARTS) {
          const r2 = r1 - dartPoints(b);
          if (r2 <= 0) continue;
          for (const f of finishers(r2)) consider([a, b, f]);
        }
      }
    }
  }
  cache.set(key, best);
  return best;
}

const SAFE_LABEL: Record<CheckoutMode, string> = {
  STRAIGHT_OUT: 'SAFE STRAIGHT-OUT',
  DOUBLE_OUT: 'DOUBLE OUT',
  MASTER_OUT: 'MASTER OUT',
  HYBRID_SUB_50: 'CHECKOUT',
};

const sameRoute = (a: CheckoutRoute | null, b: CheckoutRoute | null) => !!a && !!b && a.labels.join() === b.labels.join();

/** Both checkout paths for the current thrower (only when score <= 180). */
export function dualCheckout(score: number, dartsLeft: number, mode: CheckoutMode, special: SpecialRules): DualCheckout {
  const safe = bestCheckout(score, dartsLeft, mode);
  let bonus: CheckoutRoute | null = null;
  let bonusLabel: string | null = null;
  if (special.doubleCheckoutBonus.enabled) {
    bonus = bestCheckout(score, dartsLeft, mode, 'DOUBLE');
    bonusLabel = `DOUBLE BONUS +${special.doubleCheckoutBonus.points} PT`;
  }
  if (special.tripleCheckoutBonus.enabled) {
    const triple = bestCheckout(score, dartsLeft, mode, 'TRIPLE');
    if (triple && (!bonus || triple.cost < bonus.cost)) {
      bonus = triple;
      bonusLabel = `TRIPLE BONUS +${special.tripleCheckoutBonus.points} PT`;
    }
  }
  if (sameRoute(bonus, safe)) {
    // Safe route already earns the bonus: show it once, in gold.
    return { safe: null, safeLabel: SAFE_LABEL[mode], bonus, bonusLabel };
  }
  return { safe, safeLabel: SAFE_LABEL[mode], bonus, bonusLabel };
}
