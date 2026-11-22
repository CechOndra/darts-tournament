/**
 * Root tournament state (pure data, JSON-serializable).
 * Milestone 1 ships the persistence/sync envelope only; the full immutable
 * data model (teams, players, matches, cards, settings) lands in Milestone 2.
 */
export const STATE_SCHEMA_VERSION = 1;

export interface TournamentState {
  schemaVersion: number;
  /** null until the Admin creates a tournament in /#/admin. */
  meta: {
    name: string;
    createdAt: number;
  } | null;
}

export function createEmptyState(): TournamentState {
  return { schemaVersion: STATE_SCHEMA_VERSION, meta: null };
}
