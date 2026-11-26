import { bestCheckout } from './checkout.ts';
import { rulesFor, type MatchView, type VisitView } from './match.ts';
import type { TournamentState } from './state.ts';

/**
 * Darts announcer lines for a finished visit, like a TV caller:
 * "One hundred and eighty!", "Sixty", "No score", "Game shot, and the leg!",
 * then "Anna, you require 40" when the next thrower is on a finish.
 */
/** File name (without .mp3) of the referee clip for a finished visit: '180', 'noscore', 'gameshot-leg', 'gameshot-match'. */
export function calloutKey(visit: Pick<VisitView, 'checkout' | 'bust' | 'scored'>, matchWon: boolean): string {
  if (visit.checkout) return matchWon ? 'gameshot-match' : 'gameshot-leg';
  return visit.bust || visit.scored === 0 ? 'noscore' : String(visit.scored);
}

export function callerLines(state: TournamentState, view: MatchView, visit: VisitView): string[] {
  const lines: string[] = [];
  if (visit.checkout) {
    lines.push(view.winner ? 'Game shot, and the match!' : 'Game shot, and the leg!');
    return lines;
  }
  if (visit.bust || visit.scored === 0) lines.push('No score');
  else if (visit.scored === 180) lines.push('One hundred and eighty!');
  else lines.push(String(visit.scored));

  // "You require": the next visit starts on a score that can be finished this visit.
  const turn = view.turn;
  if (state.settings.visibility.callRequire !== false && turn && turn.darts.length === 0 && turn.remaining <= 170) {
    const rules = rulesFor(state, view.match);
    if (bestCheckout(turn.remaining, turn.maxDarts, rules.checkoutMode)) {
      const name = state.players[turn.playerId]?.name ?? '';
      lines.push(`${name ? `${name}, ` : ''}you require ${turn.remaining}`);
    }
  }
  return lines;
}
