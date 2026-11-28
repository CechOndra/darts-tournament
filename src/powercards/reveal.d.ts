import type { RenderCard, RenderOptions } from './power-card.js';
export function playReveal(
  card: RenderCard,
  opts?: RenderOptions & { hold?: number; gsap?: unknown; onDone?: () => void; backColor?: string },
): { kill: () => void };
