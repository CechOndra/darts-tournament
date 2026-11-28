import { CARD_BY_ID, CARD_TYPES, normalizeRarity, RARITY_COPIES, RARITY_COST, type CardPool, type CardRarity, type CardTypeId } from './cardCatalog.ts';
import type { CardLimitMode, CardSettings, CardTypeConfig, EnergyScope, Match } from './types.ts';

/**
 * Per-tournament card tuning: which cards exist, their rarity, pool and copies/odds,
 * and whether (and how often) they appear in the playoffs.
 */

export const defaultCardConfig = (id: CardTypeId): CardTypeConfig => {
  const c = CARD_BY_ID[id];
  return { enabled: true, rarity: c.rarity, pool: c.pool, copies: RARITY_COPIES[c.rarity], playoffs: true, playoffCopies: null };
};

export const defaultCardConfigs = (): Record<CardTypeId, CardTypeConfig> =>
  Object.fromEntries(CARD_TYPES.map((c) => [c.id, defaultCardConfig(c.id)])) as Record<CardTypeId, CardTypeConfig>;

export function cardConfig(settings: CardSettings, id: CardTypeId): CardTypeConfig {
  const cfg = { ...defaultCardConfig(id), ...settings.config?.[id] };
  return { ...cfg, rarity: normalizeRarity(cfg.rarity, CARD_BY_ID[id].rarity) }; // old saves say SILVER
}

export const rarityIn = (settings: CardSettings, id: CardTypeId): CardRarity => cardConfig(settings, id).rarity;
export const poolIn = (settings: CardSettings, id: CardTypeId): CardPool => cardConfig(settings, id).pool;

export const limitModeOf = (settings: CardSettings): CardLimitMode => settings.limitMode ?? 'COUNT';
export const energyRule = (settings: CardSettings): { scope: EnergyScope; amount: number } => ({ scope: settings.energyScope ?? 'LEG', amount: settings.energyAmount ?? 3 });
/** Energy a card costs (admin override, else the default for its rarity). */
export function cardCost(settings: CardSettings, id: CardTypeId): number {
  const c = cardConfig(settings, id);
  return typeof c.cost === 'number' ? Math.max(0, c.cost) : RARITY_COST[c.rarity];
}

export type CardStage = Match['stage'];

/** Is the card in play at this stage (enabled, and allowed in the playoffs)? */
export function cardAllowed(settings: CardSettings, id: CardTypeId, stage: CardStage): boolean {
  const c = cardConfig(settings, id);
  return c.enabled && (stage === 'GROUP' || c.playoffs);
}

/** Relative odds in FIXED_PROBABILITIES mode (playoffs may use their own weight). */
export function oddsWeight(settings: CardSettings, id: CardTypeId, stage: CardStage): number {
  if (!cardAllowed(settings, id, stage)) return 0;
  const c = cardConfig(settings, id);
  return Math.max(0, stage === 'PLAYOFF' && c.playoffCopies !== null ? c.playoffCopies : c.copies);
}

/** Printed copies (FINITE_PHYSICAL_POOL): disabled cards are taken out of the deck. */
export function printedCopies(settings: CardSettings, id: CardTypeId): number {
  const c = cardConfig(settings, id);
  return c.enabled ? Math.max(0, Math.round(c.copies)) : 0;
}

/** Stage animation timings in ms (older tournaments fall back to the defaults). */
export function animationMs(params: Partial<CardSettings['params']>) {
  const sec = (v: number | undefined, d: number) => Math.round((typeof v === 'number' && v > 0 ? v : d) * 1000);
  return {
    caseOpening: sec(params.caseOpeningSeconds, 5.5),
    wheel: sec(params.wheelSeconds, 5.5),
    randomPower: sec(params.randomPowerSeconds, 3.5),
    reveal: sec(params.revealSeconds, 3.8),
  };
}

/** Migrate the v5 `copies` map into per-card configs. */
export function configsFromCopies(copies: Partial<Record<CardTypeId, number>> | undefined): Record<CardTypeId, CardTypeConfig> {
  const out = defaultCardConfigs();
  if (!copies) return out;
  for (const c of CARD_TYPES) {
    const n = copies[c.id];
    if (typeof n === 'number') out[c.id] = { ...out[c.id], copies: n, enabled: n > 0 };
  }
  return out;
}
