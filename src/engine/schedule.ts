import type { Match, MatchFormat, PlayoffRound, StructureSettings, Team, TeamSlot } from './types.ts';

export const matchId = (n: number) => `match_${String(n).padStart(2, '0')}`;

type Pair = [string, string];

/**
 * Circle-method round robin. Returns rounds of [home, away] team-id pairs.
 * Odd team counts get a rotating bye (no match generated for it).
 */
export function roundRobinRounds(teamIds: string[]): Pair[][] {
  const ids: (string | null)[] = [...teamIds];
  if (ids.length < 2) return [];
  if (ids.length % 2 === 1) ids.push(null);
  const n = ids.length;
  const rounds: Pair[][] = [];
  let order = ids;
  for (let r = 0; r < n - 1; r++) {
    const pairs: Pair[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = order[i];
      const b = order[n - 1 - i];
      if (a && b) pairs.push(r % 2 === 1 && i === 0 ? [b, a] : [a, b]);
    }
    rounds.push(pairs);
    // keep order[0] fixed, rotate the rest clockwise
    order = [order[0]!, order[n - 1]!, ...order.slice(1, n - 1)];
  }
  return rounds;
}

const teamsOf = (m: { home: TeamSlot; away: TeamSlot }) =>
  [m.home, m.away].flatMap((s) => (s.kind === 'TEAM' ? [s.teamId] : []));

/**
 * Greedy reorder keeping the original progression but never scheduling a team in
 * two consecutive matches when any alternative exists.
 */
export function orderAvoidingBackToBack<T extends { home: TeamSlot; away: TeamSlot }>(matches: T[]): T[] {
  const remaining = [...matches];
  const out: T[] = [];
  let prev: string[] = [];
  while (remaining.length) {
    let idx = remaining.findIndex((m) => !teamsOf(m).some((t) => prev.includes(t)));
    if (idx === -1) idx = 0;
    const [next] = remaining.splice(idx, 1);
    out.push(next!);
    prev = teamsOf(next!);
  }
  return out;
}

export function countBackToBack(matches: { home: TeamSlot; away: TeamSlot }[]): number {
  let n = 0;
  for (let i = 1; i < matches.length; i++) {
    const a = teamsOf(matches[i - 1]!);
    if (teamsOf(matches[i]!).some((t) => a.includes(t))) n++;
  }
  return n;
}

type Draft = Omit<Match, 'id'>;

const draft = (partial: Pick<Draft, 'stage' | 'home' | 'away' | 'format'> & Partial<Draft>): Draft => ({
  groupRound: null,
  groupIndex: null,
  playoffRound: null,
  status: 'SCHEDULED',
  winnerTeamId: null,
  legsWon: { home: 0, away: 0 },
  ...partial,
});

export function buildGroupStageDrafts(teams: Team[], groupCount: number, format: MatchFormat): Draft[] {
  const perGroup: Draft[][][] = [];
  for (let g = 0; g < groupCount; g++) {
    const ids = teams.filter((t) => t.groupIndex === g).map((t) => t.id);
    perGroup.push(
      roundRobinRounds(ids).map((pairs, r) =>
        pairs.map(([h, a]) =>
          draft({
            stage: 'GROUP',
            groupIndex: g,
            groupRound: r + 1,
            home: { kind: 'TEAM', teamId: h },
            away: { kind: 'TEAM', teamId: a },
            format,
          }),
        ),
      ),
    );
  }
  // Interleave: round by round, pair slot by pair slot, group by group.
  const merged: Draft[] = [];
  const maxRounds = Math.max(0, ...perGroup.map((g) => g.length));
  for (let r = 0; r < maxRounds; r++) {
    const maxPairs = Math.max(0, ...perGroup.map((g) => g[r]?.length ?? 0));
    for (let p = 0; p < maxPairs; p++) {
      for (const g of perGroup) {
        const m = g[r]?.[p];
        if (m) merged.push(m);
      }
    }
  }
  return orderAvoidingBackToBack(merged);
}

/** Standard bracket seed order: n=4 -> [1,4,2,3], n=8 -> [1,8,4,5,2,7,3,6]. */
export function bracketSeedOrder(n: number): number[] {
  let order = [1];
  while (order.length < n) {
    const size = order.length * 2;
    order = order.flatMap((s) => [s, size + 1 - s]);
  }
  return order;
}

const ROUND_BY_ENTRANTS: Record<number, PlayoffRound> = { 8: 'QF', 4: 'SF', 2: 'FINAL' };

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Seed slots entering the bracket (index 0 = seed 1). */
export function playoffSeedSlots(structure: StructureSettings, teams: Team[]): (TeamSlot | null)[] {
  if (structure.mode === 'PLAYOFFS_ONLY') {
    const size = nextPowerOfTwo(teams.length);
    return Array.from({ length: size }, (_, i) => {
      const t = teams[i];
      return t ? ({ kind: 'TEAM', teamId: t.id } as TeamSlot) : null; // null = bye
    });
  }
  const size = structure.playoff.bracketSize;
  const slots: TeamSlot[] = [];
  for (let rank = 1; slots.length < size; rank++) {
    for (let g = 0; g < structure.groupCount && slots.length < size; g++) {
      slots.push({ kind: 'GROUP_RANK', groupIndex: g, rank });
    }
  }
  return slots;
}

/**
 * Builds playoff drafts (QF -> SF -> 3rd place -> Final). Byes (null seeds) advance
 * the opponent directly without creating a match. Returns drafts with temporary
 * ids `tmp_N`, rewritten to real match ids by the caller.
 */
export function buildPlayoffDrafts(structure: StructureSettings, teams: Team[]): (Draft & { tmpId: string })[] {
  const seeds = playoffSeedSlots(structure, teams);
  if (seeds.length < 2) return [];
  let entrants: (TeamSlot | null)[] = bracketSeedOrder(seeds.length).map((s) => seeds[s - 1] ?? null);
  const out: (Draft & { tmpId: string })[] = [];
  let tmp = 0;
  let semiIds: string[] = [];

  while (entrants.length >= 2) {
    const round = ROUND_BY_ENTRANTS[entrants.length] ?? 'QF';
    const next: (TeamSlot | null)[] = [];
    const roundIds: string[] = [];
    for (let i = 0; i < entrants.length; i += 2) {
      const a = entrants[i] ?? null;
      const b = entrants[i + 1] ?? null;
      if (a && b) {
        const tmpId = `tmp_${++tmp}`;
        out.push({
          ...draft({ stage: 'PLAYOFF', playoffRound: round, home: a, away: b, format: structure.playoff.formats[round] }),
          tmpId,
        });
        roundIds.push(tmpId);
        next.push({ kind: 'MATCH_WINNER', matchId: tmpId });
      } else {
        next.push(a ?? b);
      }
    }
    if (round === 'SF') semiIds = roundIds;
    if (entrants.length === 2) break;
    entrants = next;
  }

  if (structure.playoff.thirdPlaceMatch && semiIds.length === 2) {
    const final = out.pop()!; // keep the Final last
    out.push({
      ...draft({
        stage: 'PLAYOFF',
        playoffRound: 'THIRD_PLACE',
        home: { kind: 'MATCH_LOSER', matchId: semiIds[0]! },
        away: { kind: 'MATCH_LOSER', matchId: semiIds[1]! },
        format: structure.playoff.formats.THIRD_PLACE,
      }),
      tmpId: `tmp_${++tmp}`,
    });
    out.push(final);
  }
  return out;
}

/** Full schedule with real ids, in play order. */
export function buildSchedule(structure: StructureSettings, teams: Team[]): Match[] {
  const drafts: (Draft & { tmpId?: string })[] = [];
  if (structure.mode !== 'PLAYOFFS_ONLY') {
    drafts.push(...buildGroupStageDrafts(teams, structure.groupCount, structure.groupFormat));
  }
  if (structure.mode !== 'GROUPS_ONLY') drafts.push(...buildPlayoffDrafts(structure, teams));

  const idMap = new Map<string, string>();
  drafts.forEach((d, i) => d.tmpId && idMap.set(d.tmpId, matchId(i + 1)));
  const remap = (s: TeamSlot): TeamSlot =>
    s.kind === 'MATCH_WINNER' || s.kind === 'MATCH_LOSER' ? { ...s, matchId: idMap.get(s.matchId) ?? s.matchId } : s;

  return drafts.map(({ tmpId: _tmpId, ...d }, i) => ({ ...d, id: matchId(i + 1), home: remap(d.home), away: remap(d.away) }));
}
