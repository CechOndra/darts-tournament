import type { TournamentState } from './state.ts';

/** Every state mutation flows through a typed action dispatched via the transport. */
export type EngineAction =
  | { type: 'REPLACE_STATE'; state: TournamentState } // Import Backup (.json)
  | { type: 'RESET_STATE' };
