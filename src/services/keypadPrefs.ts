import { KEYPAD_LAYOUTS, type KeypadLayout } from '../engine/types.ts';

/** Per-tablet keypad preference (null layout = follow the tournament default). */
export interface KeypadPrefs {
  layout: KeypadLayout | null;
  stickyModifier: boolean;
}

const KEY = 'darts.keypadPrefs.v1';
export const DEFAULT_KEYPAD_PREFS: KeypadPrefs = { layout: null, stickyModifier: false };

export function loadKeypadPrefs(): KeypadPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<KeypadPrefs> | null;
    if (!raw) return DEFAULT_KEYPAD_PREFS;
    return {
      layout: raw.layout && KEYPAD_LAYOUTS.includes(raw.layout) ? raw.layout : null,
      stickyModifier: raw.stickyModifier === true,
    };
  } catch {
    return DEFAULT_KEYPAD_PREFS;
  }
}

export function saveKeypadPrefs(prefs: KeypadPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable (private mode): the preference just lasts for this session.
  }
}

export const effectiveLayout = (prefs: KeypadPrefs, tournamentDefault: KeypadLayout): KeypadLayout => prefs.layout ?? tournamentDefault;
