import type { TransportMode, Unsubscribe } from '../transport/types.ts';

export interface TournamentSummary {
  id: string;
  name: string;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SessionInfo {
  valid: boolean;
  role?: 'admin' | 'scorer';
  pinVersion?: number | null;
}

export interface CreateTournamentInput {
  id: string;
  name: string;
  scorerPin: string;
  state: unknown;
  clientId: string;
}

/**
 * Host account, tournament directory and Scorer PIN operations. Mirrors the
 * SECURITY DEFINER RPCs in supabase/schema.sql; every backend implements it.
 */
export interface ControlApi {
  readonly mode: TransportMode;

  hostStatus(): Promise<{ claimed: boolean }>;
  claimHost(username: string, password: string): Promise<string>;
  hostLogin(username: string, password: string): Promise<string>;
  updateHostCredentials(token: string, username: string, password: string): Promise<void>;
  logout(token: string): Promise<void>;
  /** tournamentId null => validate a host session. */
  validateSession(token: string, tournamentId: string | null): Promise<SessionInfo>;

  listTournaments(): Promise<TournamentSummary[]>;
  getActiveTournamentId(): Promise<string | null>;
  subscribeActiveTournament(cb: (id: string | null) => void): Unsubscribe;

  createTournament(token: string, input: CreateTournamentInput): Promise<void>;
  updateTournamentMeta(token: string, id: string, patch: { name?: string; archived?: boolean }): Promise<void>;
  setActiveTournament(token: string, id: string | null): Promise<void>;
  deleteTournament(token: string, id: string): Promise<void>;

  scorerLogin(tournamentId: string, pin: string): Promise<{ token: string; pinVersion: number }>;
  rotateScorerPin(token: string, tournamentId: string, newPin: string): Promise<number>;
}

/** Error codes raised by the backends (same strings as the SQL exceptions). */
export type ControlErrorCode =
  | 'host_already_claimed'
  | 'invalid_username'
  | 'weak_password'
  | 'invalid_credentials'
  | 'invalid_credentials_format'
  | 'unauthorized'
  | 'tournament_exists'
  | 'invalid_pin'
  | 'not_found'
  | 'network';

export class ControlError extends Error {
  constructor(
    readonly code: ControlErrorCode | string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'ControlError';
  }
}

const KNOWN: ControlErrorCode[] = [
  'host_already_claimed',
  'invalid_username',
  'weak_password',
  'invalid_credentials_format',
  'invalid_credentials',
  'unauthorized',
  'tournament_exists',
  'invalid_pin',
  'not_found',
];

/** Extract a known code from any backend error message. */
export function toControlError(err: unknown): ControlError {
  if (err instanceof ControlError) return err;
  const message = err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err);
  const code = KNOWN.find((k) => message.includes(k));
  return new ControlError(code ?? (/fetch|network|timed out/i.test(message) ? 'network' : 'unknown'), message);
}

const FRIENDLY: Record<string, string> = {
  host_already_claimed: 'A host account already exists. Log in instead.',
  invalid_username: 'Username must be at least 3 characters.',
  weak_password: 'Password must be at least 6 characters.',
  invalid_credentials: 'Wrong username or password.',
  invalid_credentials_format: 'Username needs 3+ characters and password 6+ characters.',
  unauthorized: 'Your session expired. Please log in again.',
  tournament_exists: 'A tournament with this id already exists.',
  invalid_pin: 'Wrong PIN.',
  not_found: 'Tournament not found.',
  network: 'Network problem — check your connection and try again.',
};

export function describeControlError(err: unknown): string {
  const e = toControlError(err);
  return FRIENDLY[e.code] ?? e.message;
}
