import { ArrowLeftRight } from 'lucide-react';
import { useState } from 'react';
import { computeMatchView } from '../../engine/match.ts';
import { teamName } from '../../engine/selectors.ts';
import { matchTeams } from '../../engine/standings.ts';
import type { TournamentState } from '../../engine/state.ts';
import type { Side } from '../../engine/types.ts';
import { usePlayerLabel } from '../../hooks/PlayerNames.tsx';
import { useDispatch } from '../../hooks/TransportProvider.tsx';
import { Button, SegmentedControl } from '../ui.tsx';

/** Throwing order of a team in a leg: explicit fix, else live rotation, else the order darts were thrown. */
function orderInLeg(state: TournamentState, matchId: string, legIndex: number, teamId: string): string[] {
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) return [];
  const live = state.live?.matchId === matchId ? state.live : null;
  const setup = live?.legSetups[legIndex];
  if (live && setup) {
    const side: Side = live.homeTeamId === teamId ? 'home' : 'away';
    const n = team.playerIds.length;
    return setup.order?.[side] ?? Array.from({ length: n }, (_, i) => team.playerIds[(setup.firstPlayer[side] + i) % n]!);
  }
  const seen: string[] = [];
  for (const t of state.throws) if (t.matchId === matchId && t.legIndex === legIndex && t.teamId === teamId && !seen.includes(t.playerId)) seen.push(t.playerId);
  for (const p of team.playerIds) if (!seen.includes(p)) seen.push(p);
  return seen;
}

/**
 * Fix "they threw in the wrong order": swap two players of a team for one leg.
 * Darts already thrown in that leg move to the right player; the rest of the leg follows the new order.
 */
export function PlayerOrderTool({ state, matchId }: { state: TournamentState; matchId: string }) {
  const dispatch = useDispatch();
  const label = usePlayerLabel(state);
  const match = state.matches.find((m) => m.id === matchId);
  const view = state.live?.matchId === matchId ? computeMatchView(state) : null;
  const legCount = Math.max(view ? view.currentLegIndex + 1 : 0, ...state.throws.filter((t) => t.matchId === matchId).map((t) => t.legIndex + 1), 1);
  const [leg, setLeg] = useState(legCount - 1);
  if (!match) return null;
  const ids = view ? view.teamIds : matchTeams(state, match);
  const teams = [ids.home, ids.away].filter((t): t is string => !!t);
  const multi = teams.filter((t) => (state.teams.find((x) => x.id === t)?.playerIds.length ?? 1) > 1);
  if (!multi.length) return <p className="text-sm text-text-muted">Singles teams: there is no player order to fix.</p>;
  const legIdx = Math.min(leg, legCount - 1);

  return (
    <div className="space-y-3">
      {legCount > 1 && (
        <SegmentedControl
          ariaLabel="Leg"
          value={legIdx}
          options={Array.from({ length: legCount }, (_, i) => ({ value: i, label: `Leg ${i + 1}` }))}
          onChange={setLeg}
        />
      )}
      {multi.map((teamId) => {
        const order = orderInLeg(state, matchId, legIdx, teamId);
        return (
          <div key={teamId} className="space-y-2 rounded-md border border-border-subtle p-3">
            <p className="text-sm font-semibold">{teamName(state, teamId)}</p>
            <div className="flex flex-wrap items-center gap-2">
              {order.map((pid, i) => (
                <div key={pid} className="flex items-center gap-2">
                  <span className="rounded-md bg-bg-elevated px-3 py-2 text-sm">
                    <span className="mr-1 text-xs text-text-muted">{i + 1}.</span>
                    {state.players[pid] && label(state.players[pid]!)}
                  </span>
                  {i < order.length - 1 && (
                    <Button
                      size="sm"
                      icon={ArrowLeftRight}
                      aria-label={`Swap ${state.players[pid]?.name} and ${state.players[order[i + 1]!]?.name}`}
                      onClick={() =>
                        void dispatch({ type: 'SWAP_PLAYERS_IN_LEG', matchId, legIndex: legIdx, teamId, a: pid, b: order[i + 1]! }, { persist: 'immediate' })
                      }
                    >
                      Swap
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-text-muted">Darts already thrown in this leg move to the correct player, so stats and FUT cards stay right.</p>
    </div>
  );
}
