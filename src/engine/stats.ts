import { CARD_BY_ID } from './cardCatalog.ts';
import { replayStoredMatch } from './match.ts';
import { isDoubleDart, isTripleDart, type Multiplier } from './scoring.ts';
import { matchTeams } from './standings.ts';
import type { TournamentState } from './state.ts';
import type { CardPlay, Match, Side, StatCode } from './types.ts';

/**
 * Tournament statistics from the event-sourced dart log. Respects `statsScope` and
 * `includeCardAffectedThrows`:
 *  - OFF (default): raw points, only visits without a score-altering card
 *    (EXTRA_DART / STEAL_DART visits still count; mulliganed darts never count).
 *  - ON: effective (card-adjusted) points on every visit.
 */

export interface DartRec {
  playerId: string;
  teamId: string;
  segment: number;
  multiplier: Multiplier;
  points: number;
  before: number;
  /** 1-based position in the visit. */
  index: number;
  legWinning: boolean;
}

export interface VisitRec {
  matchId: string;
  legIndex: number;
  playerId: string;
  teamId: string;
  scoreBefore: number;
  scored: number;
  bust: boolean;
  checkout: boolean;
  darts: DartRec[];
}

export interface LegRec {
  matchId: string;
  legIndex: number;
  winnerTeamId: string | null;
  dartsByTeam: Record<string, number>;
  playersInLeg: string[];
}

export interface StatsData {
  visits: VisitRec[];
  legs: LegRec[];
  plays: CardPlay[];
  /** Visits each player was targeted by an opponent's card. */
  targeted: Record<string, number>;
}

const COUNT_ANYWAY = new Set(['EXTRA_DART', 'STEAL_DART']);

export function matchesInScope(state: TournamentState): Match[] {
  const scope = state.settings.visibility.statsScope;
  return state.matches.filter((m) => (m.status === 'COMPLETED' || m.status === 'IN_PROGRESS') && (scope === 'ALL_MATCHES' || m.stage === 'GROUP'));
}

/** Flatten every in-scope visit / leg into records. */
export function collectStats(state: TournamentState): StatsData {
  const includeCards = state.settings.visibility.includeCardAffectedThrows;
  const visits: VisitRec[] = [];
  const legs: LegRec[] = [];
  const targeted: Record<string, number> = {};
  const scopeIds = new Set<string>();
  for (const m of matchesInScope(state)) {
    const t = matchTeams(state, m);
    const live = state.live?.matchId === m.id ? state.live : null;
    const home = t.home ?? live?.homeTeamId;
    const away = t.away ?? live?.awayTeamId;
    if (!home || !away) continue;
    scopeIds.add(m.id);
    const teamIds: Record<Side, string> = { home, away };
    const replay = replayStoredMatch(state, m, teamIds);
    for (const leg of replay.legs) {
      if (!leg) continue;
      const dartsByTeam: Record<string, number> = { [home]: leg.dartsBySide.home, [away]: leg.dartsBySide.away };
      const players = new Set<string>();
      for (const v of leg.visits) {
        players.add(v.playerId);
        for (const p of v.mods.plays) {
          const timing = CARD_BY_ID[p.effectCardTypeId].timing;
          if (p.teamId !== v.teamId && (timing === 'OPP_VISIT' || timing === 'RANDOM')) targeted[v.playerId] = (targeted[v.playerId] ?? 0) + 1;
        }
        const cardAltered = v.mods.plays.some((p) => !COUNT_ANYWAY.has(p.effectCardTypeId));
        if (!includeCards && cardAltered) continue;
        const darts: DartRec[] = v.darts.map((d, i) => ({
          playerId: v.playerId,
          teamId: v.teamId,
          segment: d.segment,
          multiplier: d.multiplier,
          points: includeCards ? (v.points[i] ?? d.rawPoints) : d.rawPoints,
          before: v.before[i] ?? 0,
          index: i + 1,
          legWinning: v.checkout && leg.checkoutDart?.id === d.id,
        }));
        const scored = includeCards ? v.scored : v.bust ? 0 : darts.reduce((s, d) => s + d.points, 0);
        visits.push({ matchId: m.id, legIndex: leg.index, playerId: v.playerId, teamId: v.teamId, scoreBefore: v.scoreBefore, scored, bust: v.bust, checkout: v.checkout, darts });
      }
      legs.push({ matchId: m.id, legIndex: leg.index, winnerTeamId: leg.winner ? teamIds[leg.winner] : null, dartsByTeam, playersInLeg: [...players] });
    }
  }
  const plays = state.cards.plays.filter((p) => scopeIds.has(p.matchId));
  return { visits, legs, plays, targeted };
}

// ------------------------------------------------------------------ player metrics

export interface PlayerMetrics {
  playerId: string;
  teamId: string;
  darts: number;
  visits: number;
  points: number;
  average: number;
  highestVisit: number;
  checkouts: number;
  highestCheckout: number;
  busts: number;
  triples: number;
  dart1Average: number;
  winningCheckoutDarts: number;
  raw: Record<StatCode, number>;
}

const isQualityDart = (d: DartRec) =>
  (d.segment === 20 && d.multiplier >= 1) || d.segment === 25 || d.segment === 50 || d.multiplier === 2 || d.multiplier === 3;

export function playerMetrics(state: TournamentState, data: StatsData = collectStats(state)): PlayerMetrics[] {
  const out: PlayerMetrics[] = [];
  for (const team of state.teams) {
    for (const pid of team.playerIds) {
      const vs = data.visits.filter((v) => v.playerId === pid);
      const ds = vs.flatMap((v) => v.darts);
      const points = vs.reduce((s, v) => s + v.scored, 0);
      const darts = ds.length;
      const visits = vs.length;
      const per = (a: number, b: number) => (b > 0 ? a / b : 0);

      // STR: longest run of quality darts + 0.05 x back-to-back 40+ visits
      let run = 0;
      let best = 0;
      for (const d of ds) {
        run = isQualityDart(d) ? run + 1 : 0;
        best = Math.max(best, run);
      }
      let backToBack = 0;
      for (let i = 1; i < vs.length; i++) if (vs[i]!.scored >= 40 && vs[i - 1]!.scored >= 40) backToBack++;

      const setup = ds.filter((d) => d.before > 60);
      const finishingDarts = ds.filter((d) => d.before <= 60);
      const winning = ds.filter((d) => d.legWinning);
      const checkoutVisits = vs.filter((v) => v.checkout);
      const highestCheckout = checkoutVisits.reduce((m, v) => Math.max(m, v.scoreBefore), 0);
      const dtCheckouts = winning.filter((d) => isDoubleDart(d) || isTripleDart(d)).length;
      const legsPlayed = data.legs.filter((l) => l.playersInLeg.includes(pid)).length;
      const dart1 = ds.filter((d) => d.index === 1);
      const clutch = vs.filter((v) => v.scoreBefore <= 120);
      const clutchDarts = clutch.reduce((s, v) => s + v.darts.length, 0);

      const raw: Record<StatCode, number> = {
        AVG: per(points, darts) * 3,
        PWR: per(vs.filter((v) => v.scored >= 60).length + 2 * vs.filter((v) => v.scored >= 80).length + 3 * ds.filter((d) => d.multiplier === 3).length, visits),
        STR: best + 0.05 * backToBack,
        ACC: per(setup.filter((d) => d.segment === 20).length, setup.length) * 100,
        CON: per(vs.filter((v) => !v.bust && v.scored >= 20).length, visits) * 100,
        FIN: per(winning.length, finishingDarts.length) * 100 + 0.25 * highestCheckout + 5 * dtCheckouts,
        DBL: per(ds.filter((d) => isDoubleDart(d)).length, legsPlayed),
        OPN: per(dart1.reduce((s, d) => s + d.points, 0), dart1.length),
        CLU: per(clutch.reduce((s, v) => s + v.scored, 0), clutchDarts) * 3,
      };
      out.push({
        playerId: pid,
        teamId: team.id,
        darts,
        visits,
        points,
        average: Math.round(raw.AVG * 100) / 100,
        highestVisit: vs.reduce((m, v) => Math.max(m, v.scored), 0),
        checkouts: checkoutVisits.length,
        highestCheckout,
        busts: vs.filter((v) => v.bust).length,
        triples: ds.filter((d) => d.multiplier === 3).length,
        dart1Average: Math.round(raw.OPN * 100) / 100,
        winningCheckoutDarts: winning.length,
        raw,
      });
    }
  }
  return out;
}

// ------------------------------------------------------------------ FUT cards

export const STAT_LABEL: Record<StatCode, { short: string; name: string }> = {
  AVG: { short: 'AVG', name: 'Scoring Average' },
  PWR: { short: 'PWR', name: 'Heavy Scoring' },
  STR: { short: 'STR', name: 'Hot Streaks' },
  ACC: { short: 'ACC', name: '20s Accuracy' },
  CON: { short: 'CON', name: 'Consistency' },
  FIN: { short: 'FIN', name: 'Finishing' },
  DBL: { short: 'DBL', name: 'Double Sniper' },
  OPN: { short: 'OPN', name: 'First-Dart Opener' },
  CLU: { short: 'CLU', name: 'Clutch Closer' },
};
export const STAT_CODES: StatCode[] = ['AVG', 'PWR', 'STR', 'ACC', 'CON', 'FIN', 'DBL', 'OPN', 'CLU'];

/** Plain-language explanation of each FUT stat (guest phones, admin, card detail). */
export const STAT_HELP: Record<StatCode, string> = {
  AVG: 'Points scored per 3 darts across all counted visits. The classic darts average.',
  PWR: 'Big scoring: visits of 60+ count 1, visits of 80+ count 2 more, and every treble counts 3, divided by the number of visits.',
  STR: 'Longest run of quality darts in a row (any 20, any double or treble, 25 or bull), plus a little extra for back-to-back 40+ visits.',
  ACC: 'Share of darts aimed while still setting up (more than 60 left) that landed in the 20 (single, double or treble 20).',
  CON: 'Share of visits that scored 20 or more without busting.',
  FIN: 'Checkout success with 60 or less left, plus a bonus for the highest checkout and for finishing on doubles or trebles.',
  DBL: 'Doubles and bulls hit per leg played.',
  OPN: 'Average points of the first dart of each visit.',
  CLU: '3-dart average on visits that start at 120 or less (the finishing zone).',
};

const PLAYSTYLE: Record<StatCode, string> = {
  AVG: 'Scoring Machine',
  PWR: 'Power Hitter',
  STR: 'Streak Master',
  ACC: 'Sharpshooter',
  CON: 'Metronome',
  FIN: 'Finisher',
  DBL: 'Double Sniper',
  OPN: 'Fast Starter',
  CLU: 'Clutch Closer',
};

export type FutFrame = 'BRONZE' | 'SILVER' | 'GOLD' | 'ICON';

export interface FutCard {
  playerId: string;
  teamId: string;
  ratings: { code: StatCode; value: number; raw: number }[];
  ovr: number;
  frame: FutFrame;
  playstyle: string;
  metrics: PlayerMetrics;
}

/** Mid-rank percentile in [0, 1] (ties share the middle of their block). */
export function midRankPercentile(value: number, all: number[]): number {
  if (all.length <= 1) return 0.5;
  const below = all.filter((v) => v < value).length;
  const equal = all.filter((v) => v === value).length;
  return (below + 0.5 * (equal - 1)) / (all.length - 1);
}

export const toRating = (p: number) => Math.round(55 + 44 * Math.min(1, Math.max(0, p)));

export function frameFor(ovr: number): FutFrame {
  if (ovr >= 87) return 'ICON';
  if (ovr >= 77) return 'GOLD';
  if (ovr >= 66) return 'SILVER';
  return 'BRONZE';
}

/** FUT cards for every player with at least one counted visit. */
export function futCards(state: TournamentState, metrics: PlayerMetrics[] = playerMetrics(state)): FutCard[] {
  const attrs = state.settings.futCardAttributes;
  const active = metrics.filter((m) => m.visits > 0);
  return active.map((m) => {
    const ratings = attrs.map((code) => ({
      code,
      raw: m.raw[code],
      value: toRating(
        midRankPercentile(
          m.raw[code],
          active.map((x) => x.raw[code]),
        ),
      ),
    }));
    const ovr = Math.round(ratings.reduce((s, r) => s + r.value, 0) / ratings.length);
    const top = [...ratings].sort((a, b) => b.value - a.value)[0]!;
    return { playerId: m.playerId, teamId: m.teamId, ratings, ovr, frame: frameFor(ovr), playstyle: `${PLAYSTYLE[top.code]}+`, metrics: m };
  });
}

// ------------------------------------------------------------------ Ultimate Team

export interface UltimateSlot {
  code: StatCode;
  card: FutCard | null;
}

/**
 * Team of the tournament: one spot per card stat, filled in the stats' priority order
 * (the order the admin sets for the 6 card stats). Each spot goes to the best remaining
 * player in that stat, so nobody appears twice. Players need 9+ counted darts when possible.
 */
export function ultimateTeam(state: TournamentState, cards: FutCard[]): UltimateSlot[] {
  const eligible = cards.filter((c) => c.metrics.darts >= 9);
  const pool = eligible.length >= state.settings.futCardAttributes.length ? eligible : cards;
  const used = new Set<string>();
  return state.settings.futCardAttributes.map((code) => {
    const best = pool
      .filter((c) => !used.has(c.playerId))
      .sort((a, b) => b.metrics.raw[code] - a.metrics.raw[code] || b.ovr - a.ovr)[0];
    if (best) used.add(best.playerId);
    return { code, card: best ?? null };
  });
}
