import { useEffect, useRef } from 'react';
import { calloutKey, callerLines } from '../../engine/caller.ts';
import type { MatchView } from '../../engine/match.ts';
import type { TournamentState } from '../../engine/state.ts';
import { callScore } from '../../services/audio/caller.ts';

/** Announces each finished visit on the stage speakers when the admin turned the caller on. */
export function ScoreCaller({ state, view }: { state: TournamentState; view: MatchView | null }) {
  const v = view?.lastCompletedVisit ?? null;
  const key = v && view ? `${view.match.id}-${v.legIndex}-${v.visitIndex}-${v.darts.length}` : '';
  const prev = useRef<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    const before = prev.current;
    prev.current = key;
    if (before === null || before === key || !v || !view) return;
    const vis = stateRef.current.settings.visibility;
    if (vis.scoreCaller !== true) return;
    // With a referee clip, "you require" only follows when the admin switched it on explicitly.
    void callScore(calloutKey(v, !!view.winner), callerLines(stateRef.current, view, v), vis.callRequire === true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
