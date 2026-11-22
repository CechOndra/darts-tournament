import { replayMatch } from './match.ts';
import type { TournamentState } from './state.ts';
import type { Match, Side, TeamSlot } from './types.ts';

export interface StandingRow {
  teamId: string;
  groupIndex: number;
  played: number;
  wins: number;
  losses: number;
  bonusPoints: number;
  legsFor: number;
  legsAgainst: number;
  legDiff: number;
  points: number;
  darts: number;
  average: number;
  rank: number;
}

/** Resolve a match slot to a concrete team id (null while still undecided). */
export function resolveSlot(state: TournamentState, slot: TeamSlot, depth = 0): string | null {
  if (depth > 8) return null;
  switch (slot.kind) {
    case 'TEAM':
      return slot.teamId;
    case 'SEED':
      return state.teams[slot.seed - 1]?.id ?? null;
    case 'MATCH_WINNER':
    case 'MATCH_LOSER': {
      const m = state.matches.find((x) => x.id === slot.matchId);
      if (!m || m.status !== 'COMPLETED' || !m.winnerTeamId) return null;
      if (slot.kind === 'MATCH_WINNER') return m.winnerTeamId;
      const home = resolveSlot(state, m.home, depth + 1);
      const away = resolveSlot(state, m.away, depth + 1);
      return m.winnerTeamId === home ? away : home;
    }
    case 'GROUP_RANK': {
      if (!isGroupComplete(state, slot.groupIndex)) return null;
      return groupStandings(state, slot.groupIndex)[slot.rank - 1]?.teamId ?? null;
    }
  }
}

export function matchTeams(state: TournamentState, match: Match): { home: string | null; away: string | null } {
  return { home: resolveSlot(state, match.home), away: resolveSlot(state, match.away) };
}

export function isGroupComplete(state: TournamentState, groupIndex: number): boolean {
  const ms = state.matches.filter((m) => m.stage === 'GROUP' && m.groupIndex === groupIndex);
  return ms.length > 0 && ms.every((m) => m.status === 'COMPLETED');
}

/**
 * Group table. Tiebreakers: 1. match wins, 2. special bonus points,
 * 3. head-to-head, 4. leg differential, 5. 3-dart average.
 */
export function groupStandings(state: TournamentState, groupIndex: number): StandingRow[] {
  const teams = state.teams.filter((t) => t.groupIndex === groupIndex);
  const rows = new Map<string, StandingRow>(
    teams.map((t) => [
      t.id,
      { teamId: t.id, groupIndex, played: 0, wins: 0, losses: 0, bonusPoints: 0, legsFor: 0, legsAgainst: 0, legDiff: 0, points: 0, darts: 0, average: 0, rank: 0 },
    ]),
  );
  const headToHead = new Map<string, string>(); // "a|b" -> winner
  const rules = state.settings.rules;

  for (const m of state.matches) {
    if (m.stage !== 'GROUP' || m.groupIndex !== groupIndex || m.status !== 'COMPLETED') continue;
    if (m.home.kind !== 'TEAM' || m.away.kind !== 'TEAM') continue;
    const ids: Record<Side, string> = { home: m.home.teamId, away: m.away.teamId };
    const replay = replayMatch(state.throws, m, ids, rules);
    for (const side of ['home', 'away'] as Side[]) {
      const row = rows.get(ids[side]);
      if (!row) continue;
      const other: Side = side === 'home' ? 'away' : 'home';
      row.played++;
      if (m.winnerTeamId === ids[side]) row.wins++;
      else row.losses++;
      row.legsFor += m.legsWon[side];
      row.legsAgainst += m.legsWon[other];
      row.bonusPoints += replay.stats[side].bonusPoints;
      row.points += replay.stats[side].points;
      row.darts += replay.stats[side].darts;
    }
    if (m.winnerTeamId) headToHead.set([ids.home, ids.away].sort().join('|'), m.winnerTeamId);
  }

  const list = [...rows.values()].map((r) => ({
    ...r,
    legDiff: r.legsFor - r.legsAgainst,
    average: r.darts ? Math.round((r.points / r.darts) * 300) / 100 : 0,
  }));
  const seed = (id: string) => state.teams.findIndex((t) => t.id === id);

  list.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.bonusPoints !== a.bonusPoints) return b.bonusPoints - a.bonusPoints;
    // Head-to-head: mini-league among all teams tied on wins + bonus.
    const tied = list.filter((r) => r.wins === a.wins && r.bonusPoints === a.bonusPoints).map((r) => r.teamId);
    const h2h = (id: string) => tied.filter((o) => o !== id && headToHead.get([id, o].sort().join('|')) === id).length;
    if (h2h(b.teamId) !== h2h(a.teamId)) return h2h(b.teamId) - h2h(a.teamId);
    if (b.legDiff !== a.legDiff) return b.legDiff - a.legDiff;
    if (b.average !== a.average) return b.average - a.average;
    return seed(a.teamId) - seed(b.teamId);
  });
  return list.map((r, i) => ({ ...r, rank: i + 1 }));
}

export function allGroupStandings(state: TournamentState): StandingRow[][] {
  if (state.settings.structure.mode === 'PLAYOFFS_ONLY') return [];
  return Array.from({ length: state.settings.structure.groupCount }, (_, g) => groupStandings(state, g));
}

// ------------------------------------------------------------------ table duty

export type ScorerDuty =
  | { kind: 'ADMIN'; reason: 'FIRST_MATCH' | 'OVERRIDE' | 'FALLBACK' }
  | { kind: 'TEAM'; teamId: string; reason: 'LOSER' | 'OVERRIDE' };

/**
 * "Loser scores next": the losing team of the most recently completed match scores
 * the next one. Match 1 = Admin. If that loser must play the next match itself,
 * fall back to Admin. The Admin override always wins.
 */
export function scorerDutyFor(state: TournamentState, nextMatch: Match | null): ScorerDuty {
  const o = state.scorerDutyOverride;
  if (o === 'ADMIN') return { kind: 'ADMIN', reason: 'OVERRIDE' };
  if (o && state.teams.some((t) => t.id === o)) return { kind: 'TEAM', teamId: o, reason: 'OVERRIDE' };
  const lastId = state.completedOrder[state.completedOrder.length - 1];
  const last = lastId ? state.matches.find((m) => m.id === lastId) : null;
  if (!last || !last.winnerTeamId) return { kind: 'ADMIN', reason: 'FIRST_MATCH' };
  const { home, away } = matchTeams(state, last);
  const loser = last.winnerTeamId === home ? away : home;
  if (!loser) return { kind: 'ADMIN', reason: 'FALLBACK' };
  if (nextMatch) {
    const next = matchTeams(state, nextMatch);
    if (next.home === loser || next.away === loser) return { kind: 'ADMIN', reason: 'FALLBACK' };
  }
  return { kind: 'TEAM', teamId: loser, reason: 'LOSER' };
}
