import { describe, expect, it } from 'vitest';
import type { EngineAction } from './actions.ts';
import { bestCheckout, dualCheckout } from './checkout.ts';
import { DEFAULT_RULES, DEFAULT_STRUCTURE } from './defaults.ts';
import { computeMatchView, isSetupOverridden } from './match.ts';
import { tournamentReducer } from './reducer.ts';
import { evaluateDart, type Multiplier } from './scoring.ts';
import { upNextMatch } from './selectors.ts';
import { groupStandings, resolveSlot, scorerDutyFor } from './standings.ts';
import { migrateState, type TournamentState } from './state.ts';
import { buildTournament } from './tournament.ts';
import type { GameRules, StructureSettings } from './types.ts';

let seq = 0;
const T = (segment: number, multiplier: Multiplier = 1): EngineAction => ({ type: 'THROW_DART', id: `d${++seq}`, segment, multiplier, at: 1000 + seq });

function make(structure: Partial<StructureSettings> = {}, rules: Partial<GameRules> = {}): TournamentState {
  return buildTournament({
    id: 't',
    name: 'Test',
    createdAt: 1,
    structure: { ...structuredClone(DEFAULT_STRUCTURE), ...structure },
    rules: { ...structuredClone(DEFAULT_RULES), ...rules },
    roster: [],
  });
}

const run = (s: TournamentState, ...actions: EngineAction[]) => actions.reduce(tournamentReducer, s);

/** Start the up-next match and begin play with home throwing first. */
function startHomeFirst(s: TournamentState): TournamentState {
  const m = upNextMatch(s)!;
  s = run(s, { type: 'START_MATCH', matchId: m.id, at: 1 });
  s = run(s, { type: 'SET_LEG_START', legIndex: 0, firstTeam: 'home', resolvedBy: 'MANUAL' }, { type: 'BEGIN_PLAY' });
  return s;
}

describe('scoring rules', () => {
  it('handles double-out busts and finishes', () => {
    expect(evaluateDart({ segment: 20, multiplier: 2 }, 40, 'DOUBLE_OUT').outcome).toBe('CHECKOUT');
    expect(evaluateDart({ segment: 20, multiplier: 1 }, 20, 'DOUBLE_OUT').outcome).toBe('BUST');
    expect(evaluateDart({ segment: 19, multiplier: 1 }, 20, 'DOUBLE_OUT').outcome).toBe('BUST'); // leaves 1
    expect(evaluateDart({ segment: 50, multiplier: 1 }, 50, 'DOUBLE_OUT').outcome).toBe('CHECKOUT');
    expect(evaluateDart({ segment: 20, multiplier: 3 }, 40, 'DOUBLE_OUT').outcome).toBe('BUST');
  });
  it('handles straight, master and hybrid outs', () => {
    expect(evaluateDart({ segment: 7, multiplier: 1 }, 7, 'STRAIGHT_OUT').outcome).toBe('CHECKOUT');
    expect(evaluateDart({ segment: 5, multiplier: 1 }, 6, 'STRAIGHT_OUT').outcome).toBe('SCORE'); // 1 left is fine
    expect(evaluateDart({ segment: 3, multiplier: 3 }, 9, 'MASTER_OUT').outcome).toBe('CHECKOUT');
    expect(evaluateDart({ segment: 19, multiplier: 3 }, 57, 'HYBRID_SUB_50').outcome).toBe('CHECKOUT');
    expect(evaluateDart({ segment: 20, multiplier: 1 }, 20, 'HYBRID_SUB_50').outcome).toBe('BUST');
  });
});

describe('checkout solver', () => {
  it('finds classic double-out routes', () => {
    expect(bestCheckout(170, 3, 'DOUBLE_OUT')?.labels).toEqual(['T20', 'T20', 'BULL']);
    expect(bestCheckout(40, 1, 'DOUBLE_OUT')?.labels).toEqual(['D20']);
    expect(bestCheckout(169, 3, 'DOUBLE_OUT')).toBeNull();
    expect(bestCheckout(100, 2, 'DOUBLE_OUT')?.labels).toEqual(['T20', 'D20']);
    expect(bestCheckout(1, 3, 'DOUBLE_OUT')).toBeNull();
  });
  it('prefers singles on straight-out and offers a gold double-bonus path', () => {
    const special = { ...DEFAULT_RULES.specialRules, doubleCheckoutBonus: { enabled: true, points: 1 } };
    const dual = dualCheckout(40, 3, 'STRAIGHT_OUT', special);
    expect(dual.safe?.darts.length).toBe(2);
    expect(dual.bonus?.labels).toEqual(['D20']);
    expect(dual.bonusLabel).toBe('DOUBLE BONUS +1 PT');
  });
});

describe('match lifecycle', () => {
  it('runs UP_NEXT -> PRE_MATCH -> IN_PROGRESS -> POST_MATCH with turn order and duty', () => {
    let s = make({ teamCount: 4, groupCount: 1, mode: 'GROUPS_ONLY' }, { startingScore: 301 });
    expect(scorerDutyFor(s, upNextMatch(s)).kind).toBe('ADMIN');
    const m = upNextMatch(s)!;
    s = run(s, { type: 'START_MATCH', matchId: m.id, at: 1 });
    expect(s.live?.phase).toBe('PRE_MATCH');
    // Lower seed (larger seed number) throws first by default.
    const home = s.teams.findIndex((t) => t.id === s.live!.homeTeamId);
    const away = s.teams.findIndex((t) => t.id === s.live!.awayTeamId);
    expect(s.live!.legSetups[0]!.firstTeam).toBe(home > away ? 'home' : 'away');

    s = run(s, { type: 'SET_LEG_START', legIndex: 0, firstTeam: 'home' }, { type: 'BEGIN_PLAY' });
    expect(isSetupOverridden(s.live!.legSetups[0])).toBe(home < away);
    let v = computeMatchView(s)!;
    expect(v.turn?.side).toBe('home');
    expect(v.turn?.playerId).toBe(s.teams.find((t) => t.id === v.teamIds.home)!.playerIds[0]);

    // home 180, away 26, home 121 -> 0? play out: home T20 x3 (121 left)
    s = run(s, T(20, 3), T(20, 3), T(20, 3));
    v = computeMatchView(s)!;
    expect(v.currentLeg.remaining.home).toBe(121);
    expect(v.turn?.side).toBe('away');
    s = run(s, T(20), T(5), T(1));
    v = computeMatchView(s)!;
    expect(v.turn?.side).toBe('home');
    // Second home visit is thrown by player 2.
    expect(v.turn?.playerId).toBe(s.teams.find((t) => t.id === v.teamIds.home)!.playerIds[1]);
    s = run(s, T(20, 3), T(11, 3), T(20, 2)); // 60 + 33 + 40 = 133 > 121 -> bust on dart 2
    v = computeMatchView(s)!;
    expect(v.currentLeg.remaining.home).toBe(121);
    expect(v.lastCompletedVisit?.bust).toBe(true);
    expect(v.turn?.side).toBe('away'); // bust ends the visit after dart 2

    s = run(s, T(0, 0), T(0, 0), T(0, 0));
    s = run(s, T(20, 3), T(11, 3), T(14, 2)); // 60 + 33 + 28 = 121 checkout
    expect(s.live?.phase).toBe('POST_MATCH');
    const done = s.matches.find((x) => x.id === m.id)!;
    expect(done.status).toBe('COMPLETED');
    expect(done.winnerTeamId).toBe(s.live!.homeTeamId);
    expect(s.queue).not.toContain(m.id);
    expect(s.throws[s.throws.length - 1]).toMatchObject({ isCheckoutDart: true, checkoutType: 'DOUBLE' });

    // Undo the winning dart reopens the match.
    const reopened = run(s, { type: 'UNDO_DART' });
    expect(reopened.live?.phase).toBe('IN_PROGRESS');
    expect(reopened.matches.find((x) => x.id === m.id)!.status).toBe('IN_PROGRESS');
    expect(reopened.queue[0]).toBe(m.id);
    expect(computeMatchView(reopened)!.turn?.darts).toHaveLength(2);

    // Continue: loser scores next (unless they play next -> Admin).
    s = run(s, { type: 'CONTINUE_TO_NEXT' });
    expect(s.live).toBeNull();
    const next = upNextMatch(s)!;
    const duty = scorerDutyFor(s, next);
    const loserId = [m.home, m.away].map((x) => (x.kind === 'TEAM' ? x.teamId : '')).find((id) => id !== done.winnerTeamId)!;
    const loserPlaysNext = [next.home, next.away].some((x) => x.kind === 'TEAM' && x.teamId === loserId);
    expect(duty).toEqual(loserPlaysNext ? { kind: 'ADMIN', reason: 'FALLBACK' } : { kind: 'TEAM', teamId: loserId, reason: 'LOSER' });
  });

  it('locks the order after dart 1 and unlocks it after undo', () => {
    let s = startHomeFirst(make({ teamCount: 4, groupCount: 1 }));
    s = run(s, T(20));
    const locked = run(s, { type: 'SET_LEG_START', legIndex: 0, firstTeam: 'away' });
    expect(locked).toBe(s);
    s = run(s, { type: 'UNDO_DART' }, { type: 'SET_LEG_START', legIndex: 0, firstTeam: 'away', firstPlayer: { away: 1 } });
    const v = computeMatchView(s)!;
    expect(v.turn?.side).toBe('away');
    expect(v.turn?.playerId).toBe(s.teams.find((t) => t.id === v.teamIds.away)!.playerIds[1]);
  });

  it('alternates starters each leg and re-runs the rule on the deciding leg', () => {
    let s = make({ teamCount: 4, groupCount: 1, groupFormat: 'BO3' }, { startingScore: 301, checkoutMode: 'STRAIGHT_OUT', firstThrowRule: 'VIRTUAL_COIN_TOSS' });
    const m = upNextMatch(s)!;
    s = run(s, { type: 'START_MATCH', matchId: m.id, at: 1 });
    expect(s.live!.legSetups[0]!.firstTeam).toBeNull();
    expect(s.live!.legSetups[0]!.decision).toBe('VIRTUAL_COIN_TOSS');
    expect(run(s, { type: 'BEGIN_PLAY' }).live!.phase).toBe('PRE_MATCH'); // blocked until decided
    s = run(s, { type: 'SET_LEG_START', legIndex: 0, firstTeam: 'home', resolvedBy: 'COIN_TOSS' }, { type: 'BEGIN_PLAY' });
    const winLeg = (st: TournamentState) => run(st, T(20, 3), T(20, 3), T(20, 3), T(0, 0), T(0, 0), T(0, 0), T(20, 3), T(20, 3), T(1, 1));
    s = winLeg(s); // home wins leg 1 (301 straight out: 180 + 121? -> 180, then 60+60+1=121)
    let v = computeMatchView(s)!;
    expect(v.legsWon).toEqual({ home: 1, away: 0 });
    expect(v.setup?.firstTeam).toBe('away'); // alternated
    s = winLeg(s); // away starts and wins leg 2
    v = computeMatchView(s)!;
    expect(v.legsWon).toEqual({ home: 1, away: 1 });
    expect(v.setup?.method).toBe('DECIDER');
    expect(v.setup?.firstTeam).toBeNull(); // coin toss again
    expect(v.turn).toBeNull();
  });

  it('defers a match behind the next playable one', () => {
    let s = make({ teamCount: 4, groupCount: 1 });
    const [a, b] = s.queue;
    s = run(s, { type: 'DEFER_MATCH', matchId: a! });
    expect(s.queue.slice(0, 2)).toEqual([b, a]);
  });

  it('resolves group ranks into playoff slots once a group is complete', () => {
    let s = make({ teamCount: 4, groupCount: 1, mode: 'GROUPS_AND_PLAYOFFS', playoff: { ...DEFAULT_STRUCTURE.playoff, bracketSize: 2 } }, { checkoutMode: 'STRAIGHT_OUT', startingScore: 301 });
    const final = s.matches.find((m) => m.playoffRound === 'FINAL')!;
    expect(resolveSlot(s, final.home)).toBeNull();
    const groupMatches = s.matches.filter((m) => m.stage === 'GROUP').length;
    for (let i = 0; i < groupMatches; i++) {
      s = startHomeFirst(s);
      s = run(s, T(20, 3), T(20, 3), T(20, 3), T(0, 0), T(0, 0), T(0, 0), T(20, 3), T(20, 3), T(1, 1), { type: 'CONTINUE_TO_NEXT' });
    }
    const table = groupStandings(s, 0);
    expect(table.every((r) => r.played === 3)).toBe(true);
    expect(resolveSlot(s, final.home)).toBe(table[0]!.teamId);
    expect(resolveSlot(s, final.away)).toBe(table[1]!.teamId);
    expect(upNextMatch(s)?.id).toBe(final.id);
  });

  it('applies the visit cap (lower remaining wins)', () => {
    let s = make({ teamCount: 4, groupCount: 1 }, { specialRules: { ...DEFAULT_RULES.specialRules, visitCap: { enabled: true, maxVisits: 1 } } });
    s = startHomeFirst(s);
    s = run(s, T(20), T(20), T(20), T(20, 3), T(20), T(0, 0)); // home 241 left, away 221 left
    expect(s.live?.phase).toBe('POST_MATCH');
    expect(s.matches.find((m) => m.id === s.live!.matchId)!.winnerTeamId).toBe(s.live!.awayTeamId);
  });

  it('migrates v2 snapshots', () => {
    const v2 = { ...make() } as Partial<TournamentState>;
    delete v2.live;
    delete v2.completedOrder;
    const migrated = migrateState({ ...(v2 as TournamentState), schemaVersion: 2 });
    expect(migrated.live).toBeNull();
    expect(migrated.completedOrder).toEqual([]);
  });
});
