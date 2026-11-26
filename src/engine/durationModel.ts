import { matchTeams } from './standings.ts';
import type { TournamentState } from './state.ts';

/**
 * Tournament duration model (laptop tool, not used by the app).
 * Real darts counts come from simulated tournaments (simulate.ts); this file turns them into clock time,
 * with the matches spread over 1..n dartboards. Pure: pass the random generator in.
 */

export interface MatchLoad {
  id: string;
  stage: 'GROUP' | 'PLAYOFF';
  groupIndex: number | null;
  final: boolean;
  teams: [string, string];
  /** Match ids (or 'GROUP:<index>' for a whole group) that must be finished first. */
  needs: string[];
  darts: number;
  visits: number;
  legs: number;
}

export interface TimeParams {
  /** Seconds per dart (aim + throw), mean and sd. */
  throwSec: [number, number];
  /** Seconds per visit for walking to the board, pulling darts, scoring, switching player. */
  visitSec: [number, number];
  /** Seconds between legs of one match. */
  legSec: number;
  /** Seconds between two matches on one board (calling teams, scorer swap, stage show). */
  gapSec: [number, number];
  /** Scheduled breaks: count and minutes each (all boards stop). */
  breaks: number;
  breakMin: number;
  /** Chance per match of an accident (dispute, tablet problem, ...) and its mean minutes. */
  accidentChance: number;
  accidentMin: number;
}

export const DEFAULT_TIME: TimeParams = {
  throwSec: [4, 1.5],
  visitSec: [12, 4],
  legSec: 30,
  gapSec: [120, 60],
  breaks: 1,
  breakMin: 15,
  accidentChance: 0.05,
  accidentMin: 4,
};

type Rng = () => number;
const normal = (rng: Rng, [mean, sd]: [number, number]) => Math.max(mean * 0.25, mean + sd * Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng()));

/** Reads per-match loads out of a fully simulated tournament (matches are stored in schedule order). */
export function loadsOf(state: TournamentState): MatchLoad[] {
  return state.matches.map((m) => {
    const ts = state.throws.filter((t) => t.matchId === m.id);
    const t = matchTeams(state, m);
    const needs: string[] = [];
    for (const slot of [m.home, m.away]) {
      if (slot.kind === 'MATCH_WINNER' || slot.kind === 'MATCH_LOSER') needs.push(slot.matchId);
      if (slot.kind === 'GROUP_RANK') needs.push(`GROUP:${slot.groupIndex}`);
    }
    return {
      id: m.id,
      stage: m.stage,
      groupIndex: m.groupIndex,
      final: m.playoffRound === 'FINAL',
      teams: [t.home ?? '', t.away ?? ''] as [string, string],
      needs,
      darts: ts.length,
      visits: new Set(ts.map((x) => `${x.legIndex}:${x.visitIndex}:${x.teamId}`)).size,
      legs: new Set(ts.map((x) => x.legIndex)).size,
    };
  });
}

/** Net playing time of one match in seconds (no gap before it). */
export function matchSeconds(load: MatchLoad, p: TimeParams, rng: Rng): number {
  let s = Math.max(0, load.legs - 1) * p.legSec;
  for (let i = 0; i < load.darts; i++) s += normal(rng, p.throwSec);
  for (let i = 0; i < load.visits; i++) s += normal(rng, p.visitSec);
  if (rng() < p.accidentChance) s += 60 * p.accidentMin * (0.5 + rng());
  return s;
}

export interface Timeline {
  /** Seconds after the first start. */
  finish: number;
  groupEnd: number;
  /** Per match id: start and end seconds. */
  spans: Map<string, [number, number]>;
}

/**
 * Plays the schedule on `boards` boards (groups / playoffs; the final is always one board).
 * Matches start in queue order; a match waits for a free board, both of its teams and its feeder matches.
 */
export function runTimeline(loads: MatchLoad[], boards: { groups: number; playoffs: number }, p: TimeParams, rng: Rng): Timeline {
  const secs = new Map(loads.map((l) => [l.id, matchSeconds(l, p, rng)]));
  const gap = () => normal(rng, p.gapSec);
  const breakAfter = new Set<number>();
  for (let i = 1; i <= p.breaks; i++) breakAfter.add(Math.min(loads.length - 2, Math.round((i * loads.length) / (p.breaks + 1)) - 1));
  const free: number[] = Array(Math.max(boards.groups, boards.playoffs, 1)).fill(0);
  const teamFree = new Map<string, number>();
  const spans = new Map<string, [number, number]>();
  const groupDone = new Map<string, number>();
  let lastStart = 0;
  let barrier = 0;
  let latestEnd = 0;
  let groupEnd = 0;
  loads.forEach((l, i) => {
    const n = l.stage === 'GROUP' ? boards.groups : l.final ? 1 : boards.playoffs;
    let b = 0;
    for (let k = 1; k < n; k++) if (free[k]! < free[b]!) b = k;
    const ready = Math.max(0, ...l.needs.map((id) => (id.startsWith('GROUP:') ? (groupDone.get(id) ?? 0) : (spans.get(id)?.[1] ?? 0))));
    const start = Math.max(free[b]! + (free[b]! > 0 ? gap() : 0), ready + gap(), barrier, lastStart, ...l.teams.map((t) => teamFree.get(t) ?? 0));
    const end = start + secs.get(l.id)!;
    free[b] = end;
    for (const t of l.teams) teamFree.set(t, end);
    spans.set(l.id, [start, end]);
    lastStart = start;
    latestEnd = Math.max(latestEnd, end);
    if (l.stage === 'GROUP') {
      groupEnd = Math.max(groupEnd, end);
      const key = `GROUP:${l.groupIndex}`;
      groupDone.set(key, Math.max(groupDone.get(key) ?? 0, end));
    }
    if (breakAfter.has(i)) barrier = latestEnd + p.breakMin * 60 * (0.8 + 0.4 * rng());
  });
  return { finish: latestEnd, groupEnd, spans };
}

export function percentile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))]!;
}
