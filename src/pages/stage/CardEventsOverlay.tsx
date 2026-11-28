import gsap from 'gsap';
import { useEffect, useMemo, useRef, useState } from 'react';
import { autoTilt } from '../../components/cards/autoTilt.ts';
import { CaseOpening, SpinWheel, type Candidate } from '../../components/cards/DrawAnimations.tsx';
import { PowerCard, RARITY_VAR } from '../../components/cards/PowerCard.tsx';
import { RarityPack } from '../../components/cards/RarityPack.tsx';
import { CARD_REVEAL, cardFace, rendererRarity } from '../../components/cards/cardView.ts';
import { CARD_BY_ID, RANDOM_OPP, RANDOM_OWN, RARITY_LABEL } from '../../engine/cardCatalog.ts';
import { animationMs } from '../../engine/cardConfig.ts';
import { drawWeights } from '../../engine/cards.ts';
import { teamName } from '../../engine/selectors.ts';
import type { TournamentState } from '../../engine/state.ts';
import type { CardDraw, CardPlay } from '../../engine/types.ts';
import { playCardStinger, playReveal } from '../../services/audio/sound.ts';
import { useRarityOf } from '../../hooks/useCardLook.ts';
import { playReveal as playCardReveal } from '../../powercards/reveal.js';
import { DiscardPrompt } from '../scorer/CardDrawPanel.tsx';

type StageEvent = { kind: 'draw'; draw: CardDraw } | { kind: 'play'; play: CardPlay };
/** spin = roll running (or the one-step card reveal), pack = rarity pack waiting for a click, open = card reveal animation, reveal / announce = static card. */
type Phase = 'spin' | 'pack' | 'open' | 'reveal' | 'announce';

/** Seconds until the revealed card lands face-up (rise 0.55 + spin time per tier in reveal.js): the fanfare plays then. */
const LAND_S = { common: 2.4, uncommon: 2.8, rare: 3.4, legendary: 3.8 };

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
  const cards = state.settings.cards;
  const ms = animationMs(cards.params);
  const style = cards.drawAnimationStyle;
  const shows = cards.drawShows ?? 'POWERS';
  // "Card reveal" is the one-step dartboard-back reveal; case opening / wheel roll first (CARD_REVEAL = 'legacy' turns the new reveal off).
  const oneStep = CARD_REVEAL === 'new' && style === 'CARD_REVEAL';
  const hidePowers = event?.kind === 'draw' && style !== 'CARD_REVEAL' && shows !== 'POWERS';
  const revealing = !!event && CARD_REVEAL === 'new' && (phase === 'open' || (oneStep && phase === 'spin'));

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

  // Card reveal: dartboard back, spin, face-up (sways on its own), hold, poof; then the overlay closes. Visuals only: the card is already in state.
  const stateRef = useRef(state);
  stateRef.current = state;
  const newTitle = useRef('');
  useEffect(() => {
    if (!revealing || !event) return;
    const id = event.kind === 'draw' ? event.draw.cardTypeId : event.play.effectCardTypeId;
    const { card, style: look } = cardFace(stateRef.current.settings.cards, id);
    const hold = ms.reveal / 1000;
    const handle = playCardReveal(card, { look: look.look, colors: look.colors, options: look.options, backColor: look.back, gsap, hold, onDone: () => setEvent(null) });
    const label = document.createElement('div');
    label.textContent = newTitle.current;
    label.style.cssText = 'position:absolute;top:5vh;left:0;right:0;text-align:center;color:#fff;font:400 clamp(28px,4.5vw,72px) var(--font-display,sans-serif);letter-spacing:.04em;text-transform:uppercase;pointer-events:none';
    document.querySelector('.pc-stage')?.append(label);
    const land = LAND_S[rendererRarity(rarityOf(id))] * 1000;
    const sound = setTimeout(() => playReveal(rarityOf(id)), land);
    let stopTilt = () => {};
    const tilt = setTimeout(() => {
      const el = document.querySelector<HTMLElement>('.pc-stage .pc-front .pc-card');
      if (el) stopTilt = autoTilt(el, Math.min(3.5, hold));
    }, land + 300);
    return () => {
      clearTimeout(sound);
      clearTimeout(tilt);
      stopTilt();
      label.remove();
      handle.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, phase]);

  // Static card (played cards, legacy reveal): hold, then close.
  useEffect(() => {
    if (!event || (phase !== 'reveal' && phase !== 'announce')) return;
    const id = event.kind === 'draw' ? event.draw.cardTypeId : event.play.effectCardTypeId;
    if (phase === 'reveal') playReveal(rarityOf(id));
    const t = setTimeout(() => setEvent(null), phase === 'reveal' ? ms.reveal : Math.max(2000, ms.reveal - 800));
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

  const discard = state.cards.pendingDiscard && (!event || phase === 'reveal' || phase === 'announce');

  if (!event) {
    return discard ? (
      <div className="absolute inset-x-0 bottom-0 z-20 mx-auto max-w-4xl">
        <DiscardPrompt state={state} interactive={false} />
      </div>
    ) : null;
  }

  const team = teamName(state, event.kind === 'draw' ? event.draw.teamId : event.play.teamId);
  const wheel = style === 'SPIN_WHEEL';

  let title: string;
  let resultId;
  if (event.kind === 'draw') {
    title = event.draw.kind === 'WINNER' ? `${team} opens a winner case` : event.draw.kind === 'LOSER' ? `${team} opens a loser case` : `${team}: bonus draw`;
    resultId = event.draw.cardTypeId;
  } else {
    title = `${team} plays ${CARD_BY_ID[event.play.cardTypeId].name}`;
    resultId = event.play.effectCardTypeId;
  }

  newTitle.current = title;
  if (revealing) return null; // playReveal draws its own full-screen stage

  // When the roll ends: the pack (rarity-first + pack), the card reveal animation, or the plain card (play events / legacy).
  const afterSpin = (): void => setPhase(hidePowers && shows === 'RARITY_PACK' ? 'pack' : event.kind === 'draw' && CARD_REVEAL === 'new' ? 'open' : 'reveal');
  const rarity = rarityOf(resultId);

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-10 rounded-lg bg-bg-primary/95 px-8">
      <p className="text-center font-display text-6xl tracking-wide uppercase">{title}</p>
      {phase === 'spin' ? (
        event.kind === 'draw' && wheel ? (
          <SpinWheel winner={resultId} seed={event.draw.id} candidates={candidates} durationMs={ms.wheel} hidePowers={hidePowers} onDone={afterSpin} />
        ) : (
          <CaseOpening
            winner={resultId}
            seed={event.kind === 'draw' ? event.draw.id : event.play.id}
            candidates={candidates}
            durationMs={event.kind === 'draw' ? ms.caseOpening : ms.randomPower}
            hidePowers={hidePowers}
            onDone={afterSpin}
          />
        )
      ) : phase === 'pack' ? (
        <RarityPack
          label={RARITY_LABEL[rarity]}
          color={String(cardFace(cards, resultId).style.colors.accent ?? RARITY_VAR[rarity])}
          onOpen={() => setPhase(CARD_REVEAL === 'new' ? 'open' : 'reveal')}
        />
      ) : (
        <div className="flex flex-col items-center gap-6">
          <PowerCard id={resultId} size="xl" tiltFor={4} />
          {event.kind === 'play' && event.play.parity && <p className="font-display text-5xl text-accent-gold uppercase">{event.play.parity} only</p>}
          {event.kind === 'play' && event.play.cardTypeId === 'RANDOM_POWER' && <p className="font-display text-4xl text-accent-gold uppercase">Activated now</p>}
        </div>
      )}
    </div>
  );
}
