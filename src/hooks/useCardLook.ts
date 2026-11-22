import { useCallback } from 'react';
import { CARD_BY_ID, type CardRarity, type CardTypeId } from '../engine/cardCatalog.ts';
import { rarityIn } from '../engine/cardConfig.ts';
import { useOptionalTournamentState } from './TransportProvider.tsx';

/** Rarity as configured for this tournament (organizers can re-tier cards); catalog default elsewhere. */
export function useRarityOf(): (id: CardTypeId) => CardRarity {
  const settings = useOptionalTournamentState()?.settings.cards;
  return useCallback((id: CardTypeId) => (settings ? rarityIn(settings, id) : CARD_BY_ID[id].rarity), [settings]);
}
