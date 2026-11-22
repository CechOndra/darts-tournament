import { isDoubleDart } from './scoring.ts';
import { collectStats, playerMetrics, type StatsData } from './stats.ts';
import type { TournamentState } from './state.ts';

/** Team + individual awards for the ceremony (scope and card filters come from collectStats). */

export type AwardId =
  | 'BEST_TEAM_AVG'
  | 'HIGHEST_VISIT'
  | 'DOUBLE_ASSASSINS'
  | 'HIGHEST_CHECKOUT'
  | 'FASTEST_LEG'
  | 'MARATHON_LEG'
  | 'EFFICIENT_CLOSER'
  | 'CLUB_26'
  | 'CARD_SHARK'
  | 'MVP'
  | 'TRIPLE_HUNTER'
  | 'FIRST_DART_SNIPER'
  | 'CLUTCH_CLOSER'
  | 'UNLUCKY_LEGEND';

export interface AwardWinner {
  /** teamId for team awards, playerId for individual awards. */
  id: string;
  value: number;
}

export interface Award {
  id: AwardId;
  kind: 'TEAM' | 'PLAYER';
  title: string;
  description: string;
  /** How to print the value (e.g. "62.4 avg"). */
  unit: string;
  winners: AwardWinner[];
}

const AWARD_META: Record<AwardId, { kind: 'TEAM' | 'PLAYER'; title: string; description: string; unit: string; lowerIsBetter?: boolean; decimals?: number }> = {
  BEST_TEAM_AVG: { kind: 'TEAM', title: 'Best Team Average', description: 'Highest 3-dart average as a team.', unit: 'avg', decimals: 2 },
  HIGHEST_VISIT: { kind: 'TEAM', title: 'Highest Visit', description: 'Biggest single visit of the tournament.', unit: 'points' },
  DOUBLE_ASSASSINS: { kind: 'TEAM', title: 'Double Assassins', description: 'Most legs finished on a double.', unit: 'double finishes' },
  HIGHEST_CHECKOUT: { kind: 'TEAM', title: 'Highest Checkout', description: 'Biggest finish of the tournament.', unit: 'checkout' },
  FASTEST_LEG: { kind: 'TEAM', title: 'Fastest Leg', description: 'Leg won in the fewest darts.', unit: 'darts', lowerIsBetter: true },
  MARATHON_LEG: { kind: 'TEAM', title: 'Marathon Leg', description: 'Leg won in the most darts.', unit: 'darts' },
  EFFICIENT_CLOSER: { kind: 'TEAM', title: 'Most Efficient Closer', description: 'Fewest darts per leg won (at least 2 legs won).', unit: 'darts per leg', lowerIsBetter: true, decimals: 1 },
  CLUB_26: { kind: 'TEAM', title: 'The 26 Club', description: 'Most visits of exactly 26.', unit: 'times' },
  CARD_SHARK: { kind: 'TEAM', title: 'Card Shark', description: 'Most Power Cards played.', unit: 'cards' },
  MVP: { kind: 'PLAYER', title: 'Tournament MVP', description: 'Highest individual 3-dart average (at least 9 darts).', unit: 'avg', decimals: 2 },
  TRIPLE_HUNTER: { kind: 'PLAYER', title: 'Triple Hunter', description: 'Most trebles hit.', unit: 'trebles' },
  FIRST_DART_SNIPER: { kind: 'PLAYER', title: 'First-Dart Sniper', description: 'Highest average on the first dart of a visit (at least 3 visits).', unit: 'per dart', decimals: 1 },
  CLUTCH_CLOSER: { kind: 'PLAYER', title: 'Clutch Closer', description: 'Most leg-winning darts.', unit: 'winning darts' },
  UNLUCKY_LEGEND: { kind: 'PLAYER', title: 'Unlucky Legend', description: 'Most busts plus most times targeted by cards.', unit: 'misfortunes' },
};

export const AWARD_IDS = Object.keys(AWARD_META) as AwardId[];
export const awardMeta = (id: AwardId) => AWARD_META[id];

export function formatAwardValue(id: AwardId, value: number): string {
  const m = AWARD_META[id];
  return `${m.decimals ? value.toFixed(m.decimals) : Math.round(value)} ${m.unit}`;
}

function top(id: AwardId, entries: AwardWinner[]): Award {
  const meta = AWARD_META[id];
  const valid = entries.filter((e) => Number.isFinite(e.value) && (meta.lowerIsBetter ? e.value > 0 : e.value > 0));
  let winners: AwardWinner[] = [];
  if (valid.length) {
    const best = meta.lowerIsBetter ? Math.min(...valid.map((e) => e.value)) : Math.max(...valid.map((e) => e.value));
    winners = valid.filter((e) => Math.abs(e.value - best) < 1e-9);
  }
  return { id, kind: meta.kind, title: meta.title, description: meta.description, unit: meta.unit, winners };
}

export function computeAwards(state: TournamentState, data: StatsData = collectStats(state)): Award[] {
  const teams = state.teams.map((t) => t.id);
  const metrics = playerMetrics(state, data);
  const tv = (teamId: string) => data.visits.filter((v) => v.teamId === teamId);

  const teamAvg = teams.map((id) => {
    const vs = tv(id);
    const darts = vs.reduce((s, v) => s + v.darts.length, 0);
    return { id, value: darts >= 9 ? (vs.reduce((s, v) => s + v.scored, 0) / darts) * 3 : 0 };
  });
  const highestVisit = teams.map((id) => ({ id, value: tv(id).reduce((m, v) => Math.max(m, v.scored), 0) }));
  const doubles = teams.map((id) => ({
    id,
    value: tv(id).filter((v) => v.checkout && v.darts.length > 0 && isDoubleDart(v.darts[v.darts.length - 1]!)).length,
  }));
  const highestCheckout = teams.map((id) => ({ id, value: tv(id).filter((v) => v.checkout).reduce((m, v) => Math.max(m, v.scoreBefore), 0) }));
  const wonLegs = (id: string) => data.legs.filter((l) => l.winnerTeamId === id).map((l) => l.dartsByTeam[id] ?? 0);
  const fastest = teams.map((id) => ({ id, value: wonLegs(id).length ? Math.min(...wonLegs(id)) : 0 }));
  const marathon = teams.map((id) => ({ id, value: wonLegs(id).length ? Math.max(...wonLegs(id)) : 0 }));
  const efficient = teams.map((id) => {
    const w = wonLegs(id);
    return { id, value: w.length >= 2 ? w.reduce((a, b) => a + b, 0) / w.length : 0 };
  });
  const club26 = teams.map((id) => ({ id, value: tv(id).filter((v) => v.scored === 26 && !v.bust).length }));
  const shark = teams.map((id) => ({ id, value: data.plays.filter((p) => p.teamId === id).length }));

  const players = metrics.map((m) => m.playerId);
  const pm = (id: string) => metrics.find((m) => m.playerId === id)!;

  return [
    top('BEST_TEAM_AVG', teamAvg),
    top('HIGHEST_VISIT', highestVisit),
    top('DOUBLE_ASSASSINS', doubles),
    top('HIGHEST_CHECKOUT', highestCheckout),
    top('FASTEST_LEG', fastest),
    top('MARATHON_LEG', marathon),
    top('EFFICIENT_CLOSER', efficient),
    top('CLUB_26', club26),
    top('CARD_SHARK', shark),
    top('MVP', players.map((id) => ({ id, value: pm(id).darts >= 9 ? pm(id).raw.AVG : 0 }))),
    top('TRIPLE_HUNTER', players.map((id) => ({ id, value: pm(id).triples }))),
    top('FIRST_DART_SNIPER', players.map((id) => ({ id, value: pm(id).visits >= 3 ? pm(id).raw.OPN : 0 }))),
    top('CLUTCH_CLOSER', players.map((id) => ({ id, value: pm(id).winningCheckoutDarts }))),
    top('UNLUCKY_LEGEND', players.map((id) => ({ id, value: pm(id).busts + (data.targeted[id] ?? 0) }))),
  ];
}
