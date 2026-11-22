import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, DEFAULT_STRUCTURE } from './defaults.ts';
import { tournamentReducer } from './reducer.ts';
import { isTimestampCell, parseRosterText } from './roster.ts';
import { bracketSeedOrder, buildSchedule, countBackToBack, roundRobinRounds } from './schedule.ts';
import { describeSlot, queuedMatches, upNextMatch } from './selectors.ts';
import { createEmptyState, type TournamentState } from './state.ts';
import { buildRoster, buildTournament, makeTournamentId, validateStructure } from './tournament.ts';
import type { StructureSettings, TournamentSetup } from './types.ts';

const structure = (patch: Partial<StructureSettings> = {}): StructureSettings => ({
  ...structuredClone(DEFAULT_STRUCTURE),
  ...patch,
});

const setup = (patch: Partial<TournamentSetup> = {}): TournamentSetup => ({
  id: 'cup-1',
  name: 'Friday Cup',
  createdAt: 1000,
  structure: structure(),
  rules: structuredClone(DEFAULT_RULES),
  roster: [],
  ...patch,
});

const freeze = <T>(o: T): T => {
  Object.freeze(o);
  for (const v of Object.values(o as object)) if (v && typeof v === 'object' && !Object.isFrozen(v)) freeze(v);
  return o;
};

describe('roster CSV import', () => {
  it('parses CSV, skips header and strips Google Forms timestamps', () => {
    const rows = parseRosterText(
      [
        'Timestamp,Team name,Player 1,Player 2',
        '2024/05/01 12:34:56,The Bulls,Anna,Ben',
        '5/1/2024 9:01:02 PM,"Smith, Jones & Co",Carl,',
        '',
        '1.5.2024 12:00:00,Arrows,Dana,Eve',
      ].join('\n'),
    );
    expect(rows).toEqual([
      { teamName: 'The Bulls', playerNames: ['Anna', 'Ben'] },
      { teamName: 'Smith, Jones & Co', playerNames: ['Carl'] },
      { teamName: 'Arrows', playerNames: ['Dana', 'Eve'] },
    ]);
  });

  it('parses TSV pasted from a spreadsheet without header', () => {
    expect(parseRosterText('Bulls\tAnna\tBen\nDarts\tCid\t')).toEqual([
      { teamName: 'Bulls', playerNames: ['Anna', 'Ben'] },
      { teamName: 'Darts', playerNames: ['Cid'] },
    ]);
  });

  it('recognises timestamps but not names', () => {
    expect(isTimestampCell('2024-05-01T12:00:00')).toBe(true);
    expect(isTimestampCell('Team 2024')).toBe(false);
  });
});

describe('round robin', () => {
  it('pairs every team exactly once (even and odd counts)', () => {
    for (const n of [4, 5, 6, 7, 8]) {
      const ids = Array.from({ length: n }, (_, i) => `t${i}`);
      const pairs = roundRobinRounds(ids).flat();
      expect(pairs).toHaveLength((n * (n - 1)) / 2);
      const keys = new Set(pairs.map(([a, b]) => [a, b].sort().join('-')));
      expect(keys.size).toBe(pairs.length);
    }
  });

  it('avoids back-to-back games in a multi-group schedule', () => {
    const { teams } = buildRoster(structure({ teamCount: 8, groupCount: 2 }), []);
    const matches = buildSchedule(structure({ teamCount: 8, groupCount: 2, mode: 'GROUPS_ONLY' }), teams);
    expect(matches).toHaveLength(12);
    expect(countBackToBack(matches)).toBe(0);
  });
});

describe('playoff bracket', () => {
  it('uses standard seed order', () => {
    expect(bracketSeedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(bracketSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('crosses groups in the semifinals and adds a 3rd place match before the final', () => {
    const s = structure({ playoff: { ...DEFAULT_STRUCTURE.playoff, bracketSize: 4, thirdPlaceMatch: true } });
    const state = buildTournament(setup({ structure: s }));
    const playoffs = state.matches.filter((m) => m.stage === 'PLAYOFF');
    expect(playoffs.map((m) => m.playoffRound)).toEqual(['SF', 'SF', 'THIRD_PLACE', 'FINAL']);
    expect(describeSlot(state, playoffs[0]!.home)).toBe('Group A 1st');
    expect(describeSlot(state, playoffs[0]!.away)).toBe('Group B 2nd');
    expect(playoffs[3]!.format).toBe('BO5');
    expect(describeSlot(state, playoffs[3]!.home)).toMatch(/^Winner M\d+$/);
  });

  it('gives byes to top seeds in playoffs-only mode', () => {
    const state = buildTournament(setup({ structure: structure({ mode: 'PLAYOFFS_ONLY', teamCount: 6 }) }));
    const rounds = state.matches.map((m) => m.playoffRound);
    expect(rounds).toEqual(['QF', 'QF', 'SF', 'SF', 'FINAL']);
    const firstSemi = state.matches[2]!;
    expect(firstSemi.home).toEqual({ kind: 'TEAM', teamId: 'team_01' });
  });
});

describe('validateStructure', () => {
  it('flags impossible configurations', () => {
    expect(validateStructure(structure())).toEqual([]);
    expect(validateStructure(structure({ teamCount: 3 }))).not.toEqual([]);
    expect(validateStructure(structure({ teamCount: 6, groupCount: 4 }))).not.toEqual([]);
    expect(validateStructure(structure({ mode: 'PLAYOFFS_ONLY', teamCount: 12 }))).not.toEqual([]);
    expect(validateStructure(structure({ teamCount: 4, groupCount: 2, playoff: { ...DEFAULT_STRUCTURE.playoff, bracketSize: 8 } }))).not.toEqual([]);
  });
});

describe('buildTournament', () => {
  it('creates immutable ids, placeholders and a full queue', () => {
    const state = buildTournament(setup({ roster: [{ teamName: 'Bulls', playerNames: ['Anna', ''] }] }));
    expect(state.teams).toHaveLength(8);
    expect(state.teams[0]).toMatchObject({ id: 'team_01', name: 'Bulls', isPlaceholderName: false });
    expect(state.teams[1]).toMatchObject({ id: 'team_02', name: 'Team B', isPlaceholderName: true });
    expect(state.players.player_01a).toMatchObject({ name: 'Anna', isPlaceholderName: false });
    expect(state.players.player_01b).toMatchObject({ name: 'Player 2', isPlaceholderName: true });
    expect(state.queue).toHaveLength(state.matches.length);
    expect(state.matches[0]!.id).toBe('match_01');
  });

  it('makes valid tournament ids', () => {
    expect(makeTournamentId('Pátek Šipky Cup!', 'AB12cd')).toBe('patek-sipky-cup-ab12cd');
    expect(makeTournamentId('***', 'x1')).toBe('tournament-x1');
  });
});

describe('tournamentReducer', () => {
  const base = (): TournamentState => freeze(buildTournament(setup()));

  it('renames by id and reverts blank names to placeholders', () => {
    let s = tournamentReducer(base(), { type: 'RENAME_TEAM', teamId: 'team_02', name: '  Arrows  ' });
    expect(s.teams[1]).toMatchObject({ name: 'Arrows', isPlaceholderName: false });
    s = tournamentReducer(s, { type: 'RENAME_TEAM', teamId: 'team_02', name: '' });
    expect(s.teams[1]).toMatchObject({ name: 'Team B', isPlaceholderName: true });
    s = tournamentReducer(s, { type: 'RENAME_PLAYER', playerId: 'player_03b', name: 'Zed' });
    expect(s.players.player_03b!.name).toBe('Zed');
  });

  it('stores compressed avatars on players', () => {
    const s = tournamentReducer(base(), { type: 'SET_PLAYER_AVATAR', playerId: 'player_01a', avatarDataUrl: 'data:image/webp;base64,AAA' });
    expect(s.players.player_01a!.avatarDataUrl).toContain('webp');
  });

  it('reorders the queue and sets the next match', () => {
    const s0 = base();
    const target = s0.queue[3]!;
    const s1 = tournamentReducer(s0, { type: 'SET_NEXT_MATCH', matchId: target });
    expect(upNextMatch(s1)?.id).toBe(target);
    const s2 = tournamentReducer(s1, { type: 'MOVE_IN_QUEUE', matchId: target, delta: 1 });
    expect(s2.queue[1]).toBe(target);
    expect(queuedMatches(s2)).toHaveLength(s0.matches.length);
  });

  it('updates formats only for unplayed matches of that round', () => {
    const s = tournamentReducer(base(), { type: 'SET_PLAYOFF_FORMAT', round: 'FINAL', format: 'BO7' });
    expect(s.matches.find((m) => m.playoffRound === 'FINAL')!.format).toBe('BO7');
    expect(s.settings.structure.playoff.formats.FINAL).toBe('BO7');
    const g = tournamentReducer(s, { type: 'SET_GROUP_FORMAT', format: 'BO3' });
    expect(g.matches.filter((m) => m.stage === 'GROUP').every((m) => m.format === 'BO3')).toBe(true);
  });

  it('merges nested special rules', () => {
    const s = tournamentReducer(base(), { type: 'UPDATE_RULES', patch: { specialRules: { doubleCheckoutBonus: { enabled: true } } } });
    expect(s.settings.rules.specialRules.doubleCheckoutBonus).toEqual({ enabled: true, points: 1 });
  });

  it('restructures while keeping names and photos', () => {
    let s = tournamentReducer(base(), { type: 'RENAME_TEAM', teamId: 'team_01', name: 'Bulls' });
    s = tournamentReducer(s, { type: 'SET_PLAYER_AVATAR', playerId: 'player_01a', avatarDataUrl: 'data:x' });
    const r = tournamentReducer(s, { type: 'RESTRUCTURE', structure: structure({ teamCount: 6, groupCount: 1, mode: 'GROUPS_ONLY' }) });
    expect(r.teams).toHaveLength(6);
    expect(r.teams[0]!.name).toBe('Bulls');
    expect(r.players.player_01a!.avatarDataUrl).toBe('data:x');
    expect(r.matches).toHaveLength(15);
  });

  it('adds and removes scheduled breaks, and only raises pin version', () => {
    let s = tournamentReducer(base(), { type: 'ADD_BREAK', id: 'b1', afterMatchId: 'match_06', name: 'Pizza', durationMinutes: 20 });
    expect(s.breaks).toHaveLength(1);
    s = tournamentReducer(s, { type: 'REMOVE_BREAK', breakId: 'b1' });
    expect(s.breaks).toHaveLength(0);
    s = tournamentReducer(s, { type: 'SET_PIN_VERSION', pinVersion: 3 });
    expect(tournamentReducer(s, { type: 'SET_PIN_VERSION', pinVersion: 2 }).security.pinVersion).toBe(3);
  });

  it('rejects backups with an unknown schema version and resets', () => {
    expect(() =>
      tournamentReducer(createEmptyState(), { type: 'REPLACE_STATE', state: { ...createEmptyState(), schemaVersion: 999 } }),
    ).toThrow();
    expect(tournamentReducer(base(), { type: 'RESET_STATE' })).toEqual(createEmptyState());
  });
});
