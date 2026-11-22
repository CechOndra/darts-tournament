import { createDefaultSettings, LIMITS } from './defaults.ts';
import { buildSchedule, nextPowerOfTwo } from './schedule.ts';
import { createEmptyState, type TournamentState } from './state.ts';
import type { Player, RosterRow, StructureSettings, Team, TournamentSetup } from './types.ts';

export const teamId = (index: number) => `team_${String(index + 1).padStart(2, '0')}`;
export const playerId = (teamIndex: number, slot: number) =>
  `player_${String(teamIndex + 1).padStart(2, '0')}${String.fromCharCode(97 + slot)}`;

export const teamPlaceholderName = (index: number) =>
  index < 26 ? `Team ${String.fromCharCode(65 + index)}` : `Team ${index + 1}`;
export const playerPlaceholderName = (slot: number) => `Player ${slot + 1}`;

/** Validation messages for a structure (empty array = valid). */
export function validateStructure(s: StructureSettings): string[] {
  const errors: string[] = [];
  const { teamCount, groupCount, mode } = s;
  if (teamCount < LIMITS.teamCount.min || teamCount > LIMITS.teamCount.max) {
    errors.push(`Team count must be between ${LIMITS.teamCount.min} and ${LIMITS.teamCount.max}.`);
  }
  if (!LIMITS.playersPerTeam.includes(s.playersPerTeam)) errors.push('Players per team must be 1, 2 or 3.');
  if (mode !== 'PLAYOFFS_ONLY') {
    if (groupCount < LIMITS.groupCount.min || groupCount > LIMITS.groupCount.max) {
      errors.push(`Group count must be between ${LIMITS.groupCount.min} and ${LIMITS.groupCount.max}.`);
    } else if (Math.floor(teamCount / groupCount) < 2) {
      errors.push('Every group needs at least 2 teams.');
    }
  }
  if (mode === 'GROUPS_AND_PLAYOFFS') {
    const size = s.playoff.bracketSize;
    if (size > teamCount) errors.push(`Playoff bracket (Top ${size}) is larger than the number of teams.`);
    const minGroupSize = Math.floor(teamCount / Math.max(1, groupCount));
    const qualifiersPerGroup = Math.ceil(size / Math.max(1, groupCount));
    if (qualifiersPerGroup > minGroupSize) {
      errors.push(`Top ${size} needs ${qualifiersPerGroup} qualifiers per group, but the smallest group has ${minGroupSize} teams.`);
    }
  }
  if (mode === 'PLAYOFFS_ONLY' && nextPowerOfTwo(teamCount) > 8) {
    errors.push('Playoffs-only supports at most 8 teams (Quarterfinals is the first round).');
  }
  return errors;
}

/** Build teams + players from a roster, filling blanks with placeholder names. */
export function buildRoster(
  structure: Pick<StructureSettings, 'teamCount' | 'playersPerTeam' | 'groupCount' | 'mode'>,
  roster: RosterRow[],
  previous?: { teams: Team[]; players: Record<string, Player> },
): { teams: Team[]; players: Record<string, Player> } {
  const groups = structure.mode === 'PLAYOFFS_ONLY' ? 1 : Math.max(1, structure.groupCount);
  const teams: Team[] = [];
  const players: Record<string, Player> = {};
  for (let i = 0; i < structure.teamCount; i++) {
    const id = teamId(i);
    const prevTeam = previous?.teams.find((t) => t.id === id);
    const importedName = roster[i]?.teamName.trim() ?? '';
    const name = importedName || (prevTeam && !prevTeam.isPlaceholderName ? prevTeam.name : '');
    const playerIds: string[] = [];
    for (let p = 0; p < structure.playersPerTeam; p++) {
      const pid = playerId(i, p);
      const prevPlayer = previous?.players[pid];
      const importedPlayer = roster[i]?.playerNames[p]?.trim() ?? '';
      const pname = importedPlayer || (prevPlayer && !prevPlayer.isPlaceholderName ? prevPlayer.name : '');
      players[pid] = {
        id: pid,
        teamId: id,
        name: pname || playerPlaceholderName(p),
        isPlaceholderName: !pname,
        avatarDataUrl: prevPlayer?.avatarDataUrl ?? null,
      };
      playerIds.push(pid);
    }
    teams.push({
      id,
      name: name || teamPlaceholderName(i),
      isPlaceholderName: !name,
      groupIndex: i % groups,
      playerIds,
      hand: prevTeam?.hand ?? [],
      logoDataUrl: prevTeam?.logoDataUrl ?? null,
    });
  }
  return { teams, players };
}

/** Pure: setup wizard input -> fresh tournament state. */
export function buildTournament(setup: TournamentSetup): TournamentState {
  const errors = validateStructure(setup.structure);
  if (errors.length) throw new Error(errors.join(' '));
  const base = createEmptyState();
  const settings = createDefaultSettings();
  settings.structure = structuredClone(setup.structure);
  settings.rules = structuredClone(setup.rules);
  settings.visibility = { ...settings.visibility, ...setup.visibility };
  settings.table = { ...settings.table, ...setup.table };
  const { teams, players } = buildRoster(setup.structure, setup.roster);
  const matches = buildSchedule(setup.structure, teams);
  return {
    ...base,
    meta: { id: setup.id, name: setup.name.trim() || 'Tournament', createdAt: setup.createdAt },
    settings,
    teams,
    players,
    matches,
    queue: matches.map((m) => m.id),
  };
}

/** Destructive: regenerate teams/groups/schedule for a new structure, keeping names & photos by id. */
export function restructureTournament(state: TournamentState, structure: StructureSettings): TournamentState {
  const errors = validateStructure(structure);
  if (errors.length) throw new Error(errors.join(' '));
  const { teams, players } = buildRoster(structure, [], { teams: state.teams, players: state.players });
  const matches = buildSchedule(structure, teams);
  return {
    ...state,
    settings: { ...state.settings, structure: structuredClone(structure) },
    teams,
    players,
    matches,
    queue: matches.map((m) => m.id),
    breaks: [],
    throws: [],
    scorerDutyOverride: null,
    live: null,
    completedOrder: [],
  };
}

/** Lowercase slug + random suffix, valid as a tournament id (^[A-Za-z0-9_-]{1,64}$). */
export function makeTournamentId(name: string, randomSuffix: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${slug || 'tournament'}-${randomSuffix.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)}`;
}
