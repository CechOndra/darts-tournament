import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { SegmentedControl } from '../components/ui.tsx';
import type { TournamentState } from '../engine/state.ts';
import type { FutNameMode } from '../engine/types.ts';

/**
 * Which name FUT cards show. The admin sets the default (full names) and may let guests switch.
 * A guest's own choice is kept per phone, only inside <GuestFutNamesProvider> (stage and admin always use the default).
 */
const KEY = 'darts.futNames';
const Ctx = createContext<{ choice: FutNameMode | null; setChoice: (m: FutNameMode) => void } | null>(null);

function loadChoice(): FutNameMode | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'FULL' || v === 'NICKNAME' ? v : null;
  } catch {
    return null;
  }
}

export function GuestFutNamesProvider({ children }: { children: ReactNode }) {
  const [choice, set] = useState<FutNameMode | null>(loadChoice);
  const setChoice = useCallback((m: FutNameMode) => {
    set(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* private mode: the choice just lasts until reload */
    }
  }, []);
  return <Ctx.Provider value={{ choice, setChoice }}>{children}</Ctx.Provider>;
}

export function useFutNames(state: TournamentState): { mode: FutNameMode; canSwitch: boolean; setMode: (m: FutNameMode) => void } {
  const ctx = useContext(Ctx);
  const v = state.settings.visibility;
  const canSwitch = !!ctx && v.futNamesGuestChoice === true;
  return { mode: canSwitch && ctx.choice ? ctx.choice : (v.futNames ?? 'FULL'), canSwitch, setMode: ctx?.setChoice ?? (() => undefined) };
}

export const futName = (p: { name: string; nickname?: string }, mode: FutNameMode): string => (mode === 'NICKNAME' ? p.nickname || p.name : p.name);

/** "Names: Full | Nickname", only shown when the admin lets guests switch. */
export function FutNameSwitch({ state }: { state: TournamentState }) {
  const { mode, canSwitch, setMode } = useFutNames(state);
  if (!canSwitch) return null;
  return (
    <SegmentedControl
      ariaLabel="Names on FUT cards"
      value={mode}
      options={[{ value: 'FULL', label: 'Full names' }, { value: 'NICKNAME', label: 'Nicknames' }]}
      onChange={setMode}
    />
  );
}
