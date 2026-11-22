import type { MatchView } from './match.ts';
import type { TournamentState } from './state.ts';

/** Crowd soundboard rules (spec 6): 6 sounds, throw-window lock, cooldowns, master mute. */

export type CrowdSound = 'AIRHORN' | 'APPLAUSE' | 'DRUMROLL' | 'OOOH' | 'BOO' | 'FANFARE';
export const CROWD_SOUNDS: { id: CrowdSound; label: string }[] = [
  { id: 'AIRHORN', label: 'Air Horn' },
  { id: 'APPLAUSE', label: 'Applause' },
  { id: 'DRUMROLL', label: 'Drum Roll' },
  { id: 'OOOH', label: 'Ooooh' },
  { id: 'BOO', label: 'Boo' },
  { id: 'FANFARE', label: 'Fanfare' },
];

export const PHONE_COOLDOWN_MS = 20_000;
export const GLOBAL_COOLDOWN_MS = 4_000;

/** Why the soundboard is locked right now (null = open). */
export function soundboardLock(state: TournamentState, view: MatchView | null): string | null {
  if (state.settings.visibility.soundboardEnabled === false) return 'Soundboard muted by the host';
  const turn = view?.turn;
  if (state.live?.phase === 'IN_PROGRESS' && turn) {
    if (turn.mods.shotClockSeconds) return 'Quiet: shot clock running';
    if (turn.darts.length > 0) return 'Quiet: player is throwing';
  }
  return null;
}
