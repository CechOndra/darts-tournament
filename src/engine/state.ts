import { createDefaultSettings, DEFAULT_TABLE, DEFAULT_VISIBILITY } from './defaults.ts';
import type {
  DartThrow,
  LiveMatch,
  Match,
  Player,
  ScheduledBreak,
  ScorerDutyOverride,
  Team,
  TournamentSettings,
} from './types.ts';

/** Bump when the persisted shape changes incompatibly (backups are checked against it). */
export const STATE_SCHEMA_VERSION = 4;

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
  /** The match currently on the oche (null = UP_NEXT lobby). */
  live: LiveMatch | null;
  /** Completed match ids in completion order ("loser scores next" duty). */
  completedOrder: string[];
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
    live: null,
    completedOrder: [],
  };
}

/**
 * Upgrade snapshots written by older versions.
 * v2 -> v3 adds live match fields; v3 -> v4 adds table settings, new visibility flags and team logos.
 */
export function migrateState(state: TournamentState): TournamentState {
  if (state.schemaVersion === STATE_SCHEMA_VERSION && 'live' in state && state.settings?.table) return state;
  if (state.schemaVersion > STATE_SCHEMA_VERSION) throw new Error(`State version ${state.schemaVersion} is newer than this app`);
  return {
    ...state,
    schemaVersion: STATE_SCHEMA_VERSION,
    settings: {
      ...state.settings,
      visibility: { ...DEFAULT_VISIBILITY, ...state.settings.visibility },
      table: { ...DEFAULT_TABLE, ...state.settings.table },
    },
    teams: state.teams.map((t) => ({ ...t, logoDataUrl: t.logoDataUrl ?? null })),
    live: state.live ?? null,
    completedOrder: state.completedOrder ?? [],
    throws: state.throws ?? [],
  };
}
