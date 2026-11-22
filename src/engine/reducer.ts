import type { EngineAction, RulesPatch } from './actions.ts';
import { cardsReducer, isCardAction } from './cards.ts';
import { isMatchAction, matchReducer } from './matchReducer.ts';
import { createEmptyState, migrateState, type TournamentState } from './state.ts';
import {
  buildTournament,
  playerPlaceholderName,
  restructureTournament,
  teamPlaceholderName,
} from './tournament.ts';
import type { GameRules, Match } from './types.ts';

const MAX_NAME = 40;
const cleanName = (name: string) => name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);

export function mergeRules(rules: GameRules, patch: RulesPatch): GameRules {
  const { specialRules, ...rest } = patch;
  return {
    ...rules,
    ...rest,
    specialRules: {
      doubleCheckoutBonus: { ...rules.specialRules.doubleCheckoutBonus, ...specialRules?.doubleCheckoutBonus },
      tripleCheckoutBonus: { ...rules.specialRules.tripleCheckoutBonus, ...specialRules?.tripleCheckoutBonus },
      visitCap: { ...rules.specialRules.visitCap, ...specialRules?.visitCap },
    },
  };
}

const isMovable = (m: Match | undefined) => !!m && m.status === 'SCHEDULED';

/** Pure reducer: (state, action) -> new state. Never mutates its inputs; invalid actions are no-ops. */
export function tournamentReducer(input: TournamentState, action: EngineAction): TournamentState {
  const state = migrateState(input);
  if (isMatchAction(action)) return matchReducer(state, action);
  if (isCardAction(action)) return cardsReducer(state, action);
  switch (action.type) {
    case 'INITIALIZE':
      return buildTournament(action.setup);

    case 'RENAME_TOURNAMENT': {
      const name = cleanName(action.name);
      if (!state.meta || !name) return state;
      return { ...state, meta: { ...state.meta, name } };
    }

    case 'RENAME_TEAM': {
      const index = state.teams.findIndex((t) => t.id === action.teamId);
      if (index === -1) return state;
      const name = cleanName(action.name);
      const teams = state.teams.map((t, i) =>
        i === index ? { ...t, name: name || teamPlaceholderName(index), isPlaceholderName: !name } : t,
      );
      return { ...state, teams };
    }

    case 'RENAME_PLAYER': {
      const player = state.players[action.playerId];
      if (!player) return state;
      const slot = state.teams.find((t) => t.id === player.teamId)?.playerIds.indexOf(player.id) ?? 0;
      const name = cleanName(action.name);
      return {
        ...state,
        players: {
          ...state.players,
          [player.id]: { ...player, name: name || playerPlaceholderName(Math.max(0, slot)), isPlaceholderName: !name },
        },
      };
    }

    case 'SET_PLAYER_AVATAR': {
      const player = state.players[action.playerId];
      if (!player) return state;
      return { ...state, players: { ...state.players, [player.id]: { ...player, avatarDataUrl: action.avatarDataUrl } } };
    }

    case 'SET_TEAM_LOGO':
      if (!state.teams.some((t) => t.id === action.teamId)) return state;
      return { ...state, teams: state.teams.map((t) => (t.id === action.teamId ? { ...t, logoDataUrl: action.logoDataUrl } : t)) };

    case 'UPDATE_TABLE_SETTINGS':
      return { ...state, settings: { ...state.settings, table: { ...state.settings.table, ...action.patch } } };

    case 'APPLY_ROSTER_NAMES': {
      let next = state;
      action.rows.forEach((row, i) => {
        const team = next.teams[i];
        if (!team) return;
        if (row.teamName.trim()) next = tournamentReducer(next, { type: 'RENAME_TEAM', teamId: team.id, name: row.teamName });
        row.playerNames.forEach((pname, p) => {
          const pid = team.playerIds[p];
          if (pid && pname.trim()) next = tournamentReducer(next, { type: 'RENAME_PLAYER', playerId: pid, name: pname });
        });
      });
      return next;
    }

    case 'UPDATE_VISIBILITY':
      return { ...state, settings: { ...state.settings, visibility: { ...state.settings.visibility, ...action.patch } } };

    case 'UPDATE_RULES':
      return { ...state, settings: { ...state.settings, rules: mergeRules(state.settings.rules, action.patch) } };

    case 'SET_GROUP_FORMAT':
      return {
        ...state,
        settings: { ...state.settings, structure: { ...state.settings.structure, groupFormat: action.format } },
        matches: state.matches.map((m) => (m.stage === 'GROUP' && m.status === 'SCHEDULED' ? { ...m, format: action.format } : m)),
      };

    case 'SET_PLAYOFF_FORMAT': {
      const structure = state.settings.structure;
      return {
        ...state,
        settings: {
          ...state.settings,
          structure: {
            ...structure,
            playoff: { ...structure.playoff, formats: { ...structure.playoff.formats, [action.round]: action.format } },
          },
        },
        matches: state.matches.map((m) =>
          m.playoffRound === action.round && m.status === 'SCHEDULED' ? { ...m, format: action.format } : m,
        ),
      };
    }

    case 'RESTRUCTURE':
      try {
        return restructureTournament(state, action.structure);
      } catch {
        return state;
      }

    case 'MOVE_IN_QUEUE': {
      const byId = new Map(state.matches.map((m) => [m.id, m]));
      const i = state.queue.indexOf(action.matchId);
      const j = i + action.delta;
      if (i === -1 || j < 0 || j >= state.queue.length) return state;
      if (!isMovable(byId.get(state.queue[i]!)) || !isMovable(byId.get(state.queue[j]!))) return state;
      const queue = [...state.queue];
      [queue[i], queue[j]] = [queue[j]!, queue[i]!];
      return { ...state, queue };
    }

    case 'SET_NEXT_MATCH': {
      const byId = new Map(state.matches.map((m) => [m.id, m]));
      if (!state.queue.includes(action.matchId) || !isMovable(byId.get(action.matchId))) return state;
      const rest = state.queue.filter((id) => id !== action.matchId);
      // A match already being played stays at the head.
      const lead = rest.filter((id) => byId.get(id)?.status === 'IN_PROGRESS');
      const others = rest.filter((id) => byId.get(id)?.status !== 'IN_PROGRESS');
      return { ...state, queue: [...lead, action.matchId, ...others] };
    }

    case 'SET_SCORER_DUTY_OVERRIDE':
      return { ...state, scorerDutyOverride: action.value };

    case 'ADD_BREAK': {
      const name = cleanName(action.name) || 'Break';
      if (!state.matches.some((m) => m.id === action.afterMatchId)) return state;
      if (state.breaks.some((b) => b.id === action.id)) return state;
      const durationMinutes =
        action.durationMinutes !== null && Number.isFinite(action.durationMinutes) && action.durationMinutes > 0
          ? Math.round(action.durationMinutes)
          : null;
      return {
        ...state,
        breaks: [...state.breaks, { id: action.id, afterMatchId: action.afterMatchId, name, durationMinutes, completed: false }],
      };
    }

    case 'REMOVE_BREAK':
      return { ...state, breaks: state.breaks.filter((b) => b.id !== action.breakId) };

    case 'SET_PIN_VERSION':
      return action.pinVersion > state.security.pinVersion ? { ...state, security: { pinVersion: action.pinVersion } } : state;

    case 'REPLACE_STATE':
      if (!action.state || typeof action.state.schemaVersion !== 'number' || action.state.schemaVersion < 2) {
        throw new Error(`Unsupported backup schema version ${action.state?.schemaVersion}`);
      }
      return migrateState(structuredClone(action.state));

    case 'RESET_STATE':
      return createEmptyState();

    default:
      return state;
  }
}
