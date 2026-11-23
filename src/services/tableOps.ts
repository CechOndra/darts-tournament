import type { EngineAction } from '../engine/actions.ts';
import type { TournamentState } from '../engine/state.ts';
import type { ControlApi } from './control/types.ts';
import type { TournamentTransport } from './transport/types.ts';

type AppTransport = TournamentTransport<TournamentState, EngineAction>;

export const HELP_RING_EVENT = 'HELP_RING';

/**
 * One-time admin approval on a shared device: the PIN is checked by the server (same lockout
 * as the PIN login) and the session it opens is closed again immediately, so the tablet
 * never keeps admin rights.
 */
export async function verifyAdminPin(api: ControlApi, pin: string): Promise<void> {
  const token = await api.hostPinLogin(pin);
  await api.logout(token).catch(() => undefined);
}

/** "Call admin": banner on stage + admin until resolved, plus an alert sound. */
export async function callAdmin(transport: AppTransport, matchId: string | null): Promise<void> {
  await transport.dispatch({ type: 'SET_HELP_REQUEST', request: { at: Date.now(), matchId } }, { persist: 'immediate' });
  await ringAdmin(transport);
}

export async function ringAdmin(transport: AppTransport): Promise<void> {
  await transport.emitLiveEvent(HELP_RING_EVENT, { at: Date.now() });
}

export async function resolveHelp(transport: AppTransport): Promise<void> {
  await transport.dispatch({ type: 'SET_HELP_REQUEST', request: null }, { persist: 'immediate' });
}
