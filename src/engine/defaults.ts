import { defaultCardConfigs } from './cardConfig.ts';
import type {
  CardParams,
  CardSettings,
  GameRules,
  StructureSettings,
  TableSettings,
  TournamentSettings,
  VisibilitySettings,
} from './types.ts';

export const DEFAULT_VISIBILITY: VisibilitySettings = {
  showBasicStats: true,
  showMatchEtas: true,
  showAwardsPreview: false,
  showPlayerFutCards: false,
  statsScope: 'ALL_MATCHES',
  includeCardAffectedThrows: false,
  stageVisitHistory: true,
  showBreaksToGuests: true,
};

export const DEFAULT_TABLE: TableSettings = {
  dutyRule: 'LOSER_SCORES_NEXT',
  defaultKeypad: 'STACKED_ROWS',
};

export const DEFAULT_STRUCTURE: StructureSettings = {
  teamCount: 8,
  playersPerTeam: 2,
  mode: 'GROUPS_AND_PLAYOFFS',
  groupCount: 2,
  groupFormat: 'BO1',
  playoff: {
    bracketSize: 4,
    thirdPlaceMatch: false,
    formats: { QF: 'BO3', SF: 'BO3', THIRD_PLACE: 'BO1', FINAL: 'BO5' },
  },
};

export const DEFAULT_RULES: GameRules = {
  startingScore: 301,
  checkoutMode: 'DOUBLE_OUT',
  firstThrowRule: 'LOWER_SEED_FIRST',
  firstThrowTiebreak: 'VIRTUAL_COIN_TOSS',
  specialRules: {
    doubleCheckoutBonus: { enabled: false, points: 1 },
    tripleCheckoutBonus: { enabled: false, points: 1 },
    visitCap: { enabled: false, maxVisits: 20 },
  },
};

export const DEFAULT_CARD_PARAMS: CardParams = {
  allOrNothingQuota: 50,
  allOrNothingBonus: 25,
  showboatBonus: 0.5,
  shotClockSeconds: 10,
  caseOpeningSeconds: 5.5,
  wheelSeconds: 5.5,
  randomPowerSeconds: 3.5,
  revealSeconds: 3.8,
  allowCheckoutOnBoostedDart: false,
};

export const DEFAULT_CARDS: CardSettings = {
  config: defaultCardConfigs(),
  params: DEFAULT_CARD_PARAMS,
  mode: 'ALL_STAGES',
  drawAnimationStyle: 'CS2_CASE_OPENING',
  startingHandSize: 1,
  loserSpinsPerMatch: 1,
  winnerSpinsPerMatch: 0,
  maxHandSize: 3,
  maxCardsPlayedPerMatch: 2,
  maxCardsPlayedPerLeg: 1,
  expireHandsBeforePlayoffs: false,
  poolStructure: 'TIERED_POOLS',
  supplyMode: 'FINITE_PHYSICAL_POOL',
};

export function createDefaultSettings(): TournamentSettings {
  return structuredClone({
    visibility: DEFAULT_VISIBILITY,
    table: DEFAULT_TABLE,
    structure: DEFAULT_STRUCTURE,
    rules: DEFAULT_RULES,
    cards: DEFAULT_CARDS,
    futCardAttributes: ['AVG', 'PWR', 'STR', 'ACC', 'CON', 'FIN'],
  });
}

export const LIMITS = {
  teamCount: { min: 4, max: 16 },
  groupCount: { min: 1, max: 4 },
  playersPerTeam: [1, 2, 3] as const,
} as const;
