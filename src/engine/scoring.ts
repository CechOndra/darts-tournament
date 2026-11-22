import type { CheckoutMode, DartThrow } from './types.ts';

/**
 * Pure dart scoring rules. A dart is (segment, multiplier):
 *   segment 0 = miss, 1..20, 25 = outer bull, 50 = bullseye (multiplier 1).
 * Bull 50 counts as a double for checkout purposes.
 */

export type Multiplier = 0 | 1 | 2 | 3;

export interface DartInput {
  segment: number;
  multiplier: Multiplier;
}

export function isValidDart({ segment, multiplier }: DartInput): boolean {
  if (segment === 0) return multiplier === 0;
  if (segment === 25 || segment === 50) return multiplier === 1;
  return Number.isInteger(segment) && segment >= 1 && segment <= 20 && (multiplier === 1 || multiplier === 2 || multiplier === 3);
}

export function dartPoints({ segment, multiplier }: DartInput): number {
  if (segment === 0) return 0;
  if (segment === 25 || segment === 50) return segment;
  return segment * multiplier;
}

export const isDoubleDart = (d: DartInput) => (d.segment >= 1 && d.segment <= 20 && d.multiplier === 2) || d.segment === 50;
export const isTripleDart = (d: DartInput) => d.segment >= 1 && d.segment <= 20 && d.multiplier === 3;

export function dartLabel(d: DartInput): string {
  if (d.segment === 0) return 'MISS';
  if (d.segment === 50) return 'BULL';
  if (d.segment === 25) return '25';
  return `${d.multiplier === 3 ? 'T' : d.multiplier === 2 ? 'D' : 'S'}${d.segment}`;
}

/** Is finishing on this dart allowed (given the score before the dart)? */
export function isValidFinishDart(d: DartInput, scoreBeforeDart: number, mode: CheckoutMode): boolean {
  switch (mode) {
    case 'STRAIGHT_OUT':
      return true;
    case 'DOUBLE_OUT':
      return isDoubleDart(d);
    case 'MASTER_OUT':
      return isDoubleDart(d) || isTripleDart(d);
    case 'HYBRID_SUB_50':
      return scoreBeforeDart > 50 || isDoubleDart(d);
  }
}

/** Lowest remaining score that can still be checked out under the mode (1 is dead for double/master). */
function deadScore(remaining: number, scoreBeforeDart: number, mode: CheckoutMode): boolean {
  if (remaining !== 1) return false;
  if (mode === 'STRAIGHT_OUT') return false;
  if (mode === 'HYBRID_SUB_50') return scoreBeforeDart <= 50; // leaving 1 from >50 is legal (but dead later)
  return true;
}

export type DartOutcome = 'SCORE' | 'BUST' | 'CHECKOUT';

/** Outcome of throwing `d` when the team needs `scoreBeforeDart`. */
export function evaluateDart(d: DartInput, scoreBeforeDart: number, mode: CheckoutMode): { outcome: DartOutcome; remaining: number } {
  return evaluatePoints(d, dartPoints(d), scoreBeforeDart, mode);
}

/** Like evaluateDart, but with the dart worth `points` (Power Card modifiers). Finish validity still uses the dart's ring. */
export function evaluatePoints(d: DartInput, points: number, scoreBeforeDart: number, mode: CheckoutMode): { outcome: DartOutcome; remaining: number } {
  const remaining = scoreBeforeDart - points;
  if (remaining < 0) return { outcome: 'BUST', remaining: scoreBeforeDart };
  if (remaining === 0) {
    return isValidFinishDart(d, scoreBeforeDart, mode) ? { outcome: 'CHECKOUT', remaining: 0 } : { outcome: 'BUST', remaining: scoreBeforeDart };
  }
  if (deadScore(remaining, scoreBeforeDart, mode)) return { outcome: 'BUST', remaining: scoreBeforeDart };
  return { outcome: 'SCORE', remaining };
}

export function checkoutTypeOf(d: DartInput): DartThrow['checkoutType'] {
  if (d.segment === 25 || d.segment === 50) return 'BULL';
  if (d.multiplier === 3) return 'TRIPLE';
  if (d.multiplier === 2) return 'DOUBLE';
  return 'SINGLE';
}

export const legsToWin = (format: 'BO1' | 'BO3' | 'BO5' | 'BO7') => ({ BO1: 1, BO3: 2, BO5: 3, BO7: 4 })[format];
