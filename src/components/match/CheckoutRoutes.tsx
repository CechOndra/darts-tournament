import { useMemo } from 'react';
import { dualCheckout } from '../../engine/checkout.ts';
import { rulesFor, type MatchView } from '../../engine/match.ts';
import type { TournamentState } from '../../engine/state.ts';

function Route({ labels, title, tone, xl }: { labels: string[]; title: string; tone: 'gold' | 'white'; xl: boolean }) {
  const gold = tone === 'gold';
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 ${gold ? 'border-accent-gold/60 bg-accent-gold/10' : 'border-border-strong bg-bg-elevated'}`}>
      <span className={`font-display tracking-widest uppercase ${gold ? 'text-accent-gold' : 'text-text-primary'} ${xl ? 'text-xl' : 'text-xs'}`}>{title}</span>
      <span className="flex gap-2">
        {labels.map((l, i) => (
          <span key={i} className={`rounded px-2 py-0.5 font-mono font-bold ${gold ? 'bg-accent-gold text-text-inverse' : 'bg-text-primary text-bg-primary'} ${xl ? 'text-3xl' : 'text-sm'}`}>
            {l}
          </span>
        ))}
      </span>
    </div>
  );
}

/** Live Dual-Path Checkout Solver for the current thrower (score <= 180). */
export function CheckoutRoutes({ state, view, size = 'md' }: { state: TournamentState; view: MatchView; size?: 'md' | 'xl' }) {
  const turn = view.turn;
  const rules = rulesFor(state, view.match);
  const m = turn?.mods;
  // Cards that change what a dart is worth make the normal routes misleading.
  const cardAltersScoring = !!m && (m.bottomHalf || !!m.parity || m.doubleAll || m.doubleDart1 || !!m.allOrNothing);
  const dual = useMemo(() => {
    if (!turn || turn.remaining > 180) return null;
    return dualCheckout(turn.remaining, turn.maxDarts - turn.darts.length, rules.checkoutMode, rules.specialRules);
  }, [turn, rules]);
  if (!turn || turn.remaining > 180 || !dual) return null;
  const xl = size === 'xl';
  if (cardAltersScoring) return <p className={`text-text-muted ${xl ? 'text-xl' : 'text-xs'}`}>Power Card active: normal checkout routes do not apply this visit.</p>;
  if (!dual.safe && !dual.bonus) {
    return <p className={`text-text-muted ${xl ? 'text-xl' : 'text-xs'}`}>No checkout this visit — set up a finish.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {dual.bonus && dual.bonusLabel && <Route labels={dual.bonus.labels} title={`Gold: ${dual.bonusLabel}`} tone="gold" xl={xl} />}
      {dual.safe && <Route labels={dual.safe.labels} title={dual.bonus ? `White: ${dual.safeLabel}` : dual.safeLabel} tone="white" xl={xl} />}
    </div>
  );
}
