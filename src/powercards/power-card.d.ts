export interface RenderCard {
  name: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  kind: string;
  icon: string;
  effect: string;
  when: string;
  limit: string;
  cost?: number;
  board?: 'even' | 'odd' | 'double' | 'triple';
  image?: string;
}
export interface RenderOptions {
  index?: number;
  total?: number;
  look?: string;
  colors?: Record<string, unknown>;
  options?: Record<string, unknown>;
}
export const RARITY: Record<string, { label: string; foil: number }>;
export const PRESET: {
  look: string;
  back: string;
  colors: Record<string, Record<string, Record<string, unknown>>>;
  options: Record<string, Record<string, unknown>>;
};
export function presetFor(look: string, rarity: string): { colors: Record<string, unknown>; options: Record<string, unknown> };
export function renderCard(card: RenderCard, opts?: RenderOptions): HTMLElement;
export function renderBack(opts?: { color?: string }): HTMLElement;
export function setTilt(card: HTMLElement, px: number, py: number): void;
export function resetTilt(card: HTMLElement): void;
export function attachTilt(root?: Document | HTMLElement): void;
export function createGyro(opts?: { getActiveCard?: () => HTMLElement | null; onChange?: (on: boolean) => void; onMessage?: (text: string) => void }): {
  supported: boolean;
  toggle: () => void;
  stop: () => void;
};
