import { describe, expect, it } from 'vitest';
import type { EngineAction } from './actions.ts';
import { CARD_TYPES, type CardRarity, type CardTypeId } from './cardCatalog.ts';
import { cardConfig, cardCost, rarityIn } from './cardConfig.ts';
import { handOf } from './cardPool.ts';
import { checkPlay, drawQuota, energyStatus } from './cards.ts';
import { DEFAULT_RULES, DEFAULT_STRUCTURE } from './defaults.ts';
import { computeMatchView } from './match.ts';
import { tournamentReducer } from './reducer.ts';
import type { Multiplier } from './scoring.ts';
import { upNextMatch } from './selectors.ts';
import { groupStandings } from './standings.ts';
import type { TournamentState } from './state.ts';
import { buildTournament } from './tournament.ts';
import type { CardSettings, Parity } from './types.ts';

let seq = 0;
const run = (s: TournamentState, ...actions: EngineAction[]) => actions.reduce(tournamentReducer, s);
const D = (segment: number, multiplier: Multiplier = 1): EngineAction => ({ type: 'THROW_DART', id: `d${++seq}`, segment, multiplier, at: 1000 + seq });
const MISS = () => D(0, 0);

function make(cards: Partial<CardSettings> = {}, players: 1 | 2 = 2): TournamentState {
  return buildTournament({
    id: 'cards-test',
    name: 'Cards',
    createdAt: 1,
    structure: { ...structuredClone(DEFAULT_STRUCTURE), teamCount: 4, groupCount: 1, mode: 'GROUPS_ONLY', groupFormat: 'BO3', playersPerTeam: players },
    rules: { ...structuredClone(DEFAULT_RULES), startingScore: 501, checkoutMode: 'DOUBLE_OUT' },
    cards: { startingHandSize: 0, maxCardsPlayedPerLeg: 2, maxCardsPlayedPerMatch: 3, ...cards },
    roster: [],
  });
}

/** Start the up-next match with home throwing first. */
function start(s: TournamentState): TournamentState {
  const m = upNextMatch(s)!;
  s = run(s, { type: 'START_MATCH', matchId: m.id, at: 1 });
  return run(s, { type: 'SET_LEG_START', legIndex: 0, firstTeam: 'home', resolvedBy: 'MANUAL' }, { type: 'BEGIN_PLAY' });
}

const ids = (s: TournamentState) => ({ home: s.live!.homeTeamId, away: s.live!.awayTeamId });

function grant(s: TournamentState, teamId: string, card: CardTypeId): { s: TournamentState; instanceId: string } {
  const before = new Set(handOf(s.cards, teamId).map((i) => i.instanceId));
  s = run(s, { type: 'GRANT_CARD', id: `g${++seq}`, teamId, cardTypeId: card, at: 1 });
  const inst = handOf(s.cards, teamId).find((i) => !before.has(i.instanceId));
  if (!inst) throw new Error(`grant failed: ${card}`);
  return { s, instanceId: inst.instanceId };
}

function play(s: TournamentState, teamId: string, card: CardTypeId, extra: { parity?: Parity; roll?: number } = {}): TournamentState {
  const g = grant(s, teamId, card);
  const next = run(g.s, { type: 'PLAY_CARD', id: `p${++seq}`, instanceId: g.instanceId, at: 2, ...extra });
  if (next.cards.plays.length === g.s.cards.plays.length) throw new Error(`play rejected: ${card} (${(checkPlay(g.s, teamId, g.instanceId) as { reason?: string }).reason})`);
  return next;
}

const view = (s: TournamentState) => computeMatchView(s)!;

describe('card pool', () => {
  it('prints the default copies (Common 4, Silver 3, Rare 2, Legendary 1)', () => {
    const s = make();
    expect(CARD_TYPES).toHaveLength(17);
    expect(s.cards.instances).toHaveLength(2 * 4 + 6 * 3 + 4 * 2 + 5 * 1);
    expect(s.cards.instances.every((i) => i.status === 'IN_POOL')).toBe(true);
  });

  it('deals starting hands deterministically', () => {
    const a = make({ startingHandSize: 2 });
    const b = make({ startingHandSize: 2 });
    for (const t of a.teams) expect(handOf(a.cards, t.id)).toHaveLength(2);
    expect(a.cards.instances).toEqual(b.cards.instances);
  });

  it('syncs copies when the admin edits them', () => {
    let s = make();
    s = run(s, { type: 'UPDATE_CARD_SETTINGS', patch: { config: { ...s.settings.cards.config, EXTRA_DART: { ...s.settings.cards.config.EXTRA_DART, copies: 3 } } } });
    expect(s.cards.instances.filter((i) => i.cardTypeId === 'EXTRA_DART')).toHaveLength(3);
    s = run(s, { type: 'UPDATE_CARD_SETTINGS', patch: { config: { ...s.settings.cards.config, EXTRA_DART: { ...s.settings.cards.config.EXTRA_DART, enabled: false } } } });
    expect(s.cards.instances.filter((i) => i.cardTypeId === 'EXTRA_DART')).toHaveLength(0);
  });
});

describe('visit cards', () => {
  it('EXTRA_DART gives 4 darts, STEAL_DART leaves 2', () => {
    let s = start(make());
    const t = ids(s);
    s = play(s, t.home, 'EXTRA_DART');
    expect(view(s).turn!.maxDarts).toBe(4);
    s = run(s, D(20), D(20), D(20));
    expect(view(s).turn!.side).toBe('home');
    s = run(s, D(20));
    expect(view(s).turn!.side).toBe('away');
    expect(view(s).currentLeg.remaining.home).toBe(421);

    s = play(s, t.home, 'STEAL_DART'); // during away's fresh visit -> applies to it
    expect(view(s).turn!.maxDarts).toBe(2);
    s = run(s, D(20), D(20));
    expect(view(s).turn!.side).toBe('home');
  });

  it('DOUBLE_EDGED_SWORD doubles the visit and the opponent dart 1', () => {
    let s = start(make());
    const t = ids(s);
    s = play(s, t.home, 'DOUBLE_EDGED_SWORD');
    s = run(s, D(20, 3), D(20), D(1));
    expect(view(s).currentLeg.remaining.home).toBe(501 - 2 * 81);
    s = run(s, D(20), D(20), D(20));
    expect(view(s).currentLeg.remaining.away).toBe(501 - 40 - 20 - 20);
  });

  it('a boosted dart that would finish busts (unless boosted checkouts are allowed)', () => {
    let s = start(make({}, 1));
    const t = ids(s);
    // home to 40 (501 - 461): 7 visits of 60 (420) + 41
    for (let i = 0; i < 7; i++) s = run(s, D(20), D(20), D(20), MISS(), MISS(), MISS());
    s = run(s, D(20), D(20), D(1), MISS(), MISS(), MISS());
    expect(view(s).currentLeg.remaining.home).toBe(40);
    const armed = play(s, t.home, 'DOUBLE_EDGED_SWORD');
    let busted = run(armed, D(20, 2)); // D20 boosted = 80 -> bust
    expect(view(busted).legsWon.home).toBe(0);
    expect(view(busted).currentLeg.remaining.home).toBe(40);
    busted = run(armed, D(10, 2)); // D10 boosted = 40 would finish -> bust by default
    expect(view(busted).legsWon.home).toBe(0);
    const allowed = run(armed, { type: 'UPDATE_CARD_SETTINGS', patch: { params: { ...armed.settings.cards.params, allowCheckoutOnBoostedDart: true } } }, D(10, 2));
    expect(view(allowed).legsWon.home).toBe(1);
  });

  it('organizer config: disabled cards leave the deck, playoff-only rules, rarity/pool overrides', () => {
    let s = make();
    const cfg = s.settings.cards.config;
    s = run(s, {
      type: 'UPDATE_CARD_SETTINGS',
      patch: { config: { ...cfg, STEAL_DART: { ...cfg.STEAL_DART, enabled: false }, SHOT_CLOCK: { ...cfg.SHOT_CLOCK, rarity: 'LEGENDARY', pool: 'WINNER' } } },
    });
    expect(s.cards.instances.some((i) => i.cardTypeId === 'STEAL_DART')).toBe(false);
    expect(s.cards.instances.filter((i) => i.cardTypeId === 'SHOT_CLOCK').every((i) => i.pool === 'WINNER')).toBe(true);
  });

  it('old saves with the rarity id SILVER read as UNCOMMON', () => {
    const s = make();
    const cfg = s.settings.cards.config;
    const old = { ...s.settings.cards, config: { ...cfg, WEAK_HAND_1DART: { ...cfg.WEAK_HAND_1DART, rarity: 'SILVER' as unknown as CardRarity } } };
    expect(rarityIn(old, 'WEAK_HAND_1DART')).toBe('UNCOMMON');
    expect(cardConfig(old, 'WEAK_HAND_1DART').rarity).toBe('UNCOMMON');
    expect(rarityIn(s.settings.cards, 'WEAK_HAND_1DART')).toBe('UNCOMMON');
  });

  it('card style and pictures are visual only: updating them keeps hands and pool', () => {
    const s = make();
    const next = run(s, { type: 'UPDATE_CARD_SETTINGS', patch: { style: { look: 'flat', colors: {}, opts: {}, back: '#123456' }, images: { SHOT_CLOCK: 'data:image/webp;base64,AAAA' } } });
    expect(next.settings.cards.style?.back).toBe('#123456');
    expect(next.cards.instances).toEqual(s.cards.instances);
    const cleared = run(next, { type: 'UPDATE_CARD_SETTINGS', patch: { style: null, images: {} } });
    expect(cleared.settings.cards.style).toBeNull();
    expect(cleared.settings.cards.images).toEqual({});
  });

  it('matches keep the rules they started with', () => {
    let s = start(make());
    s = run(s, { type: 'UPDATE_RULES', patch: { startingScore: 301 } });
    expect(view(s).currentLeg.remaining.home).toBe(501);
  });

  it('PARITY_LOCK and BOTTOM_HALF zero the wrong darts', () => {
    let s = start(make());
    const t = ids(s);
    s = run(s, MISS(), MISS(), MISS());
    s = run(s, MISS(), MISS(), MISS()); // back to home
    s = play(s, t.away, 'PARITY_LOCK_FULL', { parity: 'EVEN' });
    s = run(s, D(20), D(19), D(25)); // 20 counts, 19 odd, 25 odd
    expect(view(s).currentLeg.remaining.home).toBe(481);
    s = play(s, t.home, 'BOTTOM_HALF_1DART');
    s = run(s, D(20, 3), D(20, 3), D(10));
    expect(view(s).currentLeg.remaining.away).toBe(501 - 60 - 10);
  });

  it('ALL_OR_NOTHING: quota met takes the bonus, missed scores 0', () => {
    let s = start(make());
    const t = ids(s);
    s = play(s, t.home, 'ALL_OR_NOTHING');
    s = run(s, D(20), D(20), D(20)); // 60 >= 50 -> +25
    expect(view(s).currentLeg.remaining.home).toBe(501 - 60 - 25);
    s = play(s, t.away, 'ALL_OR_NOTHING');
    s = run(s, D(20), D(5), D(1)); // 26 < 50 -> 0
    expect(view(s).currentLeg.remaining.away).toBe(501);
    expect(view(s).lastCompletedVisit!.allOrNothing).toBe('MISSED');
  });

  it('TEAMMATE_SWAP makes the other player throw one visit', () => {
    let s = start(make());
    const t = ids(s);
    s = run(s, MISS(), MISS(), MISS());
    const normal = view(s).turn!.playerId;
    s = play(s, t.home, 'TEAMMATE_SWAP');
    expect(view(s).turn!.playerId).not.toBe(normal);
  });

  it('SHOWBOAT_DOUBLE adds +0.5 bonus to standings', () => {
    let s = start(make({}, 1));
    const t = ids(s);
    s = play(s, t.home, 'SHOWBOAT_DOUBLE');
    s = run(s, D(10, 2), MISS(), MISS());
    expect(view(s).stats.home.bonusPoints).toBe(0.5);
  });

  it('one card per visit and per-leg limits are enforced', () => {
    let s = start(make({ maxCardsPlayedPerLeg: 1 }));
    const t = ids(s);
    s = play(s, t.home, 'EXTRA_DART');
    const g = grant(s, t.away, 'STEAL_DART');
    expect(checkPlay(g.s, t.away, g.instanceId).ok).toBe(false); // home visit already carries a card
    const g2 = grant(s, t.home, 'SHOWBOAT_DOUBLE');
    expect(checkPlay(g2.s, t.home, g2.instanceId)).toMatchObject({ ok: false, reason: 'Limit: 1 per leg' });
  });
});

describe('limits: none, max played, energy', () => {
  it('energy mode: default costs follow rarity, admin overrides win', () => {
    const s = make({ limitMode: 'ENERGY' });
    expect(cardCost(s.settings.cards, 'EXTRA_DART')).toBe(3); // Legendary
    expect(cardCost(s.settings.cards, 'MULLIGAN_ANY')).toBe(2); // Rare
    expect(cardCost(s.settings.cards, 'WEAK_HAND_1DART')).toBe(1); // Uncommon
    expect(cardCost(s.settings.cards, 'SHOT_CLOCK')).toBe(1); // Common
    const cfg = s.settings.cards.config;
    const custom = { ...s.settings.cards, config: { ...cfg, SHOT_CLOCK: { ...cfg.SHOT_CLOCK, cost: 4 } } };
    expect(cardCost(custom, 'SHOT_CLOCK')).toBe(4);
  });

  it('energy per leg: a card is refused when it costs more than what is left; the count limits are ignored', () => {
    let s = start(make({ limitMode: 'ENERGY', energyScope: 'LEG', energyAmount: 3, maxCardsPlayedPerLeg: 1, maxCardsPlayedPerMatch: 1 }));
    const t = ids(s);
    s = play(s, t.home, 'EXTRA_DART'); // costs 3 = the whole leg budget
    expect(energyStatus(s.settings.cards, view(s), t.home)).toEqual({ amount: 3, spent: 3, left: 0 });
    const g = grant(s, t.home, 'SHOWBOAT_DOUBLE');
    expect(checkPlay(g.s, t.home, g.instanceId)).toMatchObject({ ok: false, reason: 'Needs 1 energy (0 left)' });
    // the opponent has their own budget
    expect(energyStatus(s.settings.cards, view(s), t.away)).toEqual({ amount: 3, spent: 0, left: 3 });
  });

  it('energy per match: a cheap card passes while energy is left', () => {
    let s = start(make({ limitMode: 'ENERGY', energyScope: 'MATCH', energyAmount: 4 }));
    const t = ids(s);
    s = play(s, t.home, 'EXTRA_DART'); // 3 of 4
    expect(energyStatus(s.settings.cards, view(s), t.home)?.left).toBe(1);
    const g = grant(s, t.home, 'MULLIGAN_ANY'); // costs 2 > 1 left
    expect(checkPlay(g.s, t.home, g.instanceId)).toMatchObject({ ok: false, reason: 'Needs 2 energy (1 left)' });
  });

  it('no limit: neither the count limits nor energy apply', () => {
    let s = start(make({ limitMode: 'NONE', maxCardsPlayedPerLeg: 1, maxCardsPlayedPerMatch: 1 }));
    const t = ids(s);
    s = play(s, t.home, 'EXTRA_DART');
    const g = grant(s, t.home, 'SHOWBOAT_DOUBLE');
    const check = checkPlay(g.s, t.home, g.instanceId);
    expect(check.ok === false && /Limit|energy/i.test(check.reason)).toBe(false);
  });
});

describe('mulligans, first throw, random power, undo', () => {
  it('MULLIGAN voids the last dart; undo is strictly last-in-first-out', () => {
    let s = start(make());
    const t = ids(s);
    s = run(s, D(20), D(1));
    s = play(s, t.home, 'MULLIGAN_ANY');
    expect(view(s).turn!.darts).toHaveLength(1);
    expect(view(s).currentLeg.remaining.home).toBe(481);
    s = run(s, D(20));
    expect(view(s).currentLeg.remaining.home).toBe(461);
    s = run(s, { type: 'UNDO_DART' }); // removes the rethrow
    s = run(s, { type: 'UNDO_DART' }); // un-voids and returns the card
    expect(view(s).currentLeg.remaining.home).toBe(480);
    expect(handOf(s.cards, t.home).some((i) => i.cardTypeId === 'MULLIGAN_ANY')).toBe(true);
  });

  it('MULLIGAN_DART1 only after dart 1, never at 70 or less', () => {
    let s = start(make());
    const t = ids(s);
    s = run(s, D(20), D(20));
    const g = grant(s, t.home, 'MULLIGAN_DART1');
    expect(checkPlay(g.s, t.home, g.instanceId).ok).toBe(false);
  });

  it('FIRST_THROW steals leg 1 and every odd leg', () => {
    let s = make({}, 1);
    const m = upNextMatch(s)!;
    s = run(s, { type: 'START_MATCH', matchId: m.id, at: 1 });
    const t = ids(s);
    s = play(s, t.away, 'FIRST_THROW');
    expect(s.live!.legSetups[0]!.firstTeam).toBe('away');
    s = run(s, { type: 'BEGIN_PLAY' });
    // away wins leg 1 quickly: 9-darter style (T20 x6, T20 T19 D12)
    const leg = [D(20, 3), D(20, 3), D(20, 3), MISS(), MISS(), MISS(), D(20, 3), D(20, 3), D(20, 3), MISS(), MISS(), MISS(), D(20, 3), D(19, 3), D(12, 2)];
    s = run(s, ...leg);
    expect(view(s).legsWon.away).toBe(1);
    expect(s.live!.legSetups[1]!.firstTeam).toBe('home');
    expect(s.live!.legSetups[1]!.resolvedBy).toBe('CARD');
  });

  it('RANDOM_POWER lands on a legal card from the roll', () => {
    let s = start(make());
    const t = ids(s);
    s = play(s, t.away, 'RANDOM_POWER', { roll: 0 }); // home is up: opponent pool, first entry
    const p = s.cards.plays[s.cards.plays.length - 1]!;
    expect(p.effectCardTypeId).toBe('STEAL_DART');
    expect(view(s).turn!.maxDarts).toBe(2);
  });
});

describe('draws', () => {
  // Home 9-darter-ish leg: 180, (away 0), 180, (away 0), 141 out. Fresh ids every call.
  const homeLeg = () => [D(20, 3), D(20, 3), D(20, 3), MISS(), MISS(), MISS(), D(20, 3), D(20, 3), D(20, 3), MISS(), MISS(), MISS(), D(20, 3), D(19, 3), D(12, 2)];
  function finishMatch(s: TournamentState): TournamentState {
    s = start(s);
    s = run(s, ...homeLeg(), { type: 'NEXT_LEG' });
    // leg 2: away starts; home wins again
    return run(s, MISS(), MISS(), MISS(), ...homeLeg());
  }

  it('post-match quota, overflow discard and blocked continue', () => {
    let s = finishMatch(make({ maxHandSize: 1, loserSpinsPerMatch: 2 }));
    expect(s.live!.phase).toBe('POST_MATCH');
    const q = drawQuota(s);
    expect(q.loser!.left).toBe(2);
    const loser = q.loser!.teamId;
    s = run(s, { type: 'DRAW_CARD', id: 'dr1', teamId: loser, kind: 'LOSER', roll: 0.1, at: 5 });
    expect(handOf(s.cards, loser)).toHaveLength(1);
    expect(s.cards.draws[0]!.cardTypeId).toBeTruthy();
    s = run(s, { type: 'DRAW_CARD', id: 'dr2', teamId: loser, kind: 'LOSER', roll: 0.9, at: 6 });
    expect(handOf(s.cards, loser)).toHaveLength(2);
    expect(s.cards.pendingDiscard?.teamId).toBe(loser);
    expect(run(s, { type: 'CONTINUE_TO_NEXT' }).live).not.toBeNull();
    s = run(s, { type: 'RESOLVE_DISCARD', instanceId: handOf(s.cards, loser)[0]!.instanceId });
    expect(handOf(s.cards, loser)).toHaveLength(1);
    expect(drawQuota(s).loser!.left).toBe(0);
    expect(run(s, { type: 'DRAW_CARD', id: 'dr3', teamId: loser, kind: 'LOSER', roll: 0.5, at: 7 }).cards.draws).toHaveLength(2);
    expect(run(s, { type: 'CONTINUE_TO_NEXT' }).live).toBeNull();
  });

  it('tiered pools: loser draws only loser cards, winner only silver', () => {
    let s = finishMatch(make({ winnerSpinsPerMatch: 1 }));
    const q = drawQuota(s);
    s = run(s, { type: 'DRAW_CARD', id: 'w1', teamId: q.winner!.teamId, kind: 'WINNER', roll: 0.5, at: 5 });
    s = run(s, { type: 'DRAW_CARD', id: 'l1', teamId: q.loser!.teamId, kind: 'LOSER', roll: 0.5, at: 6 });
    const [w, l] = s.cards.draws;
    expect(CARD_TYPES.find((c) => c.id === w!.cardTypeId)!.pool).toBe('WINNER');
    expect(CARD_TYPES.find((c) => c.id === l!.cardTypeId)!.pool).toBe('LOSER');
  });

  it('fixed probabilities print new copies when the pool runs dry', () => {
    let s = make({ supplyMode: 'FIXED_PROBABILITIES', maxHandSize: 4 });
    const team = s.teams[0]!.id;
    for (let i = 0; i < 3; i++) s = grant(s, team, 'EXTRA_DART').s;
    expect(s.cards.instances.filter((i) => i.cardTypeId === 'EXTRA_DART')).toHaveLength(3);
  });

  it('standings still compute with cards in the log', () => {
    let s = start(make());
    s = play(s, ids(s).home, 'EXTRA_DART');
    expect(() => groupStandings(s, 0)).not.toThrow();
  });
});
