import { useEffect, useMemo, useState } from 'react';
import { computeAwards, type Award } from '../engine/awards.ts';
import { projectSchedule, type Projection } from '../engine/pace.ts';
import type { TournamentState } from '../engine/state.ts';
import { collectStats, futCards, playerMetrics, type FutCard, type PlayerMetrics } from '../engine/stats.ts';

export interface TournamentStats {
  metrics: PlayerMetrics[];
  cards: FutCard[];
  awards: Award[];
}

/** Stats, FUT cards and awards, recomputed only when the tournament state changes. */
export function useTournamentStats(state: TournamentState | null): TournamentStats | null {
  return useMemo(() => {
    if (!state) return null;
    const data = collectStats(state);
    const metrics = playerMetrics(state, data);
    return { metrics, cards: futCards(state, metrics), awards: computeAwards(state, data) };
  }, [state]);
}

/** Schedule projection, refreshed every 30 s so ETAs move with the clock. */
export function useProjection(state: TournamentState | null): Projection | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return useMemo(() => (state ? projectSchedule(state, Date.now()) : null), [state, now]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** "P1" / "P2" / "SOLO" for FUT cards. */
export function playerRole(state: TournamentState, playerId: string): string {
  const team = state.teams.find((t) => t.playerIds.includes(playerId));
  if (!team || team.playerIds.length === 1) return 'SOLO';
  return `P${team.playerIds.indexOf(playerId) + 1}`;
}
