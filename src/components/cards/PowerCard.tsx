import {
  ArrowDown10,
  Ban,
  Dices,
  Flame,
  Footprints,
  Hand,
  Hourglass,
  Repeat2,
  RotateCcw,
  Scale,
  Sparkles,
  Swords,
  Target,
  Undo2,
  UserRoundCog,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { CardSettings } from '../../engine/types.ts';
import { autoTilt } from './autoTilt.ts';
import { cardFace } from './cardView.ts';
import type { CardRarity, CardTypeId } from '../../engine/cardCatalog.ts';
import { useCardFace } from '../../hooks/useCardLook.ts';
import { renderCard } from '../../powercards/power-card.js';


export const CARD_ICON: Record<CardTypeId, LucideIcon> = {
  ALL_OR_NOTHING: Flame,
  FIRST_THROW: Zap,
  DOUBLE_EDGED_SWORD: Swords,
  EXTRA_DART: Target,
  STEAL_DART: Ban,
  PARITY_LOCK_FULL: Scale,
  BOTTOM_HALF_FULL: ArrowDown10,
  MULLIGAN_ANY: RotateCcw,
  RANDOM_POWER: Dices,
  TEAMMATE_SWAP: Repeat2,
  SHOT_CLOCK: Hourglass,
  PARITY_LOCK_1DART: Scale,
  BOTTOM_HALF_1DART: ArrowDown10,
  WEAK_HAND_1DART: Hand,
  STEP_BACK_1DART: Footprints,
  MULLIGAN_DART1: Undo2,
  SHOWBOAT_DOUBLE: Sparkles,
};

/** Rarity colors come from the theme tokens (--rarity-*). */
export const RARITY_VAR: Record<CardRarity, string> = {
  COMMON: 'var(--rarity-common)',
  UNCOMMON: 'var(--rarity-uncommon)',
  RARE: 'var(--rarity-rare)',
  LEGENDARY: 'var(--rarity-legendary)',
};

export const CardIcon = ({ id, size = 20 }: { id: CardTypeId; size?: number }) => {
  const Icon = CARD_ICON[id] ?? UserRoundCog;
  return <Icon size={size} aria-hidden />;
};

type Size = 'sm' | 'md' | 'lg' | 'xl' | 'print';
/** Card width per size (the renderer scales everything from --pc-w; the ratio is a fixed 5:7). */
export const CARD_WIDTH: Record<Size, string> = { sm: '112px', md: '176px', lg: '224px', xl: '384px', print: '63mm' };

/** A Power Card: the shared card renderer (src/powercards) mounted in a React host. Text is live DOM text. */
export function PowerCard({ id, size = 'md', className = '', index = 0, total = 1, settings, short = false, tiltFor }: { id: CardTypeId; settings?: CardSettings; /** Energy mode: the team cannot afford this card (red cost ball). */ short?: boolean; /** Sway on its own for this many seconds. */ tiltFor?: number; size?: Size; showRules?: boolean; className?: string; index?: number; total?: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fromState = useCardFace()(id);
  const { card, style } = useMemo(() => (settings ? cardFace(settings, id) : fromState), [settings, id, fromState]);
  useLayoutEffect(() => {
    const el = renderCard(card, { index, total, look: style.look, colors: style.colors, options: style.options });
    el.style.setProperty('--pc-w', CARD_WIDTH[size]);
    if (short) el.dataset.short = '1';
    hostRef.current?.replaceChildren(el);
    return tiltFor ? autoTilt(el, tiltFor) : undefined;
  }, [card, style, size, index, total, short, tiltFor]);
  return <div ref={hostRef} className={`shrink-0 ${className}`} style={{ width: CARD_WIDTH[size] }} />;
}
