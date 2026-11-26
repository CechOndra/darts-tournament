import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, DEFAULT_STRUCTURE } from './defaults.ts';
import { tournamentReducer } from './reducer.ts';
import { playerAverage, simulateMatches, simulateNextMatch } from './simulate.ts';
import { createEmptyState } from './state.ts';

const seeded = (seed: number) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

function fresh(test: boolean) {
  let s = tournamentReducer(createEmptyState(), {
    type: 'INITIALIZE',
    setup: { id: 't', name: 'T', createdAt: 1000, structure: { ...structuredClone(DEFAULT_STRUCTURE), teamCount: 8, groupCount: 2 }, rules: structuredClone(DEFAULT_RULES), roster: [] },
  });
  if (test) s = tournamentReducer(s, { type: 'SET_TEST_MODE', value: true });
  return s;
}

describe('test tournament simulator', () => {
  it('does nothing on a real tournament', () => {
    const s = fresh(false);
    expect(simulateNextMatch(s, undefined, seeded(1))).toBe(s);
  });

  it('plays the whole group stage with believable results', () => {
    const s0 = fresh(true);
    const s = simulateMatches(s0, Infinity, { average: 50, variance: 8 }, seeded(7), 'GROUP');
    const groups = s.matches.filter((m) => m.stage === 'GROUP');
    expect(groups.every((m) => m.status === 'COMPLETED' && m.winnerTeamId)).toBe(true);
    expect(s.matches.filter((m) => m.stage === 'PLAYOFF').every((m) => m.status === 'SCHEDULED')).toBe(true);
    expect(s.live).toBeNull();
    const avg = (s.throws.reduce((a, t) => a + t.effectivePoints, 0) / s.throws.length) * 3;
    expect(avg).toBeGreaterThan(35);
    expect(avg).toBeLessThan(65);
  });

  it('keeps going into the playoffs and has stable player skill', () => {
    const s = simulateMatches(fresh(true), Infinity, { average: 60, variance: 5 }, seeded(3));
    expect(s.matches.every((m) => m.status === 'COMPLETED')).toBe(true);
    expect(playerAverage('player_01a', { average: 60, variance: 5 })).toBe(playerAverage('player_01a', { average: 60, variance: 5 }));
  });

  it('cannot turn on test mode after real results exist', () => {
    let s = fresh(true);
    s = simulateMatches(s, 1, undefined, seeded(2));
    s = tournamentReducer(s, { type: 'SET_TEST_MODE', value: false });
    expect(s.meta?.isTest).toBeUndefined();
    expect(tournamentReducer(s, { type: 'SET_TEST_MODE', value: true }).meta?.isTest).toBeUndefined();
  });
});
