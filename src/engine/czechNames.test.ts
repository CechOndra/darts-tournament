import { describe, expect, it } from 'vitest';
import { randomRosterRows, rosterRowsToText } from './czechNames.ts';
import { parseRosterText } from './roster.ts';
import { buildRoster } from './tournament.ts';

describe('random Czech names', () => {
  it('gives unique teams and players, round-trips through the roster parser, and uses diacritics', () => {
    const rows = randomRosterRows(16, 2);
    expect(new Set(rows.map((r) => r.teamName)).size).toBe(16);
    const players = rows.flatMap((r) => r.playerNames);
    expect(players).toHaveLength(32);
    expect(new Set(players).size).toBe(32);
    expect(parseRosterText(rosterRowsToText(rows))).toEqual(rows);
    expect(players.join('').match(/[ěščřžýáíéúůďťňĚŠČŘŽ]/)).not.toBeNull();
  });

  it('copes with more teams than names', () => {
    expect(new Set(randomRosterRows(40, 1).map((r) => r.teamName)).size).toBe(40);
  });
});

describe('roster pictures', () => {
  it('buildRoster applies logo and avatar data URLs from the roster rows', () => {
    const { teams, players } = buildRoster({ teamCount: 2, playersPerTeam: 2, groupCount: 1, mode: 'GROUPS_PLAYOFFS' } as never, [
      { teamName: 'A', playerNames: [], logoDataUrl: 'L0', avatarDataUrls: ['P0', 'P1'] },
    ]);
    expect(teams[0]!.logoDataUrl).toBe('L0');
    expect(teams[1]!.logoDataUrl).toBeNull();
    expect(Object.values(players).map((p) => p.avatarDataUrl)).toEqual(['P0', 'P1', null, null]);
  });
});
