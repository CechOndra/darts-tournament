import { CARD_BY_ID, CARD_TYPES, isCardTypeId, RANDOM_OPP, RANDOM_OWN, type CardPool, type CardTypeId } from './cardCatalog.ts';
import { cardAllowed, cardCost, energyRule, limitModeOf, oddsWeight, poolIn, type CardStage } from './cardConfig.ts';
import { modsFor } from './cardEffects.ts';
import { giveTo, handOf, newInstance, poolInstances, syncInstances } from './cardPool.ts';
import { computeMatchView, initialLegSetup, type MatchView } from './match.ts';
import { upNextMatch } from './selectors.ts';
import type { TournamentState } from './state.ts';
import type { CardDrawKind, CardPlay, CardSettings, CardsState, Match, Parity, Side } from './types.ts';
import { otherSide } from './types.ts';

/**
 * Power Card rules: legality of plays, draws with overflow, admin transfers.
 * Every random choice comes in on the action (`roll` in [0, 1)) so all devices agree.
 */

export type CardAction =
  | { type: 'PLAY_CARD'; id: string; instanceId: string; parity?: Parity; roll?: number; at: number }
  | { type: 'DRAW_CARD'; id: string; teamId: string; kind: CardDrawKind; pool?: CardPool | 'ANY'; roll: number; at: number }
  | { type: 'RESOLVE_DISCARD'; instanceId: string }
  | { type: 'GRANT_CARD'; id: string; teamId: string; cardTypeId: CardTypeId | 'RANDOM'; roll?: number; at: number }
  | { type: 'TRANSFER_CARD'; instanceId: string; toTeamId: string }
  | { type: 'VOID_CARD'; instanceId: string }
  | { type: 'UPDATE_CARD_SETTINGS'; patch: Partial<CardSettings> };

const CARD_ACTIONS = new Set(['PLAY_CARD', 'DRAW_CARD', 'RESOLVE_DISCARD', 'GRANT_CARD', 'TRANSFER_CARD', 'VOID_CARD', 'UPDATE_CARD_SETTINGS']);
export const isCardAction = (a: { type: string }): a is CardAction => CARD_ACTIONS.has(a.type);

const clampRoll = (r: number | undefined) => (typeof r === 'number' && Number.isFinite(r) ? Math.min(0.999999, Math.max(0, r)) : 0);

// ------------------------------------------------------------------ availability

/** Are cards in play for this match (master toggle + stage scope)? */
export function cardsActiveFor(state: TournamentState, match: Match | null | undefined): boolean {
  const mode = state.settings.cards.mode;
  if (mode === 'OFF' || !match) return false;
  return mode === 'ALL_STAGES' || match.stage === 'GROUP';
}

export const liveMatch = (state: TournamentState) => (state.live ? (state.matches.find((m) => m.id === state.live!.matchId) ?? null) : null);

export function sideOf(view: MatchView, teamId: string): Side | null {
  return view.teamIds.home === teamId ? 'home' : view.teamIds.away === teamId ? 'away' : null;
}

export type PlayCheck =
  | { ok: true; legIndex: number; visitIndex: number; voidedThrowId: string | null; randomPool: CardTypeId[] }
  | { ok: false; reason: string };

const no = (reason: string): PlayCheck => ({ ok: false, reason });

/** Is a visit already targeted by a (non-mulligan) card? One card per visit keeps effects unambiguous. */
function visitTaken(view: MatchView, legIndex: number, visitIndex: number): boolean {
  return modsFor(view.mods, legIndex, visitIndex).plays.length > 0;
}

/** Cards RANDOM_POWER may land on right now for the team playing it. */
export function randomPowerPool(state: TournamentState, view: MatchView, side: Side): CardTypeId[] {
  const turn = view.turn;
  if (!turn) return [];
  const opp = otherSide(side);
  // Only cards the organizer allows at this stage can come out of the roulette.
  const allowed = (c: CardTypeId) => cardAllowed(state.settings.cards, c, view.match.stage);
  if (turn.side === side) {
    return RANDOM_OWN.filter((c) => allowed(c) && (c !== 'ALL_OR_NOTHING' || turn.remaining > 85));
  }
  const oppPlayers = state.teams.find((t) => t.id === view.teamIds[opp])?.playerIds.length ?? 1;
  return RANDOM_OPP.filter((c) => {
    if (!allowed(c)) return false;
    if (c === 'PARITY_LOCK_FULL' || c === 'BOTTOM_HALF_FULL') return turn.remaining > 60;
    if (c === 'TEAMMATE_SWAP') return oppPlayers > 1;
    return true;
  });
}

/** Energy budget of a team in the current match / leg (null when energy mode is off). */
export function energyStatus(settings: CardSettings, view: MatchView, teamId: string): { amount: number; spent: number; left: number } | null {
  if (limitModeOf(settings) !== 'ENERGY') return null;
  const { scope, amount } = energyRule(settings);
  // A pre-match card (First Throw, leg 0) is paid from leg 1's budget.
  const spent = view.plays.filter((p) => p.teamId === teamId && (scope === 'MATCH' || p.legIndex === view.currentLegIndex)).reduce((n, p) => n + cardCost(settings, p.cardTypeId), 0);
  return { amount, spent, left: Math.max(0, amount - spent) };
}

/** Can `teamId` play card `instanceId` right now? Returns the target visit when legal. */
export function checkPlay(state: TournamentState, teamId: string, instanceId: string, view: MatchView | null = computeMatchView(state)): PlayCheck {
  const inst = state.cards.instances.find((i) => i.instanceId === instanceId);
  if (!inst || inst.status !== 'IN_HAND' || inst.ownerTeamId !== teamId) return no('Card not in hand');
  if (!view) return no('No match on the oche');
  if (!cardsActiveFor(state, view.match)) return no('Cards are off for this match');
  if (state.cards.pendingDiscard) return no('A team must discard first');
  const side = sideOf(view, teamId);
  if (!side) return no('Team is not playing');
  const card = CARD_BY_ID[inst.cardTypeId];
  const settings = state.settings.cards;
  if (view.match.stage === 'PLAYOFF' && !cardAllowed(settings, inst.cardTypeId, 'PLAYOFF')) return no('Not allowed in the playoffs');
  const mine = view.plays.filter((p) => p.teamId === teamId);
  const counting = limitModeOf(settings) === 'COUNT';
  if (counting && mine.length >= settings.maxCardsPlayedPerMatch) return no(`Limit: ${settings.maxCardsPlayedPerMatch} per match`);
  const energy = energyStatus(settings, view, teamId);
  if (energy) {
    const cost = cardCost(settings, inst.cardTypeId);
    if (cost > energy.left) return no(`Needs ${cost} energy (${energy.left} left)`);
  }
  const phase = view.live.phase;

  if (card.timing === 'PRE_MATCH') {
    if (phase !== 'PRE_MATCH' && !(phase === 'IN_PROGRESS' && view.currentLegIndex === 0 && view.dartsThrownInLeg === 0)) return no('Only before dart 1 of the match');
    if (view.live.firstThrowCard) return no('First throw already taken');
    return { ok: true, legIndex: 0, visitIndex: -1, voidedThrowId: null, randomPool: [] };
  }

  if (phase !== 'IN_PROGRESS') return no('Only during play');
  const turn = view.turn;
  if (!turn) return no('Leg not running');
  const leg = view.currentLegIndex;
  // Pre-match cards (FIRST_THROW, visitIndex -1) count per match only, not against leg 1.
  if (counting && mine.filter((p) => p.legIndex === leg && p.visitIndex >= 0).length >= settings.maxCardsPlayedPerLeg) return no(`Limit: ${settings.maxCardsPlayedPerLeg} per leg`);
  const opp = otherSide(side);
  const fresh = turn.darts.length === 0 && turn.mods.plays.length === 0 && turn.legIndex === leg;

  if (card.timing === 'MULLIGAN') {
    const matchThrows = state.throws.filter((t) => t.matchId === view.match.id);
    const last = matchThrows[matchThrows.length - 1];
    if (!last || last.teamId !== teamId || last.mulliganed || last.legIndex !== leg) return no('Right after your own dart');
    const visit = view.legs[leg]?.visits.find((v) => v.visitIndex === last.visitIndex);
    if (!visit) return no('Right after your own dart');
    const pos = visit.darts.findIndex((d) => d.id === last.id);
    if (pos === -1) return no('Right after your own dart');
    if (card.id === 'MULLIGAN_DART1' ? pos !== 0 : pos > 2) return no(card.id === 'MULLIGAN_DART1' ? 'Only after dart 1' : 'Only after dart 1, 2 or 3');
    if (visit.bust) return no('Not on a bust');
    if (visit.checkout) return no('Not on a checkout');
    if ((visit.before[pos] ?? 0) <= 70) return no('Needs more than 70 before the dart');
    return { ok: true, legIndex: leg, visitIndex: last.visitIndex, voidedThrowId: last.id, randomPool: [] };
  }

  if (card.timing === 'RANDOM') {
    if (!fresh) return no('Only at the start of a visit');
    const pool = randomPowerPool(state, view, side);
    if (!pool.length) return no('No card is legal right now');
    return { ok: true, legIndex: leg, visitIndex: turn.visitIndex, voidedThrowId: null, randomPool: pool };
  }

  // OWN_VISIT / OPP_VISIT: the current visit if it has not started, else the next visit of the target side.
  const targetSide = card.timing === 'OWN_VISIT' ? side : opp;
  let visitIndex: number;
  if (turn.side === targetSide) {
    if (!fresh) return no(targetSide === side ? 'Play before your visit starts' : 'Play before their visit starts');
    visitIndex = turn.visitIndex;
  } else {
    visitIndex = turn.visitIndex + 1;
  }
  if (visitTaken(view, leg, visitIndex)) return no('A card already targets that visit');

  const targetRemaining = turn.side === targetSide ? turn.remaining : view.currentLeg.remaining[targetSide];
  if (card.id === 'ALL_OR_NOTHING' && targetRemaining <= 85) return no('You need more than 85');
  if ((card.id === 'PARITY_LOCK_FULL' || card.id === 'BOTTOM_HALF_FULL') && targetRemaining <= 60) return no('Opponent needs more than 60');
  if (card.id === 'TEAMMATE_SWAP' && (state.teams.find((t) => t.id === view.teamIds[opp])?.playerIds.length ?? 1) < 2) return no('Opponent has one player');
  return { ok: true, legIndex: leg, visitIndex, voidedThrowId: null, randomPool: [] };
}

// ------------------------------------------------------------------ draws

export interface DrawQuota {
  loser: { teamId: string; left: number } | null;
  winner: { teamId: string; left: number } | null;
}

/** Post-match draws still owed for the live match. */
export function drawQuota(state: TournamentState): DrawQuota {
  const live = state.live;
  const match = liveMatch(state);
  if (!live || live.phase !== 'POST_MATCH' || !match?.winnerTeamId || !cardsActiveFor(state, match)) return { loser: null, winner: null };
  const winnerId = match.winnerTeamId;
  const loserId = live.homeTeamId === winnerId ? live.awayTeamId : live.homeTeamId;
  const used = (kind: CardDrawKind) => state.cards.draws.filter((d) => d.matchId === match.id && d.kind === kind).length;
  const s = state.settings.cards;
  return {
    loser: s.loserSpinsPerMatch > 0 ? { teamId: loserId, left: Math.max(0, s.loserSpinsPerMatch - used('LOSER')) } : null,
    winner: s.winnerSpinsPerMatch > 0 ? { teamId: winnerId, left: Math.max(0, s.winnerSpinsPerMatch - used('WINNER')) } : null,
  };
}

const poolForKind = (state: TournamentState, kind: CardDrawKind, pool?: CardPool | 'ANY'): CardPool | 'ANY' => {
  if (state.settings.cards.poolStructure === 'SHARED_POOL') return 'ANY';
  if (kind === 'LOSER') return 'LOSER';
  if (kind === 'WINNER') return 'WINNER';
  return pool ?? 'ANY';
};

/** Draw odds per card type (for the stage strip and the admin estimator). */
/** Stage the next draw belongs to: the live match, else the next match in the queue. */
export function drawStage(state: TournamentState): CardStage {
  return (liveMatch(state) ?? upNextMatch(state))?.stage ?? 'GROUP';
}

/**
 * Draw odds per card type. Printed deck: the copies still in the pool (cards not allowed at
 * this stage are skipped). Fixed odds: the configured weight (playoffs may have their own).
 */
export function drawWeights(state: TournamentState, pool: CardPool | 'ANY', stage: CardStage = drawStage(state)): { cardTypeId: CardTypeId; weight: number }[] {
  const s = state.settings.cards;
  const types = CARD_TYPES.filter((c) => pool === 'ANY' || poolIn(s, c.id) === pool);
  if (s.supplyMode === 'FIXED_PROBABILITIES') return types.map((c) => ({ cardTypeId: c.id, weight: oddsWeight(s, c.id, stage) })).filter((w) => w.weight > 0);
  const counts = new Map<CardTypeId, number>();
  for (const i of poolInstances(state.cards, pool)) counts.set(i.cardTypeId, (counts.get(i.cardTypeId) ?? 0) + 1);
  return types.map((c) => ({ cardTypeId: c.id, weight: cardAllowed(s, c.id, stage) ? (counts.get(c.id) ?? 0) : 0 })).filter((w) => w.weight > 0);
}

export function canDraw(state: TournamentState, pool: CardPool | 'ANY'): boolean {
  return drawWeights(state, pool).length > 0;
}

/** Pick by weight with a roll in [0, 1). */
export function pickWeighted<T>(items: { item: T; weight: number }[], roll: number): T | null {
  const total = items.reduce((s, i) => s + i.weight, 0);
  if (total <= 0) return null;
  let x = clampRoll(roll) * total;
  for (const i of items) {
    if (x < i.weight) return i.item;
    x -= i.weight;
  }
  return items[items.length - 1]!.item;
}

function receive(state: TournamentState, cards: CardsState, teamId: string, instanceIdToGive: string): CardsState {
  let next = giveTo(cards, instanceIdToGive, teamId);
  if (handOf(next, teamId).length > state.settings.cards.maxHandSize) next = { ...next, pendingDiscard: { teamId, drawnInstanceId: instanceIdToGive } };
  return next;
}

/** Take one instance of a card type out of the pool (FIXED mode prints a new one if none is left). */
function takeFromPool(state: TournamentState, cards: CardsState, cardTypeId: CardTypeId): { cards: CardsState; instanceId: string } | null {
  const existing = cards.instances.find((i) => i.status === 'IN_POOL' && i.cardTypeId === cardTypeId);
  if (existing) return { cards, instanceId: existing.instanceId };
  if (state.settings.cards.supplyMode !== 'FIXED_PROBABILITIES') return null;
  const made = newInstance(cards, cardTypeId, poolIn(state.settings.cards, cardTypeId));
  return { cards: made.cards, instanceId: made.instance.instanceId };
}

// ------------------------------------------------------------------ reducer

export function cardsReducer(state: TournamentState, action: CardAction): TournamentState {
  const cards = state.cards;
  switch (action.type) {
    case 'PLAY_CARD': {
      const inst = cards.instances.find((i) => i.instanceId === action.instanceId);
      if (!inst || !inst.ownerTeamId || cards.plays.some((p) => p.id === action.id)) return state;
      const view = computeMatchView(state);
      const check = checkPlay(state, inst.ownerTeamId, inst.instanceId, view);
      if (!check.ok || !view) return state;
      const card = CARD_BY_ID[inst.cardTypeId];
      let effect: CardTypeId = inst.cardTypeId;
      let parity: Parity | null = card.needsParity ? (action.parity ?? null) : null;
      if (card.needsParity && !parity) return state;
      if (card.timing === 'RANDOM') {
        const roll = clampRoll(action.roll);
        effect = check.randomPool[Math.floor(roll * check.randomPool.length)]!;
        if (CARD_BY_ID[effect].needsParity) parity = Math.floor(roll * 1000) % 2 === 0 ? 'EVEN' : 'ODD';
      }
      const play: CardPlay = {
        id: action.id,
        instanceId: inst.instanceId,
        cardTypeId: inst.cardTypeId,
        effectCardTypeId: effect,
        teamId: inst.ownerTeamId,
        matchId: view.match.id,
        legIndex: check.legIndex,
        visitIndex: check.visitIndex,
        parity,
        voidedThrowId: check.voidedThrowId,
        afterThrowCount: state.throws.filter((t) => t.matchId === view.match.id).length,
        at: action.at,
      };
      // Played cards go back into the physical pool (the instance keeps the owner for history via the play log).
      let next: TournamentState = { ...state, cards: { ...giveTo(cards, inst.instanceId, null), plays: [...cards.plays, play] } };
      if (check.voidedThrowId) {
        next = { ...next, throws: next.throws.map((t) => (t.id === check.voidedThrowId ? { ...t, mulliganed: true } : t)) };
      }
      if (card.timing === 'PRE_MATCH' && next.live) {
        const side = sideOf(view, inst.ownerTeamId)!;
        const legSetups = [...next.live.legSetups];
        const s0 = legSetups[0];
        if (s0) legSetups[0] = { ...s0, firstTeam: side, ruleFirstTeam: side, resolvedBy: 'CARD', decision: null };
        next = { ...next, live: { ...next.live, firstThrowCard: side, legSetups } };
      }
      return next;
    }

    case 'DRAW_CARD': {
      if (cards.pendingDiscard || cards.draws.some((d) => d.id === action.id)) return state;
      if (!state.teams.some((t) => t.id === action.teamId)) return state;
      let matchId: string | null = null;
      if (action.kind !== 'GRANT') {
        const quota = drawQuota(state)[action.kind === 'LOSER' ? 'loser' : 'winner'];
        if (!quota || quota.teamId !== action.teamId || quota.left <= 0) return state;
        matchId = state.live!.matchId;
      } else if (state.settings.cards.mode === 'OFF') return state;
      const pool = poolForKind(state, action.kind, action.pool);
      const typeId = pickWeighted(
        drawWeights(state, pool).map((w) => ({ item: w.cardTypeId, weight: w.weight })),
        action.roll,
      );
      if (!typeId) return state;
      const taken = takeFromPool(state, cards, typeId);
      if (!taken) return state;
      const draw = { id: action.id, teamId: action.teamId, matchId, kind: action.kind, pool, instanceId: taken.instanceId, cardTypeId: typeId, at: action.at };
      return { ...state, cards: { ...receive(state, taken.cards, action.teamId, taken.instanceId), draws: [...taken.cards.draws, draw] } };
    }

    case 'GRANT_CARD': {
      if (cards.pendingDiscard || !state.teams.some((t) => t.id === action.teamId)) return state;
      // RANDOM: any card by the current odds, silently (no stage animation).
      const typeId =
        action.cardTypeId === 'RANDOM'
          ? pickWeighted(drawWeights(state, 'ANY').map((w) => ({ item: w.cardTypeId, weight: w.weight })), action.roll ?? 0)
          : action.cardTypeId;
      if (!typeId || !isCardTypeId(typeId)) return state;
      const taken = takeFromPool(state, cards, typeId);
      if (!taken) return state;
      // Granted cards are logged without a draw animation (kind GRANT, no match).
      return { ...state, cards: receive(state, taken.cards, action.teamId, taken.instanceId) };
    }

    case 'RESOLVE_DISCARD': {
      const pending = cards.pendingDiscard;
      const inst = cards.instances.find((i) => i.instanceId === action.instanceId);
      if (!pending || !inst || inst.ownerTeamId !== pending.teamId || inst.status !== 'IN_HAND') return state;
      return { ...state, cards: { ...giveTo(cards, inst.instanceId, null), pendingDiscard: null } };
    }

    case 'TRANSFER_CARD': {
      const inst = cards.instances.find((i) => i.instanceId === action.instanceId);
      if (cards.pendingDiscard || !inst || inst.status !== 'IN_HAND' || inst.ownerTeamId === action.toTeamId) return state;
      if (!state.teams.some((t) => t.id === action.toTeamId)) return state;
      return { ...state, cards: receive(state, cards, action.toTeamId, inst.instanceId) };
    }

    case 'VOID_CARD': {
      const inst = cards.instances.find((i) => i.instanceId === action.instanceId);
      if (!inst || inst.status !== 'IN_HAND') return state;
      const pendingDiscard = cards.pendingDiscard?.teamId === inst.ownerTeamId ? null : cards.pendingDiscard;
      return { ...state, cards: { ...giveTo(cards, inst.instanceId, null), pendingDiscard } };
    }

    case 'UPDATE_CARD_SETTINGS': {
      const cur = state.settings.cards;
      const settings: CardSettings = {
        ...cur,
        ...action.patch,
        config: { ...cur.config, ...action.patch.config },
        params: { ...cur.params, ...action.patch.params },
      };
      return { ...state, settings: { ...state.settings, cards: settings }, cards: syncInstances(cards, settings) };
    }
  }
}

/** Undo the most recent card play of the live match (returns the card to the team's hand). */
export function undoLastPlay(state: TournamentState, play: CardPlay): TournamentState {
  const inst = state.cards.instances.find((i) => i.instanceId === play.instanceId);
  const cardsBack = inst?.status === 'IN_POOL' ? giveTo(state.cards, play.instanceId, play.teamId) : state.cards;
  let next: TournamentState = {
    ...state,
    cards: { ...cardsBack, plays: state.cards.plays.filter((p) => p.id !== play.id) },
  };
  if (play.voidedThrowId) next = { ...next, throws: next.throws.map((t) => (t.id === play.voidedThrowId ? { ...t, mulliganed: false } : t)) };
  const match = next.live ? next.matches.find((m) => m.id === next.live!.matchId) : null;
  if (play.cardTypeId === 'FIRST_THROW' && next.live && match) {
    // Back to the tournament rule for leg 1.
    const live = { ...next.live, firstThrowCard: null };
    const legSetups = [...live.legSetups];
    legSetups[0] = initialLegSetup(next, match, live, 0, 'RULE');
    next = { ...next, live: { ...live, legSetups } };
  }
  return next;
}

/** Average cards drawn per team per match (admin circulation pill). */
export function circulationEstimate(s: CardSettings): number {
  return (s.loserSpinsPerMatch + s.winnerSpinsPerMatch) / 2;
}
