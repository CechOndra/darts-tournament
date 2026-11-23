/** Visual theme presets (colors only; CSS lives in src/index.css under html[data-theme]). */

export type ThemeId = 'classic' | 'pub' | 'broadcast' | 'daylight' | 'contrast' | 'pop';

export interface ThemeDef {
  id: ThemeId;
  name: string;
  description: string;
  light: boolean;
  /** Swatches for the admin preview tile: background, surface, text, accent, primary. */
  preview: [string, string, string, string, string];
}

export const THEMES: ThemeDef[] = [
  { id: 'classic', name: 'Classic', description: 'Dark navy with gold. The original look.', light: false, preview: ['#0b0f17', '#121826', '#f8fafc', '#f59e0b', '#e11d48'] },
  { id: 'pub', name: 'Pub', description: 'Dark green felt, chalk-white text, dartboard red and green.', light: false, preview: ['#0d1c14', '#13281d', '#f3efe2', '#e3bf62', '#c8312b'] },
  { id: 'broadcast', name: 'TV Broadcast', description: 'Deep black with neon pink and cyan, like televised darts.', light: false, preview: ['#050507', '#0d0d15', '#ffffff', '#22e4ff', '#ff2d95'] },
  { id: 'daylight', name: 'Daylight', description: 'Light and clean for bright rooms or a weak projector.', light: true, preview: ['#f3f5f9', '#ffffff', '#0f172a', '#f59e0b', '#d6243f'] },
  { id: 'contrast', name: 'High Contrast', description: 'Black, white and yellow. Readable from the back of the room.', light: false, preview: ['#000000', '#000000', '#ffffff', '#ffe600', '#ffe600'] },
  { id: 'pop', name: 'Pop', description: 'Cream paper, thick black outlines, pill buttons, bold rounded type.', light: true, preview: ['#fffbef', '#ffffff', '#141414', '#ffd60a', '#ffd60a'] },
];

export const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t])) as Record<ThemeId, ThemeDef>;

export interface ThemeSettings {
  preset: ThemeId;
  /** Optional main color (hex) replacing the theme's highlight + primary button color. */
  accent: string | null;
}

export const DEFAULT_THEME: ThemeSettings = { preset: 'classic', accent: null };

/** Black or white text for a background color (WCAG relative luminance). */
export function readableOn(hex: string): '#141414' | '#ffffff' {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#141414';
  const n = parseInt(m[1]!, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
  return lum > 0.4 ? '#141414' : '#ffffff';
}

export const isHexColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
