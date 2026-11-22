/**
 * Immutable tournament data model. Every entity is referenced by an immutable id
 * (team_01, player_01a, match_01, card_inst_001) — never by display name — so
 * renaming mid-tournament can never corrupt schedules, stats or standings.
 */

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
  cardTypeId: string;
  pool: 'LOSER' | 'WINNER';
  ownerTeamId: string | null;
  status: 'IN_POOL' | 'IN_HAND' | 'DISCARDED';
}

export interface Team {
  id: string;
  name: string;
  isPlaceholderName: boolean;
  groupIndex: number;
  playerIds: string[];
  hand: CardInstance[];
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

export interface CardSettings {
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

export interface TournamentSettings {
  visibility: VisibilitySettings;
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
  roster: RosterRow[];
}
