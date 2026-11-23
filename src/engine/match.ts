import { buildVisitMods, evaluateCardDart, modsFor, type ModsMap, type VisitMods } from './cardEffects.ts';
import { isDoubleDart, isTripleDart, legsToWin } from './scoring.ts';
import type { TournamentState } from './state.ts';
import type {
  CardPlay,
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
  /** Darts allowed this visit (2 with STEAL_DART, 4 with EXTRA_DART). */
  maxDarts: number;
  /** Remaining before each dart / points each dart was worth after card effects. */
  before: number[];
  points: number[];
  /** Darts voided by a mulligan (not counted). */
  voided: DartThrow[];
  /** ALL_OR_NOTHING outcome once the visit completes. */
  allOrNothing: 'MET' | 'MISSED' | null;
  /** SHOWBOAT_DOUBLE bonus earned this visit. */
  bonus: number;
  mods: VisitMods;
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
  mods: VisitMods;
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
  /** Card plays of this match, in play order. */
  plays: CardPlay[];
  mods: ModsMap;
}

const sideOfTeam = (teamIds: Record<Side, string>, teamId: string): Side => (teamIds.home === teamId ? 'home' : 'away');

function emptyLeg(index: number, start: number): LegView {
  return { index, visits: [], remaining: { home: start, away: start }, winner: null, dartsBySide: { home: 0, away: 0 }, checkoutDart: null };
}

/** Replay one leg's throws into visits, remaining scores and a winner (applying card effects). */
export function replayLeg(index: number, throws: DartThrow[], teamIds: Record<Side, string>, rules: GameRules, mods?: ModsMap, allowBoostedCheckout = false): LegView {
  const leg = emptyLeg(index, rules.startingScore);
  let cap = rules.specialRules.visitCap.enabled ? Math.max(1, rules.specialRules.visitCap.maxVisits) : Infinity;
  const visitCount: Record<Side, number> = { home: 0, away: 0 };
  const strictDouble = rules.checkoutMode !== 'STRAIGHT_OUT';

  for (const t of throws) {
    if (leg.winner) break;
    const side = sideOfTeam(teamIds, t.teamId);
    let visit = leg.visits[leg.visits.length - 1];
    if (!visit || visit.visitIndex !== t.visitIndex) {
      const m = modsFor(mods, index, t.visitIndex);
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
        maxDarts: m.maxDarts,
        before: [],
        points: [],
        voided: [],
        allOrNothing: null,
        bonus: 0,
        mods: m,
      };
      leg.visits.push(visit);
      visitCount[side]++;
    }
    if (t.mulliganed) {
      visit.voided.push(t);
      continue;
    }
    if (visit.complete) continue; // defensive: ignore stray darts after a visit ended
    visit.darts.push(t);
    leg.dartsBySide[side]++;
    const before = visit.scoreBefore - visit.scored;
    const r = evaluateCardDart(t, visit.darts.length, before, rules.checkoutMode, visit.mods, allowBoostedCheckout);
    visit.before.push(before);
    visit.points.push(r.points);
    if (visit.mods.showboat && !visit.bonus && isDoubleDart(t)) visit.bonus = visit.mods.showboat;
    if (r.outcome === 'BUST') {
      visit.bust = true;
      visit.scored = 0;
      visit.complete = true;
      leg.remaining[side] = visit.scoreBefore;
    } else {
      visit.scored = visit.scoreBefore - r.remaining;
      leg.remaining[side] = r.remaining;
      if (r.outcome === 'CHECKOUT') {
        visit.checkout = true;
        visit.complete = true;
        if (visit.mods.allOrNothing) visit.allOrNothing = 'MET';
        leg.winner = side;
        leg.checkoutDart = t;
      } else if (visit.darts.length >= visit.maxDarts) {
        visit.complete = true;
        const aon = visit.mods.allOrNothing;
        if (aon) {
          const raw = visit.darts.reduce((sum, d) => sum + d.rawPoints, 0);
          if (raw >= aon.quota) {
            visit.allOrNothing = 'MET';
            // The bonus never busts: it only comes off if a legal finish stays possible.
            const after = leg.remaining[side] - aon.bonus;
            if (after >= (strictDouble ? 2 : 1)) {
              leg.remaining[side] = after;
              visit.scored += aon.bonus;
            }
          } else {
            visit.allOrNothing = 'MISSED';
            visit.scored = 0;
            leg.remaining[side] = visit.scoreBefore;
          }
        }
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
export function replayMatch(throws: DartThrow[], match: Match, teamIds: Record<Side, string>, rules: GameRules, mods?: ModsMap, allowBoostedCheckout = false): MatchReplay {
  const target = legsToWin(match.format);
  const legs: LegView[] = [];
  const legsWon: Record<Side, number> = { home: 0, away: 0 };
  let winner: Side | null = null;
  throwsByLeg(throws, match.id).forEach((legThrows, i) => {
    if (winner || !legThrows) return;
    const leg = replayLeg(i, legThrows, teamIds, rules, mods, allowBoostedCheckout);
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
      if (v.complete) s.highestVisit = Math.max(s.highestVisit, v.scored);
      if (v.checkout) s.checkouts++;
      s.bonusPoints += v.bonus;
    }
    if (leg.winner) stats[leg.winner].bonusPoints += bonusFor(leg.checkoutDart, rules);
  }
  for (const s of Object.values(stats)) s.average = s.darts ? Math.round((s.points / s.darts) * 300) / 100 : 0;
  return { legs, legsWon, winner, stats };
}

/** The rules a match is played under: frozen at START_MATCH, else the current tournament rules. */
export const rulesFor = (state: TournamentState, match: Match): GameRules => match.rules ?? state.settings.rules;

/** Replay a stored match with its own rules and card effects (standings, results, stats). */
export function replayStoredMatch(state: TournamentState, match: Match, teamIds: Record<Side, string>): MatchReplay {
  return replayMatch(state.throws, match, teamIds, rulesFor(state, match), matchMods(state, match.id), state.settings.cards.params.allowCheckoutOnBoostedDart);
}

/** Card modifiers of a stored match (for standings and results). */
export function matchMods(state: TournamentState, matchId: string): ModsMap {
  return buildVisitMods((state.cards?.plays ?? []).filter((p) => p.matchId === matchId), state.settings.cards.params);
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
  if (live.firstThrowCard) {
    // FIRST_THROW: the card team starts every odd leg (1, 3, 5...), the opponent the others.
    const firstTeam = legIndex % 2 === 0 ? live.firstThrowCard : otherSide(live.firstThrowCard);
    const players = defaultPlayers(state, live, legIndex);
    return { firstTeam, firstPlayer: players, ruleFirstTeam: firstTeam, ruleFirstPlayer: players, method: 'ALTERNATE', decision: null, resolvedBy: 'CARD' };
  }
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
  const rules = rulesFor(state, match);
  const plays = (state.cards?.plays ?? []).filter((p) => p.matchId === match.id);
  const mods = buildVisitMods(plays, state.settings.cards.params);
  const { legs, legsWon, winner, stats } = replayMatch(state.throws, match, teamIds, rules, mods, state.settings.cards.params.allowCheckoutOnBoostedDart);

  const lastLeg = legs[legs.length - 1];
  // While a finished leg waits for "Start next leg", keep showing that leg's final position.
  const holding = live.awaitingNextLeg != null && !!lastLeg?.winner;
  const currentLegIndex = winner || holding ? legs.length - 1 : lastLeg?.winner ? legs.length : Math.max(0, legs.length - 1);
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
    let visitMods: VisitMods;
    if (last && !last.complete) {
      side = last.side;
      visitIndex = last.visitIndex;
      darts = last.darts;
      playerId = last.playerId;
      visitMods = last.mods;
    } else {
      side = last ? otherSide(last.side) : setup.firstTeam;
      visitIndex = last ? last.visitIndex + 1 : 0;
      const team = state.teams.find((t) => t.id === teamIds[side]);
      const k = currentLeg.visits.filter((v) => v.side === side).length;
      const n = Math.max(1, team?.playerIds.length ?? 1);
      visitMods = modsFor(mods, currentLegIndex, visitIndex);
      // TEAMMATE_SWAP: the next player in order throws this one visit instead.
      const swap = visitMods.swapThrower ? 1 : 0;
      const order = setup.order?.[side];
      playerId = order?.length ? order[(k + swap) % order.length]! : (team?.playerIds[(setup.firstPlayer[side] + k + swap) % n] ?? '');
    }
    const scoreBefore = last && !last.complete ? last.scoreBefore : currentLeg.remaining[side];
    turn = {
      side,
      teamId: teamIds[side],
      playerId,
      legIndex: currentLegIndex,
      visitIndex,
      scoreBefore,
      remaining: currentLeg.remaining[side],
      darts,
      maxDarts: visitMods.maxDarts,
      mods: visitMods,
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
    plays,
    mods,
  };
}
