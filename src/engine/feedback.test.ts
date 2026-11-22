import { describe, expect, it } from 'vitest';
import type { EngineAction } from './actions.ts';
import { DEFAULT_RULES, DEFAULT_STRUCTURE } from './defaults.ts';
import { newPractice, practiceThrow, practiceUndo, practiceView } from './practice.ts';
import { tournamentReducer } from './reducer.ts';
import { upNextMatch } from './selectors.ts';
import { matchAfter, matchTeams, scorerDutyFor } from './standings.ts';
import { migrateState, STATE_SCHEMA_VERSION, type TournamentState } from './state.ts';
import { buildTournament } from './tournament.ts';
import type { ScorerDutyRule } from './types.ts';

const run = (s: TournamentState, ...actions: EngineAction[]) => actions.reduce(tournamentReducer, s);

function make(dutyRule?: ScorerDutyRule): TournamentState {
  return buildTournament({
    id: 't',
    name: 'Test',
    createdAt: 1,
    structure: { ...structuredClone(DEFAULT_STRUCTURE), teamCount: 6, groupCount: 1, mode: 'GROUPS_ONLY', groupFormat: 'BO1' },
    rules: { ...structuredClone(DEFAULT_RULES), startingScore: 301, checkoutMode: 'STRAIGHT_OUT' },
    table: dutyRule ? { dutyRule } : undefined,
    roster: [],
  });
}

let seq = 0;
/** Play the up-next BO1 match: home throws 301 straight out (T20 x5 + T20... ) quickly. */
function playNext(s: TournamentState): { s: TournamentState; winner: string; loser: string } {
  const m = upNextMatch(s)!;
  s = run(s, { type: 'START_MATCH', matchId: m.id, at: 1 });
  s = run(s, { type: 'SET_LEG_START', legIndex: 0, firstTeam: 'home', resolvedBy: 'MANUAL' }, { type: 'BEGIN_PLAY' });
  const dart = (segment: number, multiplier: 0 | 1 | 2 | 3): EngineAction => ({ type: 'THROW_DART', id: `x${++seq}`, segment, multiplier, at: seq });
  // home 180, away 0, home 121 straight out (T20 T20 S1)
  s = run(s, dart(20, 3), dart(20, 3), dart(20, 3), dart(0, 0), dart(0, 0), dart(0, 0), dart(20, 3), dart(20, 3), dart(1, 1));
  const t = matchTeams(s, m);
  s = run(s, { type: 'CONTINUE_TO_NEXT' });
  return { s, winner: t.home!, loser: t.away! };
}

describe('scorer duty rules', () => {
  it('defaults to loser scores next', () => {
    expect(make().settings.table.dutyRule).toBe('LOSER_SCORES_NEXT');
  });

  it('ADMIN_ALWAYS keeps the host on the tablet', () => {
    const { s } = playNext(make('ADMIN_ALWAYS'));
    expect(scorerDutyFor(s, upNextMatch(s))).toEqual({ kind: 'ADMIN', reason: 'RULE' });
  });

  it('WINNER_SCORES_NEXT picks the winner unless they play next', () => {
    const { s, winner } = playNext(make('WINNER_SCORES_NEXT'));
    const next = upNextMatch(s)!;
    const t = matchTeams(s, next);
    const duty = scorerDutyFor(s, next);
    if (t.home === winner || t.away === winner) expect(duty).toEqual({ kind: 'ADMIN', reason: 'FALLBACK' });
    else expect(duty).toEqual({ kind: 'TEAM', teamId: winner, reason: 'WINNER' });
  });

  it('ON_DECK_TEAM picks a team from the following match, even for match 1', () => {
    const s = make('ON_DECK_TEAM');
    const next = upNextMatch(s)!;
    const after = matchAfter(s, next)!;
    const duty = scorerDutyFor(s, next);
    expect(duty.kind).toBe('TEAM');
    const t = matchTeams(s, after);
    const playing = matchTeams(s, next);
    if (duty.kind === 'TEAM') {
      expect([t.home, t.away]).toContain(duty.teamId);
      expect([playing.home, playing.away]).not.toContain(duty.teamId);
      expect(duty.reason).toBe('ON_DECK');
    }
  });

  it('the Admin override still wins and the rule is editable mid-tournament', () => {
    let s = make();
    s = run(s, { type: 'UPDATE_TABLE_SETTINGS', patch: { dutyRule: 'ADMIN_ALWAYS', defaultKeypad: 'COLUMNS' } });
    expect(s.settings.table).toEqual({ dutyRule: 'ADMIN_ALWAYS', defaultKeypad: 'COLUMNS' });
    s = run(s, { type: 'SET_SCORER_DUTY_OVERRIDE', value: s.teams[3]!.id });
    expect(scorerDutyFor(s, upNextMatch(s))).toEqual({ kind: 'TEAM', teamId: s.teams[3]!.id, reason: 'OVERRIDE' });
  });
});

describe('schema v4', () => {
  it('migrates v3 snapshots: table settings, new visibility flags, team logos', () => {
    const fresh = make();
    const { table: _t, ...settingsV3 } = fresh.settings;
    const { stageVisitHistory: _a, showBreaksToGuests: _b, ...visV3 } = fresh.settings.visibility;
    const v3 = {
      ...fresh,
      schemaVersion: 3,
      settings: { ...settingsV3, visibility: visV3 },
      teams: fresh.teams.map(({ logoDataUrl: _l, ...t }) => t),
    } as unknown as TournamentState;
    const m = migrateState(v3);
    expect(m.schemaVersion).toBe(STATE_SCHEMA_VERSION);
    expect(m.settings.table.dutyRule).toBe('LOSER_SCORES_NEXT');
    expect(m.settings.visibility.stageVisitHistory).toBe(true);
    expect(m.settings.visibility.showBreaksToGuests).toBe(true);
    expect(m.teams.every((t) => t.logoDataUrl === null)).toBe(true);
    expect(migrateState(m)).toBe(m);
  });

  it('sets and clears a team logo', () => {
    let s = make();
    const id = s.teams[0]!.id;
    s = run(s, { type: 'SET_TEAM_LOGO', teamId: id, logoDataUrl: 'data:image/webp;base64,AAAA' });
    expect(s.teams[0]!.logoDataUrl).toBe('data:image/webp;base64,AAAA');
    s = run(s, { type: 'SET_TEAM_LOGO', teamId: id, logoDataUrl: null });
    expect(s.teams[0]!.logoDataUrl).toBeNull();
  });
});

describe('practice sandbox', () => {
  it('scores, busts, checks out and undoes without tournament state', () => {
    let p = newPractice(301, 'DOUBLE_OUT');
    for (const d of [
      { segment: 20, multiplier: 3 as const },
      { segment: 20, multiplier: 3 as const },
      { segment: 20, multiplier: 3 as const },
    ])
      p = practiceThrow(p, d);
    expect(practiceView(p).remaining).toBe(121);
    expect(practiceView(p).visits[0]!.scored).toBe(180);

    p = practiceThrow(p, { segment: 20, multiplier: 3 });
    p = practiceThrow(p, { segment: 20, multiplier: 3 });
    let v = practiceView(p); // 121 - 120 leaves 1 under double-out = bust, visit ends after 2 darts
    expect(v.visits[1]!.bust).toBe(true);
    expect(v.visits[1]!.darts).toHaveLength(2);
    expect(v.remaining).toBe(121);

    p = practiceThrow(p, { segment: 20, multiplier: 3 });
    p = practiceThrow(p, { segment: 11, multiplier: 3 });
    p = practiceThrow(p, { segment: 14, multiplier: 2 });
    v = practiceView(p);
    expect(v.finished).toBe(true);
    expect(practiceThrow(p, { segment: 1, multiplier: 1 })).toBe(p);

    v = practiceView(practiceUndo(p));
    expect(v.finished).toBe(false);
    expect(v.remaining).toBe(28);
    expect(v.current.darts).toHaveLength(2);
  });
});
