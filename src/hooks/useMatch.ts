import { useMemo } from 'react';
import { computeMatchView, type MatchView } from '../engine/match.ts';
import { upNextMatch } from '../engine/selectors.ts';
import { scorerDutyFor, type ScorerDuty } from '../engine/standings.ts';
import type { TournamentState } from '../engine/state.ts';
import type { Match } from '../engine/types.ts';

export function useMatchView(state: TournamentState | null): MatchView | null {
  return useMemo(() => (state ? computeMatchView(state) : null), [state]);
}

/** The match the duty applies to + who scores it. */
export function useDuty(state: TournamentState | null): { next: Match | null; duty: ScorerDuty | null } {
  return useMemo(() => {
    if (!state) return { next: null, duty: null };
    // During a live match the duty shown is for the *following* match once it is complete,
    // otherwise for the live/up-next match.
    const live = state.live;
    const next =
      live && live.phase !== 'POST_MATCH'
        ? (state.matches.find((m) => m.id === live.matchId) ?? null)
        : upNextMatch(state);
    return { next, duty: scorerDutyFor(state, next) };
  }, [state]);
}
