import { bestCheckout } from './checkout.ts';
import { computeMatchView } from './match.ts';
import { tournamentReducer } from './reducer.ts';
import type { DartInput, Multiplier } from './scoring.ts';
import { startableTeams } from './matchReducer.ts';
import type { TournamentState } from './state.ts';
import type { Match } from './types.ts';

/**
 * Test-tournament simulator. It plays matches through the SAME reducer actions the scorer tablet uses
 * (START_MATCH, THROW_DART, NEXT_LEG, ...), one dart at a time, so stats, standings, awards and FUT cards
 * come out exactly as for a played match. Power Cards are not used by simulated matches.
 *
 * Skill model: every player has a fixed 3-dart average = `average` + `variance` * z, where z is a stable
 * normal value derived from the player id (so the same player is good or bad all tournament).
 * `variance` is therefore the spread (standard deviation, in average points) between players.
 */
export interface SimSkill {
  average: number;
  variance: number;
}
export const DEFAULT_SKILL: SimSkill = { average: 45, variance: 10 };

const RING = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const STEP_MS = 500; // virtual time per dart, keeps the schedule ETAs roughly sane
const MAX_DARTS = 3000; // guard against a never-ending match

type Rng = () => number;

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rng: Rng): number {
  return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
}

/** A player's stable personal 3-dart average. */
export function playerAverage(playerId: string, skill: SimSkill): number {
  let h = 2166136261;
  for (const ch of playerId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return Math.max(20, skill.average + skill.variance * normal(mulberry32(h)));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Aim at T20 hits with probability pT; otherwise the dart lands like a typical miss (E ~ 10.4 points). */
const trebleHitChance = (avg: number) => clamp((avg / 3 - 10.4) / 49.6, 0.02, 0.8);

function adjacent(n: number, rng: Rng): number {
  const i = RING.indexOf(n);
  return RING[(i + (rng() < 0.5 ? 1 : RING.length - 1)) % RING.length]!;
}

function throwAt(aim: DartInput, avg: number, rng: Rng): DartInput {
  const pT = trebleHitChance(avg);
  const pD = 0.12 + 0.6 * pT;
  const r = rng();
  if (aim.segment === 50 || aim.segment === 25) {
    const p = aim.segment === 50 ? pD * 0.8 : 0.6;
    if (r < p) return aim;
    return r < p + 0.3 ? { segment: 25, multiplier: 1 } : { segment: 1 + Math.floor(rng() * 20), multiplier: 1 };
  }
  const p = aim.multiplier === 3 ? pT : aim.multiplier === 2 ? pD : 0.88;
  if (r < p) return aim;
  const q = (r - p) / (1 - p);
  if (aim.multiplier === 1) return q < 0.8 ? { segment: adjacent(aim.segment, rng), multiplier: 1 } : { segment: 0, multiplier: 0 };
  if (q < 0.4) return { segment: aim.segment, multiplier: 1 };
  if (q < 0.65) return { segment: adjacent(aim.segment, rng), multiplier: 1 };
  if (q < 0.85) return { segment: 0, multiplier: 0 };
  return { segment: 1 + Math.floor(rng() * 20), multiplier: 1 };
}

function chooseAim(remaining: number, dartsLeft: number, mode: Parameters<typeof bestCheckout>[2]): DartInput {
  if (remaining <= 170) {
    const route = bestCheckout(remaining, dartsLeft, mode);
    if (route) return route.darts[0]!;
    // No finish this visit: set up a good double.
    const single = remaining > 32 ? Math.min(20, remaining - 32) : 1;
    return { segment: single, multiplier: 1 };
  }
  return { segment: 20, multiplier: 3 };
}

/** The next queued match that can be started (both teams known), or null. */
export function nextSimulatable(state: TournamentState): Match | null {
  for (const id of state.queue) {
    const m = state.matches.find((x) => x.id === id);
    if (m && m.status === 'SCHEDULED' && !m.suspended && startableTeams(state, m)) return m;
  }
  return null;
}

/** Plays one whole match. Returns the new state, or the same state when nothing can be simulated. */
export function simulateNextMatch(state: TournamentState, skill: SimSkill = DEFAULT_SKILL, rng: Rng = Math.random): TournamentState {
  if (!state.meta?.isTest || state.live) return state;
  const match = nextSimulatable(state);
  if (!match) return state;
  let at = Math.max(Date.now(), ...state.throws.slice(-1).map((t) => t.timestamp + 30_000));
  let s = tournamentReducer(state, { type: 'START_MATCH', matchId: match.id, at });
  const coin = (legIndex: number) => {
    const v = computeMatchView(s);
    if (v && !v.setup?.firstTeam) s = tournamentReducer(s, { type: 'SET_LEG_START', legIndex, firstTeam: rng() < 0.5 ? 'home' : 'away', resolvedBy: 'COIN_TOSS' });
  };
  coin(0);
  s = tournamentReducer(s, { type: 'BEGIN_PLAY' });
  const mode = s.matches.find((m) => m.id === match.id)?.rules?.checkoutMode ?? s.settings.rules.checkoutMode;

  for (let n = 0; n < MAX_DARTS; n++) {
    const v = computeMatchView(s);
    if (!v || v.live.phase === 'POST_MATCH') break;
    if (v.live.awaitingNextLeg != null) {
      s = tournamentReducer(s, { type: 'NEXT_LEG' });
      continue;
    }
    const turn = v.turn;
    if (!turn) {
      // The next leg's starter is still undecided (e.g. the deciding leg): toss a coin.
      const before = s;
      coin(v.currentLegIndex);
      if (s === before) break;
      continue;
    }
    const avg = playerAverage(turn.playerId, skill);
    const dart = throwAt(chooseAim(turn.remaining, turn.maxDarts - turn.darts.length, mode), avg, rng);
    at += STEP_MS;
    s = tournamentReducer(s, { type: 'THROW_DART', id: `sim_${match.id}_${n}`, segment: dart.segment, multiplier: dart.multiplier as Multiplier, at });
  }
  if (s.live?.phase !== 'POST_MATCH') return state; // did not finish: drop the attempt
  return tournamentReducer(s, { type: 'CONTINUE_TO_NEXT' });
}

/** Plays up to `count` matches (Infinity = all), or only group matches with stage 'GROUP'. */
export function simulateMatches(state: TournamentState, count: number, skill: SimSkill = DEFAULT_SKILL, rng: Rng = Math.random, stage?: 'GROUP'): TournamentState {
  let s = state;
  for (let i = 0; i < count; i++) {
    const next = nextSimulatable(s);
    if (!next || (stage && next.stage !== stage)) break;
    const after = simulateNextMatch(s, skill, rng);
    if (after === s) break;
    s = after;
  }
  return s;
}
