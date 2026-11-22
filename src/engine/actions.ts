import type { TournamentState } from './state.ts';
import type {
  GameRules,
  MatchFormat,
  PlayoffRound,
  RosterRow,
  ScorerDutyOverride,
  SpecialRules,
  StructureSettings,
  TournamentSetup,
  VisibilitySettings,
} from './types.ts';

export type RulesPatch = Partial<Omit<GameRules, 'specialRules'>> & {
  specialRules?: { [K in keyof SpecialRules]?: Partial<SpecialRules[K]> };
};

/** Every state mutation flows through a typed action dispatched via the transport. */
export type EngineAction =
  | { type: 'INITIALIZE'; setup: TournamentSetup }
  | { type: 'RENAME_TOURNAMENT'; name: string }
  | { type: 'RENAME_TEAM'; teamId: string; name: string }
  | { type: 'RENAME_PLAYER'; playerId: string; name: string }
  | { type: 'SET_PLAYER_AVATAR'; playerId: string; avatarDataUrl: string | null }
  | { type: 'APPLY_ROSTER_NAMES'; rows: RosterRow[] }
  | { type: 'UPDATE_VISIBILITY'; patch: Partial<VisibilitySettings> }
  | { type: 'UPDATE_RULES'; patch: RulesPatch }
  | { type: 'SET_GROUP_FORMAT'; format: MatchFormat }
  | { type: 'SET_PLAYOFF_FORMAT'; round: PlayoffRound; format: MatchFormat }
  | { type: 'RESTRUCTURE'; structure: StructureSettings }
  | { type: 'MOVE_IN_QUEUE'; matchId: string; delta: -1 | 1 }
  | { type: 'SET_NEXT_MATCH'; matchId: string }
  | { type: 'SET_SCORER_DUTY_OVERRIDE'; value: ScorerDutyOverride }
  | { type: 'ADD_BREAK'; id: string; afterMatchId: string; name: string; durationMinutes: number | null }
  | { type: 'REMOVE_BREAK'; breakId: string }
  | { type: 'SET_PIN_VERSION'; pinVersion: number }
  | { type: 'REPLACE_STATE'; state: TournamentState } // Import Backup (.json)
  | { type: 'RESET_STATE' };
