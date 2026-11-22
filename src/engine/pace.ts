import { queuedMatches } from './selectors.ts';
import { matchTeams } from './standings.ts';
import type { TournamentState } from './state.ts';
import type { Match, MatchFormat, ScheduledBreak } from './types.ts';

/**
 * Pace telemetry + forward simulation of the schedule (spec 4.5).
 * Pure: pass `now` in so it is testable and identical on every device.
 */

export const EXPECTED_LEGS: Record<MatchFormat, number> = { BO1: 1, BO3: 2.5, BO5: 4, BO7: 5.5 };
const MAX_GAP_SECONDS = 12 * 60;
const DEFAULT_BREAK_MINUTES = 15;

export interface MatchTiming {
  matchId: string;
  first: number;
  last: number;
  legs: number;
}

export function matchTiming(state: TournamentState, matchId: string): MatchTiming | null {
  const ts = state.throws.filter((t) => t.matchId === matchId);
  if (!ts.length) return null;
  const legs = new Set(ts.map((t) => t.legIndex)).size;
  return { matchId, first: Math.min(...ts.map((t) => t.timestamp)), last: Math.max(...ts.map((t) => t.timestamp)), legs };
}

/** Round 1 = every team has finished at least one match. */
export function roundOneComplete(state: TournamentState): boolean {
  const played = new Set<string>();
  for (const id of state.completedOrder) {
    const m = state.matches.find((x) => x.id === id);
    if (!m) continue;
    const t = matchTeams(state, m);
    if (t.home) played.add(t.home);
    if (t.away) played.add(t.away);
  }
  return state.teams.length > 0 && state.teams.every((t) => played.has(t.id));
}

export interface Pace {
  /** True once Round 1 is complete (measured pace); otherwise defaults are used. */
  measured: boolean;
  avgSecondsPerLeg: number;
  avgGapSeconds: number;
}

export function paceStats(state: TournamentState): Pace {
  const defaultLeg = state.settings.rules.startingScore === 501 ? 300 : 200;
  const timings = state.completedOrder.map((id) => matchTiming(state, id)).filter((t): t is MatchTiming => !!t);
  const legs = timings.reduce((s, t) => s + t.legs, 0);
  const secs = timings.reduce((s, t) => s + (t.last - t.first) / 1000, 0);
  const gaps: number[] = [];
  for (let i = 1; i < timings.length; i++) {
    const prev = timings[i - 1]!;
    const hadBreak = state.breaks.some((b) => b.afterMatchId === prev.matchId);
    const gap = (timings[i]!.first - prev.last) / 1000;
    if (!hadBreak && gap > 0 && gap <= MAX_GAP_SECONDS) gaps.push(gap);
  }
  const measured = roundOneComplete(state) && legs > 0;
  return {
    measured,
    avgSecondsPerLeg: measured ? secs / legs : defaultLeg,
    avgGapSeconds: measured && gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 120,
  };
}

export interface MatchEta {
  matchId: string;
  start: number;
  /** First uncompleted break that happens before this match (guests show "After <break>"). */
  afterBreak: ScheduledBreak | null;
}

export interface Projection {
  pace: Pace;
  etas: MatchEta[];
  finish: number | null;
}

const duration = (pace: Pace, m: Match) => pace.avgSecondsPerLeg * EXPECTED_LEGS[m.format] * 1000;

/** Project start times for every unplayed match and the tournament finish. */
export function projectSchedule(state: TournamentState, now: number): Projection {
  const pace = paceStats(state);
  const queue = queuedMatches(state);
  const etas: MatchEta[] = [];
  let t = now;
  let pendingBreak: ScheduledBreak | null = null;
  queue.forEach((m, i) => {
    if (i === 0 && m.status === 'IN_PROGRESS') {
      const timing = matchTiming(state, m.id);
      const started = timing?.first ?? state.live?.startedAt ?? now;
      etas.push({ matchId: m.id, start: started, afterBreak: null });
      t = Math.max(now, started + duration(pace, m));
    } else {
      if (i > 0) t += pace.avgGapSeconds * 1000;
      etas.push({ matchId: m.id, start: t, afterBreak: pendingBreak });
      t += duration(pace, m);
    }
    const brk = state.breaks.find((b) => b.afterMatchId === m.id && !b.completed);
    if (brk) {
      t += (brk.durationMinutes ?? DEFAULT_BREAK_MINUTES) * 60_000;
      pendingBreak ??= brk;
    }
  });
  return { pace, etas, finish: queue.length ? t : null };
}

export const formatClock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
