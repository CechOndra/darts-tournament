/**
 * Immutable tournament data model. Every entity is referenced by an immutable id
 * (team_01, player_01a, match_01, card_inst_001) — never by display name — so
 * renaming mid-tournament can never corrupt schedules, stats or standings.
 */

import type { CardPool, CardRarity, CardTypeId } from './cardCatalog.ts';

// ------------------------------------------------------------------ enums
export type MatchFormat = 'BO1' | 'BO3' | 'BO5' | 'BO7';
export const MATCH_FORMATS: MatchFormat[] = ['BO1', 'BO3', 'BO5', 'BO7'];

export type TournamentMode = 'GROUPS_AND_PLAYOFFS' | 'GROUPS_ONLY' | 'PLAYOFFS_ONLY';
export type PlayoffRound = 'QF' | 'SF' | 'THIRD_PLACE' | 'FINAL';
export const PLAYOFF_ROUNDS: PlayoffRound[] = ['QF', 'SF', 'THIRD_PLACE', 'FINAL'];
export type BracketSize = 2 | 4 | 8;

export type StartingScore = 301 | 501;
export type CheckoutMode = 'STRAIGHT_OUT' | 'DOUBLE_OUT' | 'MASTER_OUT' | 'HYBRID_SUB_50';
export type FirstThrowRule =
  | 'LOWER_SEED_FIRST'
  | 'CLOSEST_TO_BULL_1P'
  | 'CLOSEST_TO_BULL_2P'
  | 'HIGH_SCORE_2DART_SHOOTOUT'
  | 'VIRTUAL_COIN_TOSS'
  | 'MANUAL_CHOICE';
export type FirstThrowTiebreak =
  | 'VIRTUAL_COIN_TOSS'
  | 'CLOSEST_TO_BULL_1P'
  | 'CLOSEST_TO_BULL_2P'
  | 'HIGH_SCORE_2DART_SHOOTOUT'
  | 'SCHEDULE_HOME_TEAM';

export type StatsScope = 'ALL_MATCHES' | 'GROUP_STAGE_ONLY';
export type StatCode = 'AVG' | 'PWR' | 'STR' | 'ACC' | 'CON' | 'FIN' | 'DBL' | 'OPN' | 'CLU';

export type CardsMode = 'OFF' | 'GROUP_STAGE_ONLY' | 'ALL_STAGES';
export type CardDrawAnimationStyle = 'CS2_CASE_OPENING' | 'SPIN_WHEEL';
export type PoolStructure = 'SHARED_POOL' | 'TIERED_POOLS';
export type SupplyMode = 'FINITE_PHYSICAL_POOL' | 'FIXED_PROBABILITIES';

// ------------------------------------------------------------------ entities
export interface CardInstance {
  instanceId: string;
  cardTypeId: CardTypeId;
  pool: CardPool;
  ownerTeamId: string | null;
  status: 'IN_POOL' | 'IN_HAND' | 'DISCARDED';
}

export type Parity = 'EVEN' | 'ODD';

/** A card played during a match (the replay applies its effect to the target visit). */
export interface CardPlay {
  id: string;
  instanceId: string;
  cardTypeId: CardTypeId;
  /** The effect that actually applies (RANDOM_POWER resolves to another card). */
  effectCardTypeId: CardTypeId;
  teamId: string;
  matchId: string;
  /** Target leg / visit (FIRST_THROW: leg 0, visit -1; mulligans: the voided dart's visit). */
  legIndex: number;
  visitIndex: number;
  parity: Parity | null;
  voidedThrowId: string | null;
  /** Throws logged in this match when the card was played (strict undo order). */
  afterThrowCount: number;
  at: number;
}

export type CardDrawKind = 'LOSER' | 'WINNER' | 'GRANT';

export interface CardDraw {
  id: string;
  teamId: string;
  matchId: string | null;
  kind: CardDrawKind;
  /** Pool the draw came from (for the stage strip / wheel). */
  pool?: CardPool | 'ANY';
  instanceId: string;
  cardTypeId: CardTypeId;
  at: number;
}

export interface CardsState {
  instances: CardInstance[];
  plays: CardPlay[];
  draws: CardDraw[];
  /** A team holding more than maxHandSize must discard one before play continues. */
  pendingDiscard: { teamId: string; drawnInstanceId: string } | null;
  nextInstanceSeq: number;
  handsExpired: boolean;
}

export interface Team {
  id: string;
  name: string;
  isPlaceholderName: boolean;
  groupIndex: number;
  playerIds: string[];
  /** Optional team logo (compressed square WebP/JPEG data URL). */
  logoDataUrl: string | null;
}

export interface Player {
  id: string;
  teamId: string;
  name: string;
  isPlaceholderName: boolean;
  avatarDataUrl: string | null;
}

export interface DartThrow {
  id: string;
  matchId: string;
  legIndex: number;
  visitIndex: number;
  dartIndex: 1 | 2 | 3 | 4;
  teamId: string;
  playerId: string;
  /** 0 (Miss), 1..20, 25 (Outer Bull), 50 (Bullseye) */
  segment: number;
  /** 0 Miss, 1 Single/25/50, 2 Double, 3 Triple */
  multiplier: 0 | 1 | 2 | 3;
  rawPoints: number;
  effectivePoints: number;
  mulliganed: boolean;
  isCheckoutDart: boolean;
  checkoutType: 'NONE' | 'SINGLE' | 'DOUBLE' | 'TRIPLE' | 'BULL';
  activeCardId: string | null;
  timestamp: number;
}

/** Where a match participant comes from (resolved as results come in). */
export type TeamSlot =
  | { kind: 'TEAM'; teamId: string }
  | { kind: 'GROUP_RANK'; groupIndex: number; rank: number }
  | { kind: 'SEED'; seed: number }
  | { kind: 'MATCH_WINNER'; matchId: string }
  | { kind: 'MATCH_LOSER'; matchId: string };

export type MatchStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';

export interface Match {
  id: string;
  stage: 'GROUP' | 'PLAYOFF';
  /** Group-stage round number (1-based); null for playoffs. */
  groupRound: number | null;
  groupIndex: number | null;
  playoffRound: PlayoffRound | null;
  home: TeamSlot;
  away: TeamSlot;
  format: MatchFormat;
  status: MatchStatus;
  /** Rules frozen when the match started (later rule edits never rewrite played matches). */
  rules?: GameRules;
  winnerTeamId: string | null;
  legsWon: { home: number; away: number };
}

export interface ScheduledBreak {
  id: string;
  /** Break happens after this match completes. */
  afterMatchId: string;
  name: string;
  durationMinutes: number | null;
  completed: boolean;
}

// ------------------------------------------------------------------ settings
export interface VisibilitySettings {
  showBasicStats: boolean;
  showMatchEtas: boolean;
  showAwardsPreview: boolean;
  showPlayerFutCards: boolean;
  statsScope: StatsScope;
  includeCardAffectedThrows: boolean;
  /** Stage: list every visit of the current leg under each team. */
  stageVisitHistory: boolean;
  /** Guest phones: show scheduled breaks in the schedule. */
  showBreaksToGuests: boolean;
}

export interface StructureSettings {
  teamCount: number; // 4–16
  playersPerTeam: 1 | 2 | 3;
  mode: TournamentMode;
  groupCount: number; // 1–4
  groupFormat: MatchFormat;
  playoff: {
    bracketSize: BracketSize;
    thirdPlaceMatch: boolean;
    formats: Record<PlayoffRound, MatchFormat>;
  };
}

export interface SpecialRules {
  doubleCheckoutBonus: { enabled: boolean; points: number };
  tripleCheckoutBonus: { enabled: boolean; points: number };
  visitCap: { enabled: boolean; maxVisits: number };
}

export interface GameRules {
  startingScore: StartingScore;
  checkoutMode: CheckoutMode;
  firstThrowRule: FirstThrowRule;
  firstThrowTiebreak: FirstThrowTiebreak;
  specialRules: SpecialRules;
}

export interface CardParams {
  allOrNothingQuota: number;
  allOrNothingBonus: number;
  showboatBonus: number;
  shotClockSeconds: number;
  /** Case opening / wheel length on the stage. */
  drawAnimationSeconds: number;
  /** DOUBLE_EDGED_SWORD: may a boosted dart finish the leg? (Default: no, it busts.) */
  allowCheckoutOnBoostedDart: boolean;
}

/** Organizer tuning per card. */
export interface CardTypeConfig {
  enabled: boolean;
  rarity: CardRarity;
  pool: CardPool;
  /** Printed copies (physical deck) or relative odds (fixed odds). */
  copies: number;
  /** Allowed in playoff matches. */
  playoffs: boolean;
  /** Fixed odds only: a different weight for playoff draws (null = same as groups). */
  playoffCopies: number | null;
}

export interface CardSettings {
  config: Record<CardTypeId, CardTypeConfig>;
  params: CardParams;
  mode: CardsMode;
  drawAnimationStyle: CardDrawAnimationStyle;
  startingHandSize: number;
  loserSpinsPerMatch: number;
  winnerSpinsPerMatch: number;
  maxHandSize: number;
  maxCardsPlayedPerMatch: number;
  maxCardsPlayedPerLeg: number;
  expireHandsBeforePlayoffs: boolean;
  poolStructure: PoolStructure;
  supplyMode: SupplyMode;
}

/** Scorer tablet keypad layouts (tournament default; each tablet may override locally). */
export type KeypadLayout = 'ROWS_BY_TEN' | 'STACKED_ROWS' | 'COLUMNS' | 'MODIFIER';
export const KEYPAD_LAYOUTS: KeypadLayout[] = ['MODIFIER', 'STACKED_ROWS', 'COLUMNS', 'ROWS_BY_TEN'];

/** Who keeps score for the next match (the Admin override still wins). */
export type ScorerDutyRule = 'LOSER_SCORES_NEXT' | 'WINNER_SCORES_NEXT' | 'ON_DECK_TEAM' | 'ADMIN_ALWAYS';
export const SCORER_DUTY_RULES: ScorerDutyRule[] = ['LOSER_SCORES_NEXT', 'WINNER_SCORES_NEXT', 'ON_DECK_TEAM', 'ADMIN_ALWAYS'];

export interface TableSettings {
  dutyRule: ScorerDutyRule;
  defaultKeypad: KeypadLayout;
}

export interface TournamentSettings {
  visibility: VisibilitySettings;
  table: TableSettings;
  structure: StructureSettings;
  rules: GameRules;
  cards: CardSettings;
  futCardAttributes: [StatCode, StatCode, StatCode, StatCode, StatCode, StatCode];
}

/** 'ADMIN' = host scores, teamId = that team scores, null = automatic "loser scores next". */
export type ScorerDutyOverride = 'ADMIN' | string | null;

export interface RosterRow {
  teamName: string;
  playerNames: string[];
}

/** Everything the Admin enters in the setup wizard. */
export interface TournamentSetup {
  id: string;
  name: string;
  createdAt: number;
  structure: StructureSettings;
  rules: GameRules;
  visibility?: Partial<VisibilitySettings>;
  table?: Partial<TableSettings>;
  cards?: Partial<CardSettings>;
  roster: RosterRow[];
}

// ------------------------------------------------------------------ live match (Milestone 3)
export type Side = 'home' | 'away';
export const otherSide = (s: Side): Side => (s === 'home' ? 'away' : 'home');

/** Who throws first in a leg (decided by rule, alternation, decider re-run or manual override). */
export interface LegSetup {
  /** null while a decision (coin toss / bull-up / shootout / manual) is pending. */
  firstTeam: Side | null;
  /** Index into each team's playerIds of the player who throws that team's first visit. */
  firstPlayer: { home: number; away: number };
  /** What the tournament rule / alternation decided (for the override warning). */
  ruleFirstTeam: Side | null;
  ruleFirstPlayer: { home: number; away: number };
  method: 'RULE' | 'ALTERNATE' | 'DECIDER';
  /** Decision the tablet must run while firstTeam is null (or that was run). */
  decision: LegDecision | null;
  /** How the starting team was determined (shown on stage). */
  resolvedBy: 'AUTO' | 'COIN_TOSS' | 'BULL_UP' | 'SHOOTOUT' | 'MANUAL' | 'CARD' | null;
}

export type LegDecision = 'VIRTUAL_COIN_TOSS' | 'CLOSEST_TO_BULL_1P' | 'CLOSEST_TO_BULL_2P' | 'HIGH_SCORE_2DART_SHOOTOUT' | 'MANUAL_CHOICE';

export type LivePhase = 'PRE_MATCH' | 'IN_PROGRESS' | 'POST_MATCH';

export interface LiveMatch {
  matchId: string;
  phase: LivePhase;
  homeTeamId: string;
  awayTeamId: string;
  startedAt: number;
  completedAt: number | null;
  legSetups: LegSetup[];
  /** Side that played FIRST_THROW (throws first in every odd leg). */
  firstThrowCard?: Side | null;
}
