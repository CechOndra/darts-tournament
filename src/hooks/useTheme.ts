import { useEffect } from 'react';
import { DEFAULT_THEME, readableOn, THEME_BY_ID, type ThemeSettings } from '../engine/themes.ts';

const ACCENT_VARS = ['--accent-gold', '--accent-primary', '--accent-primary-hover', '--accent-gold-text', '--text-inverse', '--on-primary', '--coin-face', '--fut-icon-accent'];

/** Apply a theme to the whole document (html[data-theme] + optional main color). */
export function applyTheme(theme: ThemeSettings | undefined): void {
  const t = theme ?? DEFAULT_THEME;
  const root = document.documentElement;
  const def = THEME_BY_ID[t.preset] ?? THEME_BY_ID.classic;
  if (def.id === 'classic') delete root.dataset.theme;
  else root.dataset.theme = def.id;
  for (const v of ACCENT_VARS) root.style.removeProperty(v);
  if (t.accent) {
    const on = readableOn(t.accent);
    root.style.setProperty('--accent-gold', t.accent);
    root.style.setProperty('--accent-primary', t.accent);
    root.style.setProperty('--accent-primary-hover', `color-mix(in srgb, ${t.accent} 82%, white)`);
    // Light themes need a darker shade when the color is used as text.
    root.style.setProperty('--accent-gold-text', def.light ? `color-mix(in srgb, ${t.accent} 55%, black)` : t.accent);
    root.style.setProperty('--text-inverse', on);
    root.style.setProperty('--on-primary', on);
    root.style.setProperty('--coin-face', t.accent);
    root.style.setProperty('--fut-icon-accent', t.accent);
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg-primary').trim() || '#0b0f17');
}

/** Keep the document theme in sync with the tournament's theme setting. */
export function useThemeSync(theme: ThemeSettings | undefined): void {
  const preset = theme?.preset;
  const accent = theme?.accent;
  useEffect(() => {
    applyTheme(preset ? { preset, accent: accent ?? null } : undefined);
  }, [preset, accent]);
}
