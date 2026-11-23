import { undoLastPlay } from './cards.ts';
import { giveTo } from './cardPool.ts';
import { computeMatchView, initialLegSetup, nextLegSetup } from './match.ts';
import { checkoutTypeOf, dartPoints, isValidDart, type Multiplier } from './scoring.ts';
import { matchTeams } from './standings.ts';
import type { TournamentState } from './state.ts';
import type { DartThrow, LegSetup, LiveMatch, Match, Side } from './types.ts';

export type MatchAction =
  /** For a paused match: resume (default) or restart from zero (darts removed, played cards back to hands). */
  | { type: 'START_MATCH'; matchId: string; at: number; restart?: boolean }
  /** Pause the live match and leave it (resume or restart later). */
  | { type: 'SUSPEND_MATCH'; at: number }
  /** Start the live match over from zero. */
  | { type: 'RESTART_MATCH'; at: number }
  | { type: 'ABORT_MATCH' }
  | { type: 'DEFER_MATCH'; matchId: string }
  | {
      type: 'SET_LEG_START';
      legIndex: number;
      firstTeam?: Side;
      firstPlayer?: Partial<Record<Side, number>>;
      /** Set when resolving a pending decision (coin toss, bull-up, shootout, manual pick). */
      resolvedBy?: 'COIN_TOSS' | 'BULL_UP' | 'SHOOTOUT' | 'MANUAL';
    }
  | { type: 'BEGIN_PLAY' }
  | { type: 'THROW_DART'; id: string; segment: number; multiplier: Multiplier; at: number }
  | { type: 'UNDO_DART' }
  /** Fix a wrong throwing order: swap two players of a team for a whole leg (past darts are re-credited). */
  | { type: 'SWAP_PLAYERS_IN_LEG'; matchId: string; legIndex: number; teamId: string; a: string; b: string }
  | { type: 'CONTINUE_TO_NEXT' };

const MATCH_ACTIONS = new Set<string>([
  'START_MATCH',
  'SUSPEND_MATCH',
  'RESTART_MATCH',
  'ABORT_MATCH',
  'DEFER_MATCH',
  'SET_LEG_START',
  'BEGIN_PLAY',
  'THROW_DART',
  'UNDO_DART',
  'SWAP_PLAYERS_IN_LEG',
  'CONTINUE_TO_NEXT',
]);

export const isMatchAction = (a: { type: string }): a is MatchAction => MATCH_ACTIONS.has(a.type);

const updateMatch = (state: TournamentState, id: string, patch: Partial<Match>): Match[] =>
  state.matches.map((m) => (m.id === id ? { ...m, ...patch } : m));

const withLive = (state: TournamentState, patch: Partial<LiveMatch>): TournamentState =>
  state.live ? { ...state, live: { ...state.live, ...patch } } : state;

function setLegSetup(live: LiveMatch, index: number, setup: LegSetup): LiveMatch {
  const legSetups = [...live.legSetups];
  legSetups[index] = setup;
  return { ...live, legSetups };
}

/** Team ids of a startable match (both resolved and different), else null. */
export function startableTeams(state: TournamentState, match: Match): { home: string; away: string } | null {
  const { home, away } = matchTeams(state, match);
  return home && away && home !== away ? { home, away } : null;
}

/** Remove a match's darts and card plays; played cards go back to their teams' hands. */
function wipeMatch(state: TournamentState, matchId: string): TournamentState {
  let cards = state.cards;
  for (const p of cards.plays.filter((x) => x.matchId === matchId)) {
    const inst = cards.instances.find((i) => i.instanceId === p.instanceId);
    if (inst?.status === 'IN_POOL') cards = giveTo(cards, p.instanceId, p.teamId);
  }
  cards = { ...cards, plays: cards.plays.filter((p) => p.matchId !== matchId) };
  return { ...state, cards, throws: state.throws.filter((t) => t.matchId !== matchId) };
}

export function matchReducer(state: TournamentState, action: MatchAction): TournamentState {
  switch (action.type) {
    case 'SUSPEND_MATCH': {
      const live = state.live;
      if (!live || live.phase === 'POST_MATCH') return state;
      const suspended = {
        at: action.at,
        startedAt: live.startedAt,
        homeTeamId: live.homeTeamId,
        awayTeamId: live.awayTeamId,
        phase: live.phase,
        legSetups: live.legSetups,
        firstThrowCard: live.firstThrowCard ?? null,
      };
      return { ...state, live: null, matches: updateMatch(state, live.matchId, { status: 'SCHEDULED', suspended }) };
    }

    case 'RESTART_MATCH': {
      const live = state.live;
      if (!live || live.phase === 'POST_MATCH') return state;
      const wiped = wipeMatch(state, live.matchId);
      const cleared: TournamentState = { ...wiped, live: null, matches: updateMatch(wiped, live.matchId, { status: 'SCHEDULED', suspended: null, rules: undefined }) };
      return matchReducer(cleared, { type: 'START_MATCH', matchId: live.matchId, at: action.at });
    }

    case 'START_MATCH': {
      if (state.live) return state;
      const match0 = state.matches.find((m) => m.id === action.matchId);
      if (!match0 || match0.status !== 'SCHEDULED' || !state.queue.includes(match0.id)) return state;
      if (match0.suspended && !action.restart) {
        // Resume exactly where it was left.
        const sus = match0.suspended;
        const live: LiveMatch = {
          matchId: match0.id,
          phase: sus.phase,
          homeTeamId: sus.homeTeamId,
          awayTeamId: sus.awayTeamId,
          startedAt: sus.startedAt,
          completedAt: null,
          legSetups: sus.legSetups,
          firstThrowCard: sus.firstThrowCard,
        };
        return {
          ...state,
          live,
          matches: updateMatch(state, match0.id, { status: 'IN_PROGRESS', suspended: null }),
          queue: [match0.id, ...state.queue.filter((id) => id !== match0.id)],
        };
      }
      if (match0.suspended) {
        // Restart: forget the paused attempt entirely.
        const wiped = wipeMatch(state, match0.id);
        return matchReducer({ ...wiped, matches: updateMatch(wiped, match0.id, { suspended: null, rules: undefined, legsWon: { home: 0, away: 0 } }) }, { ...action, restart: false });
      }
      const match = match0;
      const teams = startableTeams(state, match);
      if (!teams) return state;
      const live: LiveMatch = {
        matchId: match.id,
        phase: 'PRE_MATCH',
        homeTeamId: teams.home,
        awayTeamId: teams.away,
        startedAt: action.at,
        completedAt: null,
        legSetups: [],
      };
      const withMatch = { ...state, live };
      live.legSetups = [initialLegSetup(withMatch, match, live, 0, 'RULE')];
      // Optional: all hands return to the pool when the playoffs begin.
      let cards = state.cards;
      if (match.stage === 'PLAYOFF' && state.settings.cards.expireHandsBeforePlayoffs && !cards.handsExpired) {
        cards = {
          ...cards,
          handsExpired: true,
          pendingDiscard: null,
          instances: cards.instances.map((i) => (i.status === 'IN_HAND' ? { ...i, status: 'IN_POOL', ownerTeamId: null } : i)),
        };
      }
      // Breaks after already-finished matches are over once the next match starts.
      const breaks = state.breaks.map((b) => (!b.completed && state.completedOrder.includes(b.afterMatchId) ? { ...b, completed: true } : b));
      return {
        ...state,
        breaks,
        cards,
        live,
        matches: updateMatch(state, match.id, { status: 'IN_PROGRESS', legsWon: { home: 0, away: 0 }, winnerTeamId: null, rules: structuredClone(state.settings.rules) }),
        queue: [match.id, ...state.queue.filter((id) => id !== match.id)],
      };
    }

    case 'ABORT_MATCH': {
      const live = state.live;
      if (!live || live.phase === 'POST_MATCH') return state;
      if (state.throws.some((t) => t.matchId === live.matchId)) return state;
      // Return any pre-match card (FIRST_THROW) to its team.
      let cards = state.cards;
      for (const p of cards.plays.filter((x) => x.matchId === live.matchId)) cards = giveTo(cards, p.instanceId, p.teamId);
      cards = { ...cards, plays: cards.plays.filter((p) => p.matchId !== live.matchId) };
      return { ...state, cards, live: null, matches: updateMatch(state, live.matchId, { status: 'SCHEDULED', rules: undefined }) };
    }

    case 'DEFER_MATCH': {
      if (state.live) return state;
      const i = state.queue.indexOf(action.matchId);
      if (i === -1) return state;
      const byId = new Map(state.matches.map((m) => [m.id, m]));
      const j = state.queue.findIndex((id, k) => {
        const m = byId.get(id);
        return k > i && m?.status === 'SCHEDULED' && !!startableTeams(state, m);
      });
      if (j === -1) return state;
      const queue = [...state.queue];
      queue.splice(i, 1);
      queue.splice(j, 0, action.matchId); // j shifted by the removal => lands right after the pulled match
      return { ...state, queue };
    }

    case 'SET_LEG_START': {
      const view = computeMatchView(state);
      if (!view || view.live.phase === 'POST_MATCH') return state;
      if (action.legIndex !== view.currentLegIndex || view.dartsThrownInLeg > 0) return state;
      const setup = view.live.legSetups[action.legIndex];
      if (!setup) return state;
      const count = (side: Side) => Math.max(1, state.teams.find((t) => t.id === view.teamIds[side])?.playerIds.length ?? 1);
      const fp = { ...setup.firstPlayer };
      for (const side of ['home', 'away'] as Side[]) {
        const v = action.firstPlayer?.[side];
        if (v !== undefined && Number.isInteger(v) && v >= 0 && v < count(side)) fp[side] = v;
      }
      // A new first-player choice replaces any explicit order fix for that side.
      const order = { ...setup.order };
      for (const side of ['home', 'away'] as Side[]) if (action.firstPlayer?.[side] !== undefined) delete order[side];
      let next: LegSetup = { ...setup, firstPlayer: fp, order };
      if (action.firstTeam) {
        next = action.resolvedBy
          ? { ...next, firstTeam: action.firstTeam, ruleFirstTeam: action.firstTeam, resolvedBy: action.resolvedBy }
          : { ...next, firstTeam: action.firstTeam };
      }
      return { ...state, live: setLegSetup(view.live, action.legIndex, next) };
    }

    case 'BEGIN_PLAY': {
      const live = state.live;
      if (!live || live.phase !== 'PRE_MATCH' || !live.legSetups[0]?.firstTeam) return state;
      return withLive(state, { phase: 'IN_PROGRESS' });
    }

    case 'THROW_DART': {
      const dart = { segment: action.segment, multiplier: action.multiplier };
      if (!isValidDart(dart)) return state;
      const view = computeMatchView(state);
      if (!view || view.live.phase !== 'IN_PROGRESS' || !view.turn) return state;
      if (state.throws.some((t) => t.id === action.id)) return state;
      const turn = view.turn;
      const raw = dartPoints(dart);
      const thrown: DartThrow = {
        id: action.id,
        matchId: view.match.id,
        legIndex: turn.legIndex,
        visitIndex: turn.visitIndex,
        dartIndex: (turn.darts.length + 1) as DartThrow['dartIndex'],
        teamId: turn.teamId,
        playerId: turn.playerId,
        segment: dart.segment,
        multiplier: dart.multiplier,
        rawPoints: raw,
        effectivePoints: raw,
        mulliganed: false,
        isCheckoutDart: false,
        checkoutType: 'NONE',
        activeCardId: turn.mods.plays[0]?.id ?? null,
        timestamp: action.at,
      };
      let next: TournamentState = { ...state, throws: [...state.throws, thrown] };
      let after = computeMatchView(next)!;
      // Fill in the card-adjusted outcome from the replay (the replay stays the source of truth).
      const visit = after.legs[turn.legIndex]?.visits.find((v) => v.visitIndex === turn.visitIndex);
      const pos = visit ? visit.darts.findIndex((d) => d.id === thrown.id) : -1;
      const isCheckout = after.legs[turn.legIndex]?.checkoutDart?.id === thrown.id;
      const final: DartThrow = {
        ...thrown,
        effectivePoints: visit && pos >= 0 ? (visit.points[pos] ?? raw) : raw,
        isCheckoutDart: isCheckout,
        checkoutType: isCheckout ? checkoutTypeOf(dart) : 'NONE',
      };
      next = { ...next, throws: [...state.throws, final] };
      after = computeMatchView(next)!;
      next = { ...next, matches: updateMatch(next, view.match.id, { legsWon: after.legsWon }) };

      if (after.winner) {
        const winnerTeamId = after.teamIds[after.winner];
        return {
          ...next,
          live: { ...next.live!, phase: 'POST_MATCH', completedAt: action.at },
          matches: updateMatch(next, view.match.id, { status: 'COMPLETED', winnerTeamId, legsWon: after.legsWon }),
          queue: next.queue.filter((id) => id !== view.match.id),
          completedOrder: [...next.completedOrder.filter((id) => id !== view.match.id), view.match.id],
          scorerDutyOverride: null,
        };
      }
      const wonLeg = after.legs[turn.legIndex]?.winner;
      if (wonLeg && !next.live!.legSetups[turn.legIndex + 1]) {
        const setup = nextLegSetup(next, view.match, next.live!, turn.legIndex + 1, after.legsWon);
        next = { ...next, live: setLegSetup(next.live!, turn.legIndex + 1, setup) };
      }
      return next;
    }

    case 'UNDO_DART': {
      const live = state.live;
      if (!live) return state;
      let idx = -1;
      for (let i = state.throws.length - 1; i >= 0; i--) {
        if (state.throws[i]!.matchId === live.matchId) {
          idx = i;
          break;
        }
      }
      // Strict LIFO across darts and cards: a card played after the last dart is undone first.
      const matchThrows = state.throws.filter((t) => t.matchId === live.matchId).length;
      const plays = state.cards.plays.filter((p) => p.matchId === live.matchId);
      const lastPlay = plays[plays.length - 1];
      if (lastPlay && lastPlay.afterThrowCount >= matchThrows && live.phase !== 'POST_MATCH') return undoLastPlay(state, lastPlay);
      if (idx === -1) return state;
      const throws = state.throws.filter((_, i) => i !== idx);
      let next: TournamentState = { ...state, throws };
      const after = computeMatchView(next)!;
      if (live.phase === 'POST_MATCH') {
        // Accidental finish: reopen the match.
        next = {
          ...next,
          live: { ...live, phase: 'IN_PROGRESS', completedAt: null },
          matches: updateMatch(next, live.matchId, { status: 'IN_PROGRESS', winnerTeamId: null, legsWon: after.legsWon }),
          queue: [live.matchId, ...next.queue.filter((id) => id !== live.matchId)],
          completedOrder: next.completedOrder.filter((id) => id !== live.matchId),
        };
      } else {
        next = { ...next, matches: updateMatch(next, live.matchId, { legsWon: after.legsWon }) };
      }
      return next;
    }

    case 'SWAP_PLAYERS_IN_LEG': {
      const team = state.teams.find((t) => t.id === action.teamId);
      if (!team || action.a === action.b || !team.playerIds.includes(action.a) || !team.playerIds.includes(action.b)) return state;
      const swap = (id: string) => (id === action.a ? action.b : id === action.b ? action.a : id);
      const throws = state.throws.map((t) =>
        t.matchId === action.matchId && t.legIndex === action.legIndex && t.teamId === action.teamId ? { ...t, playerId: swap(t.playerId) } : t,
      );
      let next: TournamentState = { ...state, throws };
      const live = state.live;
      const setup = live?.matchId === action.matchId ? live.legSetups[action.legIndex] : undefined;
      if (live && setup && (live.homeTeamId === action.teamId || live.awayTeamId === action.teamId)) {
        const side: Side = live.homeTeamId === action.teamId ? 'home' : 'away';
        const n = team.playerIds.length;
        const current = setup.order?.[side] ?? Array.from({ length: n }, (_, i) => team.playerIds[(setup.firstPlayer[side] + i) % n]!);
        const order = current.map(swap);
        const firstPlayer = { ...setup.firstPlayer, [side]: Math.max(0, team.playerIds.indexOf(order[0]!)) };
        next = { ...next, live: setLegSetup(live, action.legIndex, { ...setup, firstPlayer, order: { ...setup.order, [side]: order } }) };
      }
      return next;
    }

    case 'CONTINUE_TO_NEXT': {
      if (state.live?.phase !== 'POST_MATCH' || state.cards.pendingDiscard) return state;
      return { ...state, live: null };
    }
  }
}
