import type { EngineAction } from './actions.ts';
import { createEmptyState, STATE_SCHEMA_VERSION, type TournamentState } from './state.ts';

/** Pure reducer: (state, action) -> new state. Never mutates its inputs. */
export function tournamentReducer(_state: TournamentState, action: EngineAction): TournamentState {
  switch (action.type) {
    case 'REPLACE_STATE':
      if (action.state.schemaVersion !== STATE_SCHEMA_VERSION) {
        throw new Error(
          `Unsupported backup schema version ${action.state.schemaVersion} (expected ${STATE_SCHEMA_VERSION})`,
        );
      }
      return structuredClone(action.state);
    case 'RESET_STATE':
      return createEmptyState();
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
