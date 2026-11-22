import { createDefaultSettings } from './defaults.ts';
import type {
  DartThrow,
  Match,
  Player,
  ScheduledBreak,
  ScorerDutyOverride,
  Team,
  TournamentSettings,
} from './types.ts';

/** Bump when the persisted shape changes incompatibly (backups are checked against it). */
export const STATE_SCHEMA_VERSION = 2;

/** Root tournament state (pure, JSON-serializable, never mutated in place). */
export interface TournamentState {
  schemaVersion: number;
  /** null until the tournament is initialized from the setup wizard. */
  meta: { id: string; name: string; createdAt: number } | null;
  settings: TournamentSettings;
  /** Ordered by seed (index 0 = seed 1). */
  teams: Team[];
  players: Record<string, Player>;
  matches: Match[];
  /** Unplayed match ids in play order (head = next match). */
  queue: string[];
  breaks: ScheduledBreak[];
  scorerDutyOverride: ScorerDutyOverride;
  /** Public mirror of the server-side scorer PIN version (kickout signal). */
  security: { pinVersion: number };
  throws: DartThrow[];
}

export function createEmptyState(): TournamentState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    meta: null,
    settings: createDefaultSettings(),
    teams: [],
    players: {},
    matches: [],
    queue: [],
    breaks: [],
    scorerDutyOverride: null,
    security: { pinVersion: 1 },
    throws: [],
  };
}
