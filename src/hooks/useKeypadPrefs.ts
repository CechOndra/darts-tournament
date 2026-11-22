import { useCallback, useState } from 'react';
import type { KeypadLayout } from '../engine/types.ts';
import { effectiveLayout, loadKeypadPrefs, saveKeypadPrefs, type KeypadPrefs } from '../services/keypadPrefs.ts';

/** This tablet's keypad preference, falling back to the tournament default layout. */
export function useKeypadPrefs(tournamentDefault: KeypadLayout) {
  const [prefs, setPrefs] = useState<KeypadPrefs>(loadKeypadPrefs);
  const update = useCallback((patch: Partial<KeypadPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      saveKeypadPrefs(next);
      return next;
    });
  }, []);
  return { prefs, layout: effectiveLayout(prefs, tournamentDefault), update };
}
