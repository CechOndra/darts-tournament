import { useEffect, useMemo, useRef, useState } from 'react';
import { CaseOpening, SpinWheel, type Candidate } from '../../components/cards/DrawAnimations.tsx';
import { PowerCard } from '../../components/cards/PowerCard.tsx';
import { CARD_BY_ID, RANDOM_OPP, RANDOM_OWN } from '../../engine/cardCatalog.ts';
import { drawWeights } from '../../engine/cards.ts';
import { teamName } from '../../engine/selectors.ts';
import type { TournamentState } from '../../engine/state.ts';
import type { CardDraw, CardPlay } from '../../engine/types.ts';
import { playCardStinger, playReveal } from '../../services/audio/sound.ts';
import { useRarityOf } from '../../hooks/useCardLook.ts';
import { DiscardPrompt } from '../scorer/CardDrawPanel.tsx';

type StageEvent = { kind: 'draw'; draw: CardDraw } | { kind: 'play'; play: CardPlay };
type Phase = 'spin' | 'reveal' | 'announce';

/** Watches the card log and plays the matching animation once per new draw / play. */
export function CardEventsOverlay({ state }: { state: TournamentState }) {
  const draws = state.cards.draws;
  const plays = state.cards.plays;
  const lastDraw = draws[draws.length - 1];
  const lastPlay = plays[plays.length - 1];
  const seen = useRef<{ draw: string | null; play: string | null } | null>(null);
  const [event, setEvent] = useState<StageEvent | null>(null);
  const [phase, setPhase] = useState<Phase>('spin');
  const rarityOf = useRarityOf();
  const drawMs = Math.round(state.settings.cards.params.drawAnimationSeconds * 1000);

  useEffect(() => {
    const cur = { draw: lastDraw?.id ?? null, play: lastPlay?.id ?? null };
    const prev = seen.current;
    seen.current = cur;
    if (!prev) return; // first render / reconnect: no replay of old events
    if (cur.draw && cur.draw !== prev.draw && lastDraw) {
      setEvent({ kind: 'draw', draw: lastDraw });
      setPhase('spin');
    } else if (cur.play && cur.play !== prev.play && lastPlay) {
      setEvent({ kind: 'play', play: lastPlay });
      setPhase(lastPlay.cardTypeId === 'RANDOM_POWER' ? 'spin' : 'announce');
      playCardStinger();
    } else if (event?.kind === 'play' && !plays.some((p) => p.id === event.play.id)) {
      setEvent(null); // the play was undone
    }
  }, [lastDraw, lastPlay, plays, event]);

  // Reveal / announce hold, then close.
  useEffect(() => {
    if (!event || phase === 'spin') return;
    const id = event.kind === 'draw' ? event.draw.cardTypeId : event.play.effectCardTypeId;
    if (phase === 'reveal') playReveal(rarityOf(id));
    const t = setTimeout(() => setEvent(null), phase === 'reveal' ? 3800 : 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, phase]);

  const candidates = useMemo<Candidate[]>(() => {
    if (!event) return [];
    if (event.kind === 'play') {
      const list = RANDOM_OWN.includes(event.play.effectCardTypeId) ? RANDOM_OWN : RANDOM_OPP;
      return list.map((cardTypeId) => ({ cardTypeId, weight: 1 }));
    }
    const tiered = state.settings.cards.poolStructure === 'TIERED_POOLS';
    const pool = event.draw.pool ?? (!tiered ? 'ANY' : event.draw.kind === 'LOSER' ? 'LOSER' : event.draw.kind === 'WINNER' ? 'WINNER' : 'ANY');
    return [...drawWeights(state, pool), { cardTypeId: event.draw.cardTypeId, weight: 1 }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  const discard = state.cards.pendingDiscard && (!event || phase !== 'spin');

  if (!event) {
    return discard ? (
      <div className="absolute inset-x-0 bottom-0 z-20 mx-auto max-w-4xl">
        <DiscardPrompt state={state} interactive={false} />
      </div>
    ) : null;
  }

  const team = teamName(state, event.kind === 'draw' ? event.draw.teamId : event.play.teamId);
  const wheel = state.settings.cards.drawAnimationStyle === 'SPIN_WHEEL';

  let title: string;
  let resultId;
  if (event.kind === 'draw') {
    title = event.draw.kind === 'WINNER' ? `${team} opens a winner case` : event.draw.kind === 'LOSER' ? `${team} opens a loser case` : `${team}: bonus draw`;
    resultId = event.draw.cardTypeId;
  } else {
    title = `${team} plays ${CARD_BY_ID[event.play.cardTypeId].name}`;
    resultId = event.play.effectCardTypeId;
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-10 rounded-lg bg-bg-primary/95 px-8">
      <p className="text-center font-display text-6xl tracking-wide uppercase">{title}</p>
      {phase === 'spin' ? (
        event.kind === 'draw' && wheel ? (
          <SpinWheel winner={resultId} seed={event.draw.id} candidates={candidates} durationMs={drawMs} onDone={() => setPhase('reveal')} />
        ) : (
          <CaseOpening
            winner={resultId}
            seed={event.kind === 'draw' ? event.draw.id : event.play.id}
            candidates={candidates}
            durationMs={event.kind === 'draw' ? drawMs : Math.round(drawMs * 0.65)}
            onDone={() => setPhase('reveal')}
          />
        )
      ) : (
        <div className="flex flex-col items-center gap-6">
          <PowerCard id={resultId} size="xl" />
          {event.kind === 'play' && event.play.parity && <p className="font-display text-5xl text-accent-gold uppercase">{event.play.parity} only</p>}
          {event.kind === 'play' && event.play.cardTypeId === 'RANDOM_POWER' && <p className="font-display text-4xl text-accent-gold uppercase">Activated now</p>}
        </div>
      )}
    </div>
  );
}
