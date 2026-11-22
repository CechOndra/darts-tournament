import type { EngineAction } from '../engine/actions.ts';
import { createEmptyState, migrateState, STATE_SCHEMA_VERSION, type TournamentState } from '../engine/state.ts';
import { buildTournament } from '../engine/tournament.ts';
import type { TournamentSetup } from '../engine/types.ts';
import type { ControlApi } from './control/types.ts';
import type { StateEnvelope, TournamentTransport } from './transport/types.ts';

type AppTransport = TournamentTransport<TournamentState, EngineAction>;

export const LIVE_EVENTS = {
  SCORER_LOCK: 'SCORER_LOCK',
} as const;

/** Build the initial snapshot from the wizard and register it (with its Scorer PIN). */
export async function createTournamentFromSetup(
  api: ControlApi,
  hostToken: string,
  setup: TournamentSetup,
  scorerPin: string,
  clientId: string,
): Promise<TournamentState> {
  const state = buildTournament(setup);
  await api.createTournament(hostToken, { id: setup.id, name: setup.name, scorerPin, state, clientId });
  return state;
}

/**
 * Rotate the Scorer PIN and kick every scorer: the server revokes sessions, the
 * snapshot's public pinVersion is bumped (persisted immediately) and a lock event
 * is broadcast so open tablets lock without waiting for the next sync.
 */
export async function rotatePinAndKick(
  api: ControlApi,
  transport: AppTransport,
  hostToken: string,
  newPin: string,
): Promise<number> {
  const pinVersion = await api.rotateScorerPin(hostToken, transport.tournamentId, newPin);
  await transport.dispatch({ type: 'SET_PIN_VERSION', pinVersion }, { persist: 'immediate' });
  await transport.emitLiveEvent(LIVE_EVENTS.SCORER_LOCK, { pinVersion });
  return pinVersion;
}

/** True when a scorer that unlocked with `clientPinVersion` must be locked out. */
export function isScorerKickedOut(clientPinVersion: number, state: TournamentState | null | undefined): boolean {
  return !!state && state.security.pinVersion > clientPinVersion;
}

// ------------------------------------------------------------------ backups
export interface BackupFile {
  format: 'darts-tournament-backup';
  formatVersion: 1;
  exportedAt: string;
  tournamentId: string;
  version: number;
  state: TournamentState;
}

export function createBackup(envelope: StateEnvelope<TournamentState>, now = new Date()): BackupFile {
  return {
    format: 'darts-tournament-backup',
    formatVersion: 1,
    exportedAt: now.toISOString(),
    tournamentId: envelope.tournamentId,
    version: envelope.version,
    state: envelope.state,
  };
}

export function backupFileName(backup: BackupFile): string {
  const name = (backup.state.meta?.name ?? backup.tournamentId).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '');
  return `darts-${name || 'tournament'}-${backup.exportedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`;
}

/**
 * Parse an imported backup and re-target it at `targetTournamentId` (so a backup
 * of one tournament can restore into another without clobbering ids).
 */
export function parseBackup(text: string, targetTournamentId: string): TournamentState {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  const file = data as Partial<BackupFile>;
  if (file.format !== 'darts-tournament-backup' || !file.state) throw new Error('This is not a darts tournament backup file.');
  if (typeof file.state.schemaVersion !== 'number' || file.state.schemaVersion < 2 || file.state.schemaVersion > STATE_SCHEMA_VERSION) {
    throw new Error(`Backup uses data version ${file.state.schemaVersion}; this app supports 2 to ${STATE_SCHEMA_VERSION}.`);
  }
  const state = migrateState(file.state);
  const keys = Object.keys(createEmptyState()) as (keyof TournamentState)[];
  const missing = keys.filter((k) => !(k in state));
  if (missing.length) throw new Error(`Backup is missing: ${missing.join(', ')}.`);
  return { ...state, meta: state.meta ? { ...state.meta, id: targetTournamentId } : null };
}
