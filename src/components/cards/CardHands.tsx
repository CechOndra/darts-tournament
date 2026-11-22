import { useState } from 'react';
import { CARD_BY_ID } from '../../engine/cardCatalog.ts';
import { handOf } from '../../engine/cardPool.ts';
import { checkPlay } from '../../engine/cards.ts';
import type { MatchView } from '../../engine/match.ts';
import { teamName } from '../../engine/selectors.ts';
import type { TournamentState } from '../../engine/state.ts';
import type { CardInstance, Parity, Side } from '../../engine/types.ts';
import { useTransportContext } from '../../hooks/TransportProvider.tsx';
import { playCard } from '../../services/cardOps.ts';
import { useRarityOf } from '../../hooks/useCardLook.ts';
import { Button, Modal } from '../ui.tsx';
import { CardIcon, RARITY_VAR } from './PowerCard.tsx';

/** Scorer: tactile buttons for the cards each team in the match holds (enabled only when legal). */
export function CardHands({ state, view, only }: { state: TournamentState; view: MatchView; only?: 'PRE_MATCH' }) {
  const { transport } = useTransportContext();
  const [parityFor, setParityFor] = useState<CardInstance | null>(null);
  const [busy, setBusy] = useState(false);
  const rarityOf = useRarityOf();
  const sides: Side[] = ['home', 'away'];

  const play = async (inst: CardInstance, parity?: Parity) => {
    if (busy) return;
    setBusy(true);
    try {
      await playCard(transport, inst.instanceId, parity);
    } finally {
      setBusy(false);
      setParityFor(null);
    }
  };

  const hands = sides.map((s) => {
    const teamId = view.teamIds[s];
    const cards = handOf(state.cards, teamId).filter((i) => !only || CARD_BY_ID[i.cardTypeId].timing === only);
    return { side: s, teamId, cards };
  });
  if (hands.every((h) => !h.cards.length)) return null;

  return (
    <div className="grid grid-cols-2 gap-2" aria-label="Power cards">
      {hands.map(({ side, teamId, cards }) => (
        <div key={side} className="min-w-0 space-y-1">
          <p className="truncate text-[11px] font-medium tracking-wide text-text-muted uppercase">{teamName(state, teamId)} cards</p>
          <div className="flex flex-wrap gap-1.5">
            {cards.length === 0 && <span className="text-xs text-text-muted">None</span>}
            {cards.map((inst) => {
              const card = CARD_BY_ID[inst.cardTypeId];
              const check = checkPlay(state, teamId, inst.instanceId, view);
              const color = RARITY_VAR[rarityOf(inst.cardTypeId)];
              return (
                <button
                  key={inst.instanceId}
                  type="button"
                  disabled={!check.ok || busy}
                  title={check.ok ? card.rules : check.reason}
                  onClick={() => (card.needsParity ? setParityFor(inst) : void play(inst))}
                  className="flex min-h-11 max-w-full items-center gap-1.5 rounded-md border-2 bg-bg-elevated px-2 text-left text-xs font-semibold transition active:scale-95 disabled:opacity-35"
                  style={{ borderColor: color }}
                >
                  <span style={{ color }} className="shrink-0">
                    <CardIcon id={inst.cardTypeId} size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{card.name}</span>
                    {!check.ok && <span className="block truncate text-[10px] font-normal text-text-muted">{check.reason}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {parityFor && (
        <Modal title={`${CARD_BY_ID[parityFor.cardTypeId].name}: pick parity`} onClose={() => setParityFor(null)}>
          <p className="mb-3 text-text-muted">Darts on the other parity score 0. Outer bull 25 is odd, bull 50 is even.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" variant="primary" onClick={() => void play(parityFor, 'EVEN')}>
              EVEN only
            </Button>
            <Button size="lg" variant="primary" onClick={() => void play(parityFor, 'ODD')}>
              ODD only
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
