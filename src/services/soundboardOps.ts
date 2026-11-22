import type { EngineAction } from '../engine/actions.ts';
import type { CrowdSound } from '../engine/soundboard.ts';
import type { TournamentState } from '../engine/state.ts';
import { getClientId } from './transport/ids.ts';
import type { TournamentTransport } from './transport/types.ts';

type AppTransport = TournamentTransport<TournamentState, EngineAction>;

export const CROWD_EVENT = 'CROWD_SOUND';

export interface CrowdSoundEvent {
  sound: CrowdSound;
  clientId: string;
  at: number;
}

/** Guest phone -> stage speakers (broadcast only; nothing is stored). */
export async function sendCrowdSound(transport: AppTransport, sound: CrowdSound): Promise<void> {
  await transport.emitLiveEvent<CrowdSoundEvent>(CROWD_EVENT, { sound, clientId: getClientId(), at: Date.now() });
}
