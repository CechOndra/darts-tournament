import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { stageName } from '../engine/selectors.ts';
import type { TournamentState } from '../engine/state.ts';

/**
 * How a player's name is written on a screen:
 * - stage: the admin's stage setting (default: nickname when set, else full name)
 * - admin: full name, optionally with the nickname next to it (this device's own switch)
 * - anywhere else (scorer tablet, guest phones): full name
 * FUT cards and awards have their own setting (hooks/FutNames.tsx).
 */
type Screen = 'stage' | 'admin';
const Ctx = createContext<Screen | null>(null);
export const PlayerNamesScreen = ({ screen, children }: { screen: Screen; children: ReactNode }) => <Ctx.Provider value={screen}>{children}</Ctx.Provider>;

const KEY = 'darts.adminNicknames';
const listeners = new Set<() => void>();
const read = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};
export function setAdminNicknames(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* private mode: no persistence */
  }
  listeners.forEach((l) => l());
}
export function useAdminNicknames(): boolean {
  return useSyncExternalStore((cb) => (listeners.add(cb), () => void listeners.delete(cb)), read);
}

export function usePlayerLabel(state: TournamentState): (p: { name: string; nickname?: string }) => string {
  const screen = useContext(Ctx);
  const alongside = useAdminNicknames();
  const stage = state.settings.visibility.stageNames;
  return useCallback(
    (p) => (screen === 'stage' ? stageName(p, stage) : screen === 'admin' && alongside && p.nickname ? `${p.name} (${p.nickname})` : p.name),
    [screen, alongside, stage],
  );
}
