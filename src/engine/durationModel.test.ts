import { describe, expect, it } from 'vitest';
import { DEFAULT_TIME, runTimeline, type MatchLoad } from './durationModel.ts';

const load = (id: string, a: string, b: string, extra: Partial<MatchLoad> = {}): MatchLoad => ({
  id, stage: 'GROUP', groupIndex: 0, final: false, teams: [a, b], needs: [], darts: 30, visits: 10, legs: 1, ...extra,
});
const p = { ...DEFAULT_TIME, cards: { ...DEFAULT_TIME.cards, mode: 'OFF' as const }, breaks: 0, accidentChance: 0, throwSec: [4, 0] as [number, number], visitSec: [12, 0] as [number, number], gapSec: [60, 0] as [number, number] };
const mid = () => 0.5;

describe('duration model', () => {
  const four = [load('m1', 'a', 'b'), load('m2', 'c', 'd'), load('m3', 'e', 'f'), load('m4', 'g', 'h')];

  it('two boards are about twice as fast for independent matches', () => {
    const one = runTimeline(four, { groups: 1, playoffs: 1 }, p, mid).finish;
    const two = runTimeline(four, { groups: 2, playoffs: 1 }, p, mid).finish;
    expect(two).toBeLessThan(one * 0.6);
  });

  it('a team never plays on two boards at once', () => {
    const t = runTimeline([load('m1', 'a', 'b'), load('m2', 'a', 'c')], { groups: 2, playoffs: 1 }, p, mid);
    expect(t.spans.get('m2')![0]).toBeGreaterThanOrEqual(t.spans.get('m1')![1]);
  });

  it('playoffs wait for their group and the final uses one board', () => {
    const sf = load('m3', 'a', 'c', { stage: 'PLAYOFF', needs: ['GROUP:0'] });
    const fin = load('m4', 'a', 'd', { stage: 'PLAYOFF', final: true, needs: ['m3'] });
    const t = runTimeline([load('m1', 'a', 'b'), load('m2', 'c', 'd'), sf, fin], { groups: 2, playoffs: 2 }, p, mid);
    expect(t.spans.get('m3')![0]).toBeGreaterThanOrEqual(t.groupEnd);
    expect(t.spans.get('m4')![0]).toBeGreaterThanOrEqual(t.spans.get('m3')![1]);
  });

  it('scheduled breaks add time', () => {
    const none = runTimeline(four, { groups: 1, playoffs: 1 }, p, mid).finish;
    const brk = runTimeline(four, { groups: 1, playoffs: 1 }, { ...p, breaks: 1, breakMin: 10 }, mid).finish;
    expect(brk - none).toBeGreaterThan(8 * 60);
  });

  it('cards add draw time, and groups-only mode skips playoffs', () => {
    const one = [load('m1', 'a', 'b')];
    const po = [load('m1', 'a', 'b', { stage: 'PLAYOFF' })];
    const cards = (mode: 'OFF' | 'GROUPS' | 'ALL') => ({ ...p, cards: { ...p.cards, mode, playChance: 0, drawSec: [25, 0] as [number, number] } });
    const f = (l: MatchLoad[], mode: 'OFF' | 'GROUPS' | 'ALL') => runTimeline(l, { groups: 1, playoffs: 1 }, cards(mode), mid).finish;
    expect(f(one, 'ALL') - f(one, 'OFF')).toBeCloseTo(50, 0); // loser + winner draw, 25 s each
    expect(f(po, 'GROUPS')).toBe(f(po, 'OFF'));
  });
});
