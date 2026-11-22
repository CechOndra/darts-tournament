import { evaluateDart, type DartInput } from './scoring.ts';
import type { CheckoutMode } from './types.ts';

/**
 * Practice sandbox for the scorer tablet: a single-player leg that never touches
 * tournament state. Pure, so the same scoring rules apply as in real matches.
 */
export interface PracticeVisit {
  darts: DartInput[];
  scoreBefore: number;
  scored: number;
  bust: boolean;
  checkout: boolean;
  complete: boolean;
}

export interface PracticeState {
  startingScore: number;
  mode: CheckoutMode;
  darts: DartInput[];
}

export interface PracticeView {
  remaining: number;
  visits: PracticeVisit[];
  current: PracticeVisit;
  finished: boolean;
}

export const newPractice = (startingScore: number, mode: CheckoutMode): PracticeState => ({ startingScore, mode, darts: [] });

export function practiceView(p: PracticeState): PracticeView {
  const visits: PracticeVisit[] = [];
  let remaining = p.startingScore;
  let visit: PracticeVisit | null = null;
  let finished = false;
  for (const d of p.darts) {
    if (finished) break;
    if (!visit) visit = { darts: [], scoreBefore: remaining, scored: 0, bust: false, checkout: false, complete: false };
    visit.darts.push(d);
    const r = evaluateDart(d, remaining, p.mode);
    if (r.outcome === 'BUST') {
      visit.bust = true;
      visit.scored = 0;
      remaining = visit.scoreBefore;
    } else {
      remaining = r.remaining;
      visit.scored = visit.scoreBefore - remaining;
      if (r.outcome === 'CHECKOUT') {
        visit.checkout = true;
        finished = true;
      }
    }
    if (visit.bust || visit.checkout || visit.darts.length === 3) {
      visit.complete = true;
      visits.push(visit);
      visit = null;
    }
  }
  const current = visit ?? { darts: [], scoreBefore: remaining, scored: 0, bust: false, checkout: false, complete: false };
  return { remaining, visits, current, finished };
}

export function practiceThrow(p: PracticeState, d: DartInput): PracticeState {
  return practiceView(p).finished ? p : { ...p, darts: [...p.darts, d] };
}

export const practiceUndo = (p: PracticeState): PracticeState => ({ ...p, darts: p.darts.slice(0, -1) });
