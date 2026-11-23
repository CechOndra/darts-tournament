import { configsFromCopies } from './cardConfig.ts';
import { emptyCards, syncInstances } from './cardPool.ts';
import { createDefaultSettings, DEFAULT_CARDS, DEFAULT_TABLE, DEFAULT_VISIBILITY } from './defaults.ts';
import type {
  CardsState,
  DartThrow,
  LiveMatch,
  Match,
  Player,
  ScheduledBreak,
  HelpRequest,
  ScorerDutyOverride,
  StageOverlay,
  Team,
  TournamentSettings,
} from './types.ts';

/** Bump when the persisted shape changes incompatibly (backups are checked against it). */
export const STATE_SCHEMA_VERSION = 6;

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
  /** Power Cards: physical pool, hands, plays and draws. */
  cards: CardsState;
  /** Award / FUT card projected on the stage by the admin. */
  stageOverlay?: StageOverlay | null;
  /** "Call admin" from the scorer tablet. */
  helpRequest?: HelpRequest | null;
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
    cards: emptyCards(),
  };
}

/**
 * Upgrade snapshots written by older versions.
 * v2 -> v3 adds live match fields; v3 -> v4 adds table settings, new visibility flags and team logos;
 * v4 -> v5 adds the Power Card pool (hands move from Team.hand to cards.instances);
 * v5 -> v6 replaces card copies with per-card configs (rarity, pool, playoffs).
 */
export function migrateState(state: TournamentState): TournamentState {
  if (state.schemaVersion === STATE_SCHEMA_VERSION && 'live' in state && state.settings?.table && state.cards && state.settings.cards?.config) return state;
  if (state.schemaVersion > STATE_SCHEMA_VERSION) throw new Error(`State version ${state.schemaVersion} is newer than this app`);
  const legacy = state.settings.cards as (typeof state.settings.cards & { copies?: Record<string, number> }) | undefined;
  const { copies: legacyCopies, ...restCards } = legacy ?? {};
  const cardSettings = {
    ...DEFAULT_CARDS,
    ...restCards,
    config: { ...(legacy?.config ?? configsFromCopies(legacyCopies)) },
    params: { ...DEFAULT_CARDS.params, ...legacy?.params },
  };
  return {
    ...state,
    schemaVersion: STATE_SCHEMA_VERSION,
    settings: {
      ...state.settings,
      visibility: { ...DEFAULT_VISIBILITY, ...state.settings.visibility },
      table: { ...DEFAULT_TABLE, ...state.settings.table },
      cards: cardSettings,
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    teams: state.teams.map(({ hand: _legacyHand, ...t }: TournamentState['teams'][number] & { hand?: unknown }) => ({ ...t, logoDataUrl: t.logoDataUrl ?? null })),
    cards: state.cards ?? syncInstances(emptyCards(), cardSettings),
    live: state.live ?? null,
    completedOrder: state.completedOrder ?? [],
    throws: state.throws ?? [],
  };
}
