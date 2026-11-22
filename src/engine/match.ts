import { evaluateDart, isDoubleDart, isTripleDart, legsToWin } from './scoring.ts';
import type { TournamentState } from './state.ts';
import type {
  DartThrow,
  GameRules,
  LegDecision,
  LegSetup,
  LiveMatch,
  Match,
  Side,
  TeamSlot,
} from './types.ts';
import { otherSide } from './types.ts';

/**
 * Event-sourced match engine: every match view is replayed from the dart log, so
 * undo is simply "drop the last throw and replay".
 */

export const MAX_DARTS_PER_VISIT = 3;

export interface VisitView {
  side: Side;
  teamId: string;
  playerId: string;
  legIndex: number;
  visitIndex: number;
  darts: DartThrow[];
  scoreBefore: number;
  scored: number;
  bust: boolean;
  checkout: boolean;
  complete: boolean;
}

export interface LegView {
  index: number;
  visits: VisitView[];
  remaining: Record<Side, number>;
  winner: Side | null;
  dartsBySide: Record<Side, number>;
  checkoutDart: DartThrow | null;
}

export interface SideStats {
  points: number;
  darts: number;
  average: number;
  highestVisit: number;
  checkouts: number;
  bonusPoints: number;
}

export interface Turn {
  side: Side;
  teamId: string;
  playerId: string;
  legIndex: number;
  visitIndex: number;
  /** Team remaining at the start of this visit. */
  scoreBefore: number;
  /** Remaining after the darts already thrown in this visit. */
  remaining: number;
  darts: DartThrow[];
  maxDarts: number;
}

export interface MatchView {
  match: Match;
  live: LiveMatch;
  teamIds: Record<Side, string>;
  legs: LegView[];
  legsWon: Record<Side, number>;
  legsToWin: number;
  winner: Side | null;
  currentLegIndex: number;
  currentLeg: LegView;
  setup: LegSetup | null;
  turn: Turn | null;
  dartsThrownInLeg: number;
  stats: Record<Side, SideStats>;
  lastCompletedVisit: VisitView | null;
}

const sideOfTeam = (teamIds: Record<Side, string>, teamId: string): Side => (teamIds.home === teamId ? 'home' : 'away');

function emptyLeg(index: number, start: number): LegView {
  return { index, visits: [], remaining: { home: start, away: start }, winner: null, dartsBySide: { home: 0, away: 0 }, checkoutDart: null };
}

/** Replay one leg's throws into visits, remaining scores and a winner. */
export function replayLeg(index: number, throws: DartThrow[], teamIds: Record<Side, string>, rules: GameRules): LegView {
  const leg = emptyLeg(index, rules.startingScore);
  let cap = rules.specialRules.visitCap.enabled ? Math.max(1, rules.specialRules.visitCap.maxVisits) : Infinity;
  const visitCount: Record<Side, number> = { home: 0, away: 0 };

  for (const t of throws) {
    if (leg.winner) break;
    const side = sideOfTeam(teamIds, t.teamId);
    let visit = leg.visits[leg.visits.length - 1];
    if (!visit || visit.visitIndex !== t.visitIndex) {
      visit = {
        side,
        teamId: t.teamId,
        playerId: t.playerId,
        legIndex: index,
        visitIndex: t.visitIndex,
        darts: [],
        scoreBefore: leg.remaining[side],
        scored: 0,
        bust: false,
        checkout: false,
        complete: false,
      };
      leg.visits.push(visit);
      visitCount[side]++;
    }
    if (visit.complete) continue; // defensive: ignore stray darts after a visit ended
    visit.darts.push(t);
    leg.dartsBySide[side]++;
    const before = visit.scoreBefore - visit.scored;
    const { outcome, remaining } = evaluateDart(t, before, rules.checkoutMode);
    if (outcome === 'BUST') {
      visit.bust = true;
      visit.scored = 0;
      visit.complete = true;
      leg.remaining[side] = visit.scoreBefore;
    } else {
      visit.scored = visit.scoreBefore - remaining;
      leg.remaining[side] = remaining;
      if (outcome === 'CHECKOUT') {
        visit.checkout = true;
        visit.complete = true;
        leg.winner = side;
        leg.checkoutDart = t;
      } else if (visit.darts.length >= MAX_DARTS_PER_VISIT) {
        visit.complete = true;
      }
    }

    // Visit cap: once both teams used their visits, the lower remaining score wins
    // (a tie adds another round each).
    if (!leg.winner && visit.complete && visitCount.home >= cap && visitCount.away >= cap && visitCount.home === visitCount.away) {
      if (leg.remaining.home !== leg.remaining.away) leg.winner = leg.remaining.home < leg.remaining.away ? 'home' : 'away';
      else cap++;
    }
  }
  return leg;
}

/** Throws of a match grouped by leg index (in throw order). */
export function throwsByLeg(throws: DartThrow[], matchId: string): DartThrow[][] {
  const legs: DartThrow[][] = [];
  for (const t of throws) {
    if (t.matchId !== matchId) continue;
    (legs[t.legIndex] ??= []).push(t);
  }
  return legs;
}

function bonusFor(dart: DartThrow | null, rules: GameRules): number {
  if (!dart) return 0;
  let bonus = 0;
  if (rules.specialRules.doubleCheckoutBonus.enabled && isDoubleDart(dart)) bonus += rules.specialRules.doubleCheckoutBonus.points;
  if (rules.specialRules.tripleCheckoutBonus.enabled && isTripleDart(dart)) bonus += rules.specialRules.tripleCheckoutBonus.points;
  return bonus;
}

export interface MatchReplay {
  legs: LegView[];
  legsWon: Record<Side, number>;
  winner: Side | null;
  stats: Record<Side, SideStats>;
}

/** Replay a whole match from the log (used by live view, standings and stats). */
export function replayMatch(throws: DartThrow[], match: Match, teamIds: Record<Side, string>, rules: GameRules): MatchReplay {
  const target = legsToWin(match.format);
  const legs: LegView[] = [];
  const legsWon: Record<Side, number> = { home: 0, away: 0 };
  let winner: Side | null = null;
  throwsByLeg(throws, match.id).forEach((legThrows, i) => {
    if (winner || !legThrows) return;
    const leg = replayLeg(i, legThrows, teamIds, rules);
    legs[i] = leg;
    if (leg.winner) {
      legsWon[leg.winner]++;
      if (legsWon[leg.winner] >= target) winner = leg.winner;
    }
  });
  const stats: Record<Side, SideStats> = {
    home: { points: 0, darts: 0, average: 0, highestVisit: 0, checkouts: 0, bonusPoints: 0 },
    away: { points: 0, darts: 0, average: 0, highestVisit: 0, checkouts: 0, bonusPoints: 0 },
  };
  for (const leg of legs) {
    if (!leg) continue;
    for (const v of leg.visits) {
      const s = stats[v.side];
      s.points += v.scored;
      s.darts += v.darts.length;
      s.highestVisit = Math.max(s.highestVisit, v.scored);
      if (v.checkout) s.checkouts++;
    }
    if (leg.winner) stats[leg.winner].bonusPoints += bonusFor(leg.checkoutDart, rules);
  }
  for (const s of Object.values(stats)) s.average = s.darts ? Math.round((s.points / s.darts) * 300) / 100 : 0;
  return { legs, legsWon, winner, stats };
}

// ------------------------------------------------------------------ leg setups

function slotSeed(state: TournamentState, match: Match, slot: TeamSlot, teamId: string): number | null {
  if (match.stage === 'GROUP') {
    const i = state.teams.findIndex((t) => t.id === teamId);
    return i === -1 ? null : i + 1;
  }
  return slot.kind === 'GROUP_RANK' ? slot.rank : slot.kind === 'SEED' ? slot.seed : null;
}

/** Apply the "who throws first" rule. Returns the side, or the decision the tablet must run. */
export function resolveFirstThrow(state: TournamentState, match: Match): { firstTeam: Side | null; decision: LegDecision | null } {
  const rules = state.settings.rules;
  const live = state.live;
  const homeId = live?.homeTeamId ?? '';
  const awayId = live?.awayTeamId ?? '';
  if (rules.firstThrowRule !== 'LOWER_SEED_FIRST') {
    return { firstTeam: null, decision: rules.firstThrowRule };
  }
  const hs = slotSeed(state, match, match.home, homeId);
  const as = slotSeed(state, match, match.away, awayId);
  if (hs !== null && as !== null && hs !== as) {
    // Lower seed = weaker team = larger seed number throws first.
    return { firstTeam: hs > as ? 'home' : 'away', decision: null };
  }
  if (rules.firstThrowTiebreak === 'SCHEDULE_HOME_TEAM') return { firstTeam: 'home', decision: null };
  return { firstTeam: null, decision: rules.firstThrowTiebreak };
}

function defaultPlayers(state: TournamentState, live: LiveMatch, legIndex: number) {
  const count = (teamId: string) => Math.max(1, state.teams.find((t) => t.id === teamId)?.playerIds.length ?? 1);
  return { home: legIndex % count(live.homeTeamId), away: legIndex % count(live.awayTeamId) };
}

export function initialLegSetup(state: TournamentState, match: Match, live: LiveMatch, legIndex: number, method: 'RULE' | 'DECIDER'): LegSetup {
  const { firstTeam, decision } = resolveFirstThrow({ ...state, live }, match);
  const players = defaultPlayers(state, live, legIndex);
  return {
    firstTeam,
    firstPlayer: players,
    ruleFirstTeam: firstTeam,
    ruleFirstPlayer: players,
    method,
    decision,
    resolvedBy: firstTeam ? 'AUTO' : null,
  };
}

/** Setup for the leg after `prevLegIndex`: alternate starter, or re-run the rule on the deciding leg. */
export function nextLegSetup(state: TournamentState, match: Match, live: LiveMatch, legIndex: number, legsWon: Record<Side, number>): LegSetup {
  const target = legsToWin(match.format);
  const decider = target > 1 && legsWon.home === target - 1 && legsWon.away === target - 1;
  if (decider) return initialLegSetup(state, match, live, legIndex, 'DECIDER');
  const prev = live.legSetups[legIndex - 1];
  const firstTeam = prev?.firstTeam ? otherSide(prev.firstTeam) : 'home';
  const players = defaultPlayers(state, live, legIndex);
  return { firstTeam, firstPlayer: players, ruleFirstTeam: firstTeam, ruleFirstPlayer: players, method: 'ALTERNATE', decision: null, resolvedBy: 'AUTO' };
}

export function isSetupOverridden(setup: LegSetup | null | undefined): boolean {
  if (!setup || !setup.firstTeam) return false;
  return (
    setup.firstTeam !== setup.ruleFirstTeam ||
    setup.firstPlayer.home !== setup.ruleFirstPlayer.home ||
    setup.firstPlayer.away !== setup.ruleFirstPlayer.away
  );
}

// ------------------------------------------------------------------ live view

export function computeMatchView(state: TournamentState): MatchView | null {
  const live = state.live;
  if (!live) return null;
  const match = state.matches.find((m) => m.id === live.matchId);
  if (!match) return null;
  const teamIds: Record<Side, string> = { home: live.homeTeamId, away: live.awayTeamId };
  const rules = state.settings.rules;
  const { legs, legsWon, winner, stats } = replayMatch(state.throws, match, teamIds, rules);

  const lastLeg = legs[legs.length - 1];
  const currentLegIndex = winner ? legs.length - 1 : lastLeg?.winner ? legs.length : Math.max(0, legs.length - 1);
  const currentLeg = legs[currentLegIndex] ?? emptyLeg(currentLegIndex, rules.startingScore);
  const setup = live.legSetups[currentLegIndex] ?? null;
  const dartsThrownInLeg = currentLeg.dartsBySide.home + currentLeg.dartsBySide.away;

  let turn: Turn | null = null;
  if (!winner && live.phase !== 'POST_MATCH' && !currentLeg.winner && setup?.firstTeam) {
    const last = currentLeg.visits[currentLeg.visits.length - 1];
    let side: Side;
    let visitIndex: number;
    let darts: DartThrow[] = [];
    let playerId: string;
    if (last && !last.complete) {
      side = last.side;
      visitIndex = last.visitIndex;
      darts = last.darts;
      playerId = last.playerId;
    } else {
      side = last ? otherSide(last.side) : setup.firstTeam;
      visitIndex = last ? last.visitIndex + 1 : 0;
      const team = state.teams.find((t) => t.id === teamIds[side]);
      const k = currentLeg.visits.filter((v) => v.side === side).length;
      const n = Math.max(1, team?.playerIds.length ?? 1);
      playerId = team?.playerIds[(setup.firstPlayer[side] + k) % n] ?? '';
    }
    const scoreBefore = last && !last.complete ? last.scoreBefore : currentLeg.remaining[side];
    const scored = darts.reduce((s, d) => s + d.rawPoints, 0);
    turn = {
      side,
      teamId: teamIds[side],
      playerId,
      legIndex: currentLegIndex,
      visitIndex,
      scoreBefore,
      remaining: scoreBefore - scored,
      darts,
      maxDarts: MAX_DARTS_PER_VISIT,
    };
  }

  let lastCompletedVisit: VisitView | null = null;
  for (let i = legs.length - 1; i >= 0 && !lastCompletedVisit; i--) {
    const vs = legs[i]?.visits ?? [];
    for (let j = vs.length - 1; j >= 0; j--) {
      if (vs[j]!.complete) {
        lastCompletedVisit = vs[j]!;
        break;
      }
    }
  }

  return {
    match,
    live,
    teamIds,
    legs,
    legsWon,
    legsToWin: legsToWin(match.format),
    winner,
    currentLegIndex,
    currentLeg,
    setup,
    turn,
    dartsThrownInLeg,
    stats,
    lastCompletedVisit,
  };
}
