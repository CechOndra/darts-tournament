/**
 * Per-tab session tokens in sessionStorage (cleared when the tab closes or on
 * "Lock Session"). Every access is guarded: storage can be unavailable.
 */

const HOST_KEY = 'darts.session.host';
const scorerKey = (tournamentId: string) => `darts.session.scorer.${tournamentId}`;

export interface ScorerSession {
  token: string;
  pinVersion: number;
}

function get<T>(key: string): T | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function set(key: string, value: unknown) {
  try {
    if (value === null) globalThis.sessionStorage?.removeItem(key);
    else globalThis.sessionStorage?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: session lives only in memory */
  }
}

export const sessionStore = {
  getHostToken: () => get<string>(HOST_KEY),
  setHostToken: (token: string | null) => set(HOST_KEY, token),
  getScorer: (tournamentId: string) => get<ScorerSession>(scorerKey(tournamentId)),
  setScorer: (tournamentId: string, session: ScorerSession | null) => set(scorerKey(tournamentId), session),
};
