import { resolveSlot } from './standings.ts';
import type { TournamentState } from './state.ts';
import type { Match, PlayoffRound, TeamSlot } from './types.ts';

export const groupLabel = (groupIndex: number) => `Group ${String.fromCharCode(65 + groupIndex)}`;

export const PLAYOFF_ROUND_LABEL: Record<PlayoffRound, string> = {
  QF: 'Quarterfinal',
  SF: 'Semifinal',
  THIRD_PLACE: '3rd Place Match',
  FINAL: 'Grand Final',
};

export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

export function matchNumber(state: TournamentState, matchId: string): number {
  return state.matches.findIndex((m) => m.id === matchId) + 1;
}

export function teamName(state: TournamentState, teamId: string): string {
  return state.teams.find((t) => t.id === teamId)?.name ?? teamId;
}

/** Display text for a slot: the team name if known, otherwise where it comes from. */
export function describeSlot(state: TournamentState, slot: TeamSlot): string {
  const resolved = slot.kind === 'TEAM' ? null : resolveSlot(state, slot);
  if (resolved) return teamName(state, resolved);
  switch (slot.kind) {
    case 'TEAM':
      return teamName(state, slot.teamId);
    case 'SEED':
      return `Seed ${slot.seed}`;
    case 'GROUP_RANK':
      return state.settings.structure.groupCount > 1
        ? `${groupLabel(slot.groupIndex)} ${ordinal(slot.rank)}`
        : `${ordinal(slot.rank)} Place`;
    case 'MATCH_WINNER':
      return `Winner M${matchNumber(state, slot.matchId)}`;
    case 'MATCH_LOSER':
      return `Loser M${matchNumber(state, slot.matchId)}`;
  }
}

export function matchLabel(state: TournamentState, match: Match): string {
  if (match.stage === 'PLAYOFF' && match.playoffRound) return PLAYOFF_ROUND_LABEL[match.playoffRound];
  const group = match.groupIndex !== null && state.settings.structure.groupCount > 1 ? `${groupLabel(match.groupIndex)} · ` : '';
  return `${group}Round ${match.groupRound ?? 1}`;
}

export function queuedMatches(state: TournamentState): Match[] {
  const byId = new Map(state.matches.map((m) => [m.id, m]));
  return state.queue.flatMap((id) => {
    const m = byId.get(id);
    return m && m.status !== 'COMPLETED' ? [m] : [];
  });
}

export function upNextMatch(state: TournamentState): Match | null {
  return queuedMatches(state)[0] ?? null;
}

export function playersOfSlot(state: TournamentState, slot: TeamSlot) {
  const teamId = resolveSlot(state, slot);
  if (!teamId) return [];
  return playersOfTeam(state, teamId);
}

export function playersOfTeam(state: TournamentState, teamId: string) {
  const team = state.teams.find((t) => t.id === teamId);
  return team ? team.playerIds.flatMap((id) => (state.players[id] ? [state.players[id]] : [])) : [];
}

export function hasStarted(state: TournamentState): boolean {
  return state.matches.some((m) => m.status !== 'SCHEDULED') || state.throws.length > 0;
}

export function placeholderCount(state: TournamentState): number {
  return state.teams.filter((t) => t.isPlaceholderName).length + Object.values(state.players).filter((p) => p.isPlaceholderName).length;
}
