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
import { CARD_BY_ID, RARITY_LABEL, type CardRarity, type CardTypeId } from '../../engine/cardCatalog.ts';
import { useRarityOf } from '../../hooks/useCardLook.ts';


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
  SILVER: 'var(--rarity-silver)',
  RARE: 'var(--rarity-rare)',
  LEGENDARY: 'var(--rarity-legendary)',
};

export const CardIcon = ({ id, size = 20 }: { id: CardTypeId; size?: number }) => {
  const Icon = CARD_ICON[id] ?? UserRoundCog;
  return <Icon size={size} aria-hidden />;
};

type Size = 'sm' | 'md' | 'lg' | 'xl';
const DIM: Record<Size, { box: string; icon: number; title: string; text: string; bar: string }> = {
  sm: { box: 'w-28 p-2 gap-1', icon: 22, title: 'text-xs', text: 'text-[10px]', bar: 'h-1.5' },
  md: { box: 'w-44 p-3 gap-2', icon: 32, title: 'text-sm', text: 'text-xs', bar: 'h-2' },
  lg: { box: 'w-56 p-4 gap-2', icon: 48, title: 'text-xl', text: 'text-sm', bar: 'h-3' },
  xl: { box: 'w-96 p-8 gap-4', icon: 112, title: 'text-4xl', text: 'text-xl', bar: 'h-5' },
};

/** A Power Card tile: icon, name, rules line and a thick CS2-style rarity bar. */
export function PowerCard({ id, size = 'md', showRules = true, className = '' }: { id: CardTypeId; size?: Size; showRules?: boolean; className?: string }) {
  const card = CARD_BY_ID[id];
  const rarity = useRarityOf()(id);
  const d = DIM[size];
  const color = RARITY_VAR[rarity];
  return (
    <div
      className={`relative flex shrink-0 flex-col items-center overflow-hidden rounded-lg border-2 bg-bg-elevated text-center ${d.box} ${className}`}
      style={{ borderColor: color, boxShadow: rarity === 'LEGENDARY' ? `0 0 24px -6px ${color}` : undefined }}
    >
      <span className="text-[0.65em] font-semibold tracking-widest uppercase" style={{ color }}>
        <span className={d.text}>{RARITY_LABEL[rarity]}</span>
      </span>
      <span style={{ color }}>
        <CardIcon id={id} size={d.icon} />
      </span>
      <span className={`font-display leading-tight font-bold uppercase ${d.title}`}>{card.name}</span>
      {showRules && <span className={`leading-snug text-text-muted ${d.text}`}>{card.short}</span>}
      <span className={`absolute inset-x-0 bottom-0 ${d.bar}`} style={{ background: color }} />
      <span className={d.bar} aria-hidden />
    </div>
  );
}
