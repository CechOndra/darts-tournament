import { useCallback, useMemo } from 'react';
import { cardFace } from '../components/cards/cardView.ts';
import { CARD_BY_ID, type CardRarity, type CardTypeId } from '../engine/cardCatalog.ts';
import { rarityIn } from '../engine/cardConfig.ts';
import { useOptionalTournamentState } from './TransportProvider.tsx';

/** Rarity as configured for this tournament (organizers can re-tier cards); catalog default elsewhere. */
export function useRarityOf(): (id: CardTypeId) => CardRarity {
  const settings = useOptionalTournamentState()?.settings.cards;
  return useCallback((id: CardTypeId) => (settings ? rarityIn(settings, id) : CARD_BY_ID[id].rarity), [settings]);
}

/** Card data + style for the renderer, from this tournament's card settings (built-in look elsewhere). Stable while settings are unchanged. */
export function useCardFace(): (id: CardTypeId) => ReturnType<typeof cardFace> {
  const settings = useOptionalTournamentState()?.settings.cards;
  return useMemo(() => {
    const cache = new Map<CardTypeId, ReturnType<typeof cardFace>>();
    return (id: CardTypeId) => cache.get(id) ?? (cache.set(id, cardFace(settings, id)), cache.get(id)!);
  }, [settings]);
}
