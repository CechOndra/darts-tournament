import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { TournamentState } from '../engine/state.ts';
import { isAudioUnlocked, isMuted, onAudioChange, playWinSong, stopWinSong } from '../services/audio/sound.ts';

const subscribe = (cb: () => void) => onAudioChange(cb);

/** Mute + unlocked state of this device's audio (re-renders on change). */
export function useSoundState(): { muted: boolean; unlocked: boolean } {
  const muted = useSyncExternalStore(subscribe, isMuted);
  const unlocked = useSyncExternalStore(subscribe, isAudioUnlocked);
  return { muted, unlocked };
}

/** Stage: play the win song when the match-winning dart lands; stop it if the match is reopened. */
export function useWinSong(state: TournamentState | null): void {
  const phase = state?.live?.phase ?? null;
  const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const before = prev.current;
    prev.current = phase;
    if (before === undefined) return; // first render: never replay an old finish
    if (phase === 'POST_MATCH' && before !== 'POST_MATCH') playWinSong();
    if (phase === 'IN_PROGRESS' && before === 'POST_MATCH') stopWinSong();
  }, [phase]);
}
