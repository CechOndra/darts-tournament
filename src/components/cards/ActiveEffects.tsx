import { Hourglass } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CARD_BY_ID } from '../../engine/cardCatalog.ts';
import type { VisitMods } from '../../engine/cardEffects.ts';
import type { MatchView } from '../../engine/match.ts';
import { teamName } from '../../engine/selectors.ts';
import type { TournamentState } from '../../engine/state.ts';
import { playCountdown } from '../../services/audio/sound.ts';
import { CardIcon, RARITY_VAR } from './PowerCard.tsx';

type Size = 'md' | 'xl';

function effectLines(mods: VisitMods): string[] {
  const out: string[] = [];
  if (mods.maxDarts === 2) out.push('Only 2 darts this visit');
  if (mods.maxDarts === 4) out.push('4 darts this visit');
  if (mods.doubleAll) out.push('All darts score 2x');
  if (mods.doubleDart1) out.push('Dart 1 scores 2x');
  if (mods.parity) out.push(`${mods.parityDart1Only ? 'Dart 1: ' : ''}${mods.parity} segments only`);
  if (mods.bottomHalf) out.push(`${mods.bottomHalfDart1Only ? 'Dart 1: ' : ''}only 1-10 scores`);
  if (mods.allOrNothing) out.push(`Score ${mods.allOrNothing.quota}+ for -${mods.allOrNothing.bonus} bonus, else 0`);
  if (mods.showboat) out.push(`Hit any double: +${mods.showboat} bonus`);
  if (mods.swapThrower) out.push('Teammate swap: other player throws');
  if (mods.weakHand) out.push('Dart 1: non-dominant hand');
  if (mods.stepBack) out.push('Dart 1: one step behind the oche');
  if (mods.shotClockSeconds) out.push(`Shot clock: ${mods.shotClockSeconds} s`);
  return out;
}

export function ShotClock({ seconds, size, sound }: { seconds: number; size: Size; sound?: boolean }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => {
      const l = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
      setLeft((prev) => {
        if (sound && l !== prev && l <= 5) playCountdown(l === 0);
        return l;
      });
      if (l === 0) clearInterval(t);
    }, 200);
    return () => clearInterval(t);
  }, [seconds, sound]);
  const xl = size === 'xl';
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border px-3 font-mono font-bold tabular-nums ${xl ? 'py-2 text-5xl' : 'py-1 text-xl'} ${
        left <= 3 ? 'animate-pulse border-accent-danger text-accent-danger' : 'border-accent-warning text-accent-warning'
      }`}
      role="timer"
    >
      <Hourglass size={xl ? 40 : 18} aria-hidden /> {left}
    </span>
  );
}

/** Card effects on the visit being thrown now, plus cards already queued for upcoming visits. */
export function ActiveEffects({ state, view, size = 'md', sound }: { state: TournamentState; view: MatchView; size?: Size; sound?: boolean }) {
  const turn = view.turn;
  if (!turn) return null;
  const xl = size === 'xl';
  const mods = turn.mods;
  const lines = effectLines(mods);
  const upcoming = view.plays.filter((p) => p.legIndex === turn.legIndex && p.visitIndex > turn.visitIndex);
  if (!lines.length && !upcoming.length) return null;
  const rawSoFar = turn.darts.reduce((s, d) => s + d.rawPoints, 0);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${xl ? 'gap-4' : ''}`}>
      {mods.plays.map((p) => {
        const color = RARITY_VAR[CARD_BY_ID[p.effectCardTypeId].rarity];
        return (
          <span key={p.id} className={`inline-flex items-center gap-2 rounded-md border-2 bg-bg-elevated px-3 font-display uppercase ${xl ? 'py-2 text-3xl' : 'py-1 text-sm'}`} style={{ borderColor: color }}>
            <span style={{ color }}>
              <CardIcon id={p.effectCardTypeId} size={xl ? 32 : 16} />
            </span>
            {CARD_BY_ID[p.effectCardTypeId].name}
            <span className="font-sans text-[0.6em] tracking-normal text-text-muted normal-case">by {teamName(state, p.teamId)}</span>
          </span>
        );
      })}
      {lines.map((l) => (
        <span key={l} className={`text-accent-warning ${xl ? 'text-2xl' : 'text-xs'}`}>
          {l}
        </span>
      ))}
      {mods.allOrNothing && (
        <span className={`flex items-center gap-2 ${xl ? 'text-2xl' : 'text-xs'}`}>
          <span className={`relative overflow-hidden rounded-full bg-bg-primary ${xl ? 'h-5 w-72' : 'h-2.5 w-32'}`}>
            <span
              className={`absolute inset-y-0 left-0 ${rawSoFar >= mods.allOrNothing.quota ? 'bg-accent-success' : 'bg-accent-gold'}`}
              style={{ width: `${Math.min(100, (rawSoFar / mods.allOrNothing.quota) * 100)}%` }}
            />
          </span>
          <span className="font-mono tabular-nums">
            {rawSoFar}/{mods.allOrNothing.quota}
          </span>
        </span>
      )}
      {mods.shotClockSeconds && (turn.darts.length < turn.maxDarts) && (
        <ShotClock key={`${turn.legIndex}-${turn.visitIndex}`} seconds={mods.shotClockSeconds} size={size} sound={sound} />
      )}
      {upcoming.map((p) => (
        <span key={p.id} className={`text-text-muted ${xl ? 'text-xl' : 'text-xs'}`}>
          Next: {CARD_BY_ID[p.effectCardTypeId].name} ({teamName(state, p.teamId)})
        </span>
      ))}
    </div>
  );
}
