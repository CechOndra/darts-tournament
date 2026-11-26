/** Placeholder pictures for testing: coloured game-icons (CC BY 3.0, see CREDITS.md) and a person silhouette. */

export type IconKind = 'player' | 'team';

export const ICON_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

/** The icon set is ~120 KB of path data, so it is only loaded when an admin screen needs it. */
export const loadIcons = () => import('../../assets/placeholderIcons.ts');

const toDataUrl = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

/** White icon on a coloured square, ready to store as avatarDataUrl / logoDataUrl. */
export const iconDataUrl = (d: string, color: string): string =>
  toDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${color}"/><path fill="#fff" d="${d}"/></svg>`);

const BUST = '<circle cx="256" cy="170" r="92"/><path d="M52 512c0-120 84-196 204-196s204 76 204 196z"/>';
/** Chest-up silhouette for players without a photo (circle avatar variant, and a transparent one for FUT cards). */
export const SILHOUETTE_AVATAR = toDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#94a3b8"/><g fill="#0f172a">${BUST}</g></svg>`);
export const SILHOUETTE_FUT = toDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g fill="#000" fill-opacity=".8">${BUST}</g></svg>`);

function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** `count` icon data URLs: all different while the set lasts (30), random colours. */
export async function randomIconUrls(kind: IconKind, count: number): Promise<string[]> {
  const set = await loadIcons();
  const icons = kind === 'player' ? set.PLAYER_ICONS : set.TEAM_ICONS;
  const pool = shuffled(icons);
  return Array.from({ length: count }, (_, i) => iconDataUrl(pool[i % pool.length]!.d, ICON_COLORS[Math.floor(Math.random() * ICON_COLORS.length)]!));
}
