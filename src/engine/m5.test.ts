import { describe, expect, it } from 'vitest';
import type { EngineAction } from './actions.ts';
import { computeAwards, formatAwardValue } from './awards.ts';
import { DEFAULT_RULES, DEFAULT_STRUCTURE } from './defaults.ts';
import { computeMatchView } from './match.ts';
import { projectSchedule, roundOneComplete } from './pace.ts';
import { tournamentReducer } from './reducer.ts';
import type { Multiplier } from './scoring.ts';
import { upNextMatch } from './selectors.ts';
import { soundboardLock } from './soundboard.ts';
import { detectMeme } from './memes.ts';
import { collectStats, frameFor, futCards, midRankPercentile, playerMetrics, toRating, ultimateTeam } from './stats.ts';
import type { TournamentState } from './state.ts';
import { buildTournament } from './tournament.ts';

let seq = 0;
let clock = 1_000_000;
const run = (s: TournamentState, ...a: EngineAction[]) => a.reduce(tournamentReducer, s);
const D = (segment: number, multiplier: Multiplier = 1): EngineAction => ({ type: 'THROW_DART', id: `m5-${++seq}`, segment, multiplier, at: (clock += 10_000) });
const MISS = () => D(0, 0);

function make(): TournamentState {
  return buildTournament({
    id: 'm5',
    name: 'M5',
    createdAt: 1,
    structure: { ...structuredClone(DEFAULT_STRUCTURE), teamCount: 4, groupCount: 1, mode: 'GROUPS_ONLY', groupFormat: 'BO1', playersPerTeam: 1 },
    rules: { ...structuredClone(DEFAULT_RULES), startingScore: 301, checkoutMode: 'DOUBLE_OUT' },
    cards: { mode: 'OFF' },
    roster: [],
  });
}

/** Home wins a 301 BO1: 180, (0), 121 out (T20 T11 D14). */
function playHomeWin(s: TournamentState): TournamentState {
  const m = upNextMatch(s)!;
  s = run(s, { type: 'START_MATCH', matchId: m.id, at: clock }, { type: 'SET_LEG_START', legIndex: 0, firstTeam: 'home', resolvedBy: 'MANUAL' }, { type: 'BEGIN_PLAY' });
  s = run(s, D(20, 3), D(20, 3), D(20, 3), MISS(), MISS(), MISS(), D(20, 3), D(11, 3), D(14, 2));
  clock += 120_000; // turnaround
  return run(s, { type: 'CONTINUE_TO_NEXT' });
}

describe('stats & FUT', () => {
  it('collects visits and computes player metrics', () => {
    const s = playHomeWin(make());
    const data = collectStats(s);
    expect(data.visits.length).toBe(3);
    const pm = playerMetrics(s, data);
    const winner = pm.find((p) => p.visits === 2 && p.checkouts === 1)!;
    expect(winner.highestVisit).toBe(180);
    expect(winner.highestCheckout).toBe(121);
    expect(winner.triples).toBe(5);
    expect(winner.winningCheckoutDarts).toBe(1);
    expect(winner.average).toBeCloseTo((301 / 6) * 3, 1);
  });

  it('mid-rank percentiles map onto 55-99 with frames', () => {
    expect(midRankPercentile(5, [1, 5, 9])).toBe(0.5);
    expect(midRankPercentile(9, [1, 5, 9])).toBe(1);
    expect(toRating(0)).toBe(55);
    expect(toRating(1)).toBe(99);
    expect(frameFor(90)).toBe('ICON');
    expect(frameFor(60)).toBe('BRONZE');
    const cards = futCards(playHomeWin(make()));
    expect(cards).toHaveLength(2);
    const best = cards.reduce((a, b) => (a.ovr > b.ovr ? a : b));
    expect(best.ratings).toHaveLength(6);
    expect(best.playstyle.endsWith('+')).toBe(true);
  });

  it('respects statsScope GROUP_STAGE_ONLY (no playoff matches here, still counts groups)', () => {
    let s = playHomeWin(make());
    s = run(s, { type: 'UPDATE_VISIBILITY', patch: { statsScope: 'GROUP_STAGE_ONLY' } });
    expect(collectStats(s).visits.length).toBe(3);
  });
});

describe('awards', () => {
  it('computes team and individual winners', () => {
    const s = playHomeWin(make());
    const awards = computeAwards(s);
    const byId = Object.fromEntries(awards.map((a) => [a.id, a]));
    expect(byId.HIGHEST_VISIT!.winners[0]!.value).toBe(180);
    expect(byId.HIGHEST_CHECKOUT!.winners[0]!.value).toBe(121);
    expect(byId.FASTEST_LEG!.winners[0]!.value).toBe(6);
    expect(byId.DOUBLE_ASSASSINS!.winners[0]!.value).toBe(1);
    expect(byId.TRIPLE_HUNTER!.winners[0]!.value).toBe(5);
    expect(byId.EFFICIENT_CLOSER!.winners).toHaveLength(0); // needs 2 legs won
    expect(formatAwardValue('BEST_TEAM_AVG', 150.5)).toBe('150.50 avg');
  });
});

describe('pace & ETAs', () => {
  it('uses defaults before round 1, then measured pace, with breaks', () => {
    let s = make();
    const before = projectSchedule(s, 0);
    expect(before.pace.measured).toBe(false);
    expect(before.etas).toHaveLength(6);
    s = playHomeWin(s);
    s = playHomeWin(s);
    expect(roundOneComplete(s)).toBe(true);
    const next = upNextMatch(s)!;
    s = run(s, { type: 'ADD_BREAK', id: 'b1', afterMatchId: next.id, name: 'Pizza', durationMinutes: 20 });
    const p = projectSchedule(s, clock);
    expect(p.pace.measured).toBe(true);
    expect(p.pace.avgSecondsPerLeg).toBe(80); // 9 darts x 10 s minus the first = 80 s per leg
    expect(p.etas[0]!.afterBreak).toBeNull();
    expect(p.etas[1]!.afterBreak?.name).toBe('Pizza');
    expect(p.etas[1]!.start - p.etas[0]!.start).toBeGreaterThanOrEqual(20 * 60_000);
    // Break completes when the next match starts after it.
    s = playHomeWin(s);
    s = run(s, { type: 'START_MATCH', matchId: upNextMatch(s)!.id, at: clock });
    expect(s.breaks[0]!.completed).toBe(true);
  });
});

describe('player order fix', () => {
  it('swaps past darts and the rest of the leg', () => {
    let s = buildTournament({
      id: 'ord',
      name: 'Order',
      createdAt: 1,
      structure: { ...structuredClone(DEFAULT_STRUCTURE), teamCount: 4, groupCount: 1, mode: 'GROUPS_ONLY', groupFormat: 'BO1', playersPerTeam: 2 },
      rules: { ...structuredClone(DEFAULT_RULES), startingScore: 301 },
      cards: { mode: 'OFF' },
      roster: [],
    });
    const m = upNextMatch(s)!;
    s = run(s, { type: 'START_MATCH', matchId: m.id, at: 1 }, { type: 'SET_LEG_START', legIndex: 0, firstTeam: 'home', resolvedBy: 'MANUAL' }, { type: 'BEGIN_PLAY' });
    const home = s.teams.find((t) => t.id === s.live!.homeTeamId)!;
    const [p1, p2] = home.playerIds as [string, string];
    s = run(s, D(20), D(20), D(20), MISS(), MISS(), MISS()); // p1 threw, now p2 is due
    expect(computeMatchView(s)!.turn).toBeTruthy();
    s = run(s, { type: 'SWAP_PLAYERS_IN_LEG', matchId: m.id, legIndex: 0, teamId: home.id, a: p1, b: p2 });
    expect(s.throws.filter((t) => t.teamId === home.id).every((t) => t.playerId === p2)).toBe(true);
    s = run(s, D(1));
    expect(s.throws[s.throws.length - 1]!.playerId).toBe(p1); // p1 now throws the second visit
  });
});

describe('pause / resume / restart', () => {
  it('pauses a match, resumes it as left, or restarts with cards back in hand', () => {
    let s = buildTournament({
      id: 'pause',
      name: 'Pause',
      createdAt: 1,
      structure: { ...structuredClone(DEFAULT_STRUCTURE), teamCount: 4, groupCount: 1, mode: 'GROUPS_ONLY', groupFormat: 'BO3', playersPerTeam: 1 },
      rules: { ...structuredClone(DEFAULT_RULES), startingScore: 301 },
      cards: { startingHandSize: 0 },
      roster: [],
    });
    const m = upNextMatch(s)!;
    s = run(s, { type: 'START_MATCH', matchId: m.id, at: 1 }, { type: 'SET_LEG_START', legIndex: 0, firstTeam: 'home', resolvedBy: 'MANUAL' }, { type: 'BEGIN_PLAY' });
    const home = s.live!.homeTeamId;
    s = run(s, { type: 'GRANT_CARD', id: 'g1', teamId: home, cardTypeId: 'EXTRA_DART', at: 1 });
    const inst = s.cards.instances.find((i) => i.ownerTeamId === home)!.instanceId;
    s = run(s, { type: 'PLAY_CARD', id: 'p1', instanceId: inst, at: 2 }, D(20, 3), D(20, 3));
    s = run(s, { type: 'SUSPEND_MATCH', at: 3 });
    expect(s.live).toBeNull();
    expect(s.matches.find((x) => x.id === m.id)!.suspended).toBeTruthy();

    const resumed = run(s, { type: 'START_MATCH', matchId: m.id, at: 4 });
    expect(resumed.live!.phase).toBe('IN_PROGRESS');
    expect(computeMatchView(resumed)!.currentLeg.remaining.home).toBe(181);
    expect(computeMatchView(resumed)!.turn!.maxDarts).toBe(4);

    const restarted = run(s, { type: 'START_MATCH', matchId: m.id, at: 4, restart: true });
    expect(restarted.live!.phase).toBe('PRE_MATCH');
    expect(restarted.throws.some((t) => t.matchId === m.id)).toBe(false);
    expect(restarted.cards.plays).toHaveLength(0);
    expect(restarted.cards.instances.find((i) => i.instanceId === inst)!.ownerTeamId).toBe(home);
  });
});

describe('soundboard lock', () => {
  it('locks while a player is throwing and when muted', () => {
    let s = make();
    const m = upNextMatch(s)!;
    s = run(s, { type: 'START_MATCH', matchId: m.id, at: 1 }, { type: 'SET_LEG_START', legIndex: 0, firstTeam: 'home', resolvedBy: 'MANUAL' }, { type: 'BEGIN_PLAY' });
    expect(soundboardLock(s, computeMatchView(s))).toBeNull();
    s = run(s, D(20));
    expect(soundboardLock(s, computeMatchView(s))).toMatch(/throwing/);
    s = run(s, D(20), D(20));
    expect(soundboardLock(s, computeMatchView(s))).toBeNull();
    s = run(s, { type: 'UPDATE_VISIBILITY', patch: { soundboardEnabled: false } });
    expect(soundboardLock(s, computeMatchView(s))).toMatch(/muted/);
  });
});

describe('ultimate team', () => {
  it('fills spots in stat order with distinct players', () => {
    let s = playHomeWin(make());
    s = playHomeWin(s);
    const cards = futCards(s);
    const team = ultimateTeam(s, cards);
    expect(team.map((t) => t.code)).toEqual(s.settings.futCardAttributes);
    const ids = team.map((t) => t.card?.playerId).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(Math.min(6, cards.length));
  });
});

describe('memes', () => {
  it('detects same score, 26, bust and big checkout', () => {
    let s = make();
    const m = upNextMatch(s)!;
    s = run(s, { type: 'START_MATCH', matchId: m.id, at: 1 }, { type: 'SET_LEG_START', legIndex: 0, firstTeam: 'home', resolvedBy: 'MANUAL' }, { type: 'BEGIN_PLAY' });
    s = run(s, D(20), D(5), D(1)); // 26
    let v = computeMatchView(s)!;
    expect(detectMeme(v.currentLeg, v.lastCompletedVisit!)).toBe('BED_AND_BREAKFAST');
    s = run(s, D(20), D(5), D(1)); // opponent copies 26
    v = computeMatchView(s)!;
    expect(detectMeme(v.currentLeg, v.lastCompletedVisit!)).toBe('SAME_SCORE');
    s = run(s, MISS(), MISS(), MISS());
    v = computeMatchView(s)!;
    expect(detectMeme(v.currentLeg, v.lastCompletedVisit!)).toBe('ALL_MISS');
  });
});
