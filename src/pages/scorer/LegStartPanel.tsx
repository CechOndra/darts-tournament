import { AlertTriangle, Coins, Crosshair } from 'lucide-react';
import { FIRST_THROW_LABEL, TIEBREAK_LABEL } from '../../components/admin/labels.ts';
import { Button, Notice } from '../../components/ui.tsx';
import { isSetupOverridden, type MatchView } from '../../engine/match.ts';
import { playersOfTeam, teamName } from '../../engine/selectors.ts';
import type { TournamentState } from '../../engine/state.ts';
import type { LegDecision, Side } from '../../engine/types.ts';
import { useDispatch, useTransportContext } from '../../hooks/TransportProvider.tsx';
import { runCoinToss } from '../../services/matchOps.ts';

const DECISION_PROMPT: Record<LegDecision, { title: string; resolvedBy: 'BULL_UP' | 'SHOOTOUT' | 'MANUAL' | 'COIN_TOSS' }> = {
  VIRTUAL_COIN_TOSS: { title: 'Virtual coin toss', resolvedBy: 'COIN_TOSS' },
  CLOSEST_TO_BULL_1P: { title: 'Bull-up winner (1 player each)', resolvedBy: 'BULL_UP' },
  CLOSEST_TO_BULL_2P: { title: 'Bull-up winner (2 players each)', resolvedBy: 'BULL_UP' },
  HIGH_SCORE_2DART_SHOOTOUT: { title: '2-dart shootout winner', resolvedBy: 'SHOOTOUT' },
  MANUAL_CHOICE: { title: 'Who throws first?', resolvedBy: 'MANUAL' },
};

function ruleText(state: TournamentState, view: MatchView): string {
  const setup = view.setup;
  if (!setup) return '';
  if (setup.method === 'ALTERNATE') return 'Starter alternates each leg';
  const prefix = setup.method === 'DECIDER' ? 'Deciding leg — rule re-applied: ' : 'Rule: ';
  const rules = state.settings.rules;
  const base = FIRST_THROW_LABEL[rules.firstThrowRule];
  return prefix + (rules.firstThrowRule === 'LOWER_SEED_FIRST' && setup.decision ? `${base} (tie: ${TIEBREAK_LABEL[rules.firstThrowTiebreak]})` : base);
}

/** Pre-leg starting team + player order. Editable only while no dart has been thrown in the leg. */
export function LegStartPanel({ state, view, compact = false }: { state: TournamentState; view: MatchView; compact?: boolean }) {
  const dispatch = useDispatch();
  const { transport } = useTransportContext();
  const setup = view.setup;
  if (!setup || view.dartsThrownInLeg > 0) return null;
  const legIndex = view.currentLegIndex;
  const sides: Side[] = ['home', 'away'];
  const name = (s: Side) => teamName(state, view.teamIds[s]);

  if (!setup.firstTeam && setup.decision) {
    const prompt = DECISION_PROMPT[setup.decision];
    return (
      <div className="space-y-3 rounded-lg border border-accent-gold/50 bg-accent-gold/5 p-4">
        <p className="text-xs text-text-muted">{ruleText(state, view)}</p>
        <p className="font-display text-lg tracking-wide uppercase">{prompt.title}</p>
        {setup.decision === 'VIRTUAL_COIN_TOSS' ? (
          <Button size="lg" variant="gold" icon={Coins} className="w-full" onClick={() => void runCoinToss(transport, legIndex)}>
            Flip Coin on Stage
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {sides.map((s) => (
              <Button
                key={s}
                size="lg"
                icon={Crosshair}
                onClick={() =>
                  void dispatch({ type: 'SET_LEG_START', legIndex, firstTeam: s, resolvedBy: prompt.resolvedBy as 'BULL_UP' | 'SHOOTOUT' | 'MANUAL' }, { persist: 'immediate' })
                }
              >
                <span className="truncate">{name(s)}</span>
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const overridden = isSetupOverridden(setup);
  return (
    <div className={`space-y-3 rounded-lg border border-border-subtle bg-bg-elevated/40 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-sm tracking-widest uppercase">Leg {legIndex + 1} — starting order</p>
        <p className="text-xs text-text-muted">
          {ruleText(state, view)}
          {setup.resolvedBy && setup.resolvedBy !== 'AUTO' ? ` · decided by ${setup.resolvedBy.replace('_', '-').toLowerCase()}` : ''}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Team throwing first">
        {sides.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={setup.firstTeam === s}
            onClick={() => setup.firstTeam !== s && void dispatch({ type: 'SET_LEG_START', legIndex, firstTeam: s }, { persist: 'immediate' })}
            className={`min-h-12 truncate rounded-md border px-3 font-semibold transition ${
              setup.firstTeam === s ? 'border-accent-gold bg-accent-gold text-text-inverse' : 'border-border-subtle bg-bg-primary text-text-muted'
            }`}
          >
            {name(s)} {setup.firstTeam === s ? 'throws first' : ''}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {sides.map((s) => {
          const players = playersOfTeam(state, view.teamIds[s]);
          if (players.length < 2) return <span key={s} />;
          return (
            <div key={s} className="flex flex-wrap gap-1" role="radiogroup" aria-label={`First player for ${name(s)}`}>
              {players.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={setup.firstPlayer[s] === i}
                  onClick={() => void dispatch({ type: 'SET_LEG_START', legIndex, firstPlayer: { [s]: i } }, { persist: 'immediate' })}
                  className={`min-h-10 max-w-full truncate rounded-full border px-3 text-sm ${
                    setup.firstPlayer[s] === i ? 'border-accent-gold text-accent-gold' : 'border-border-subtle text-text-muted'
                  }`}
                >
                  P{i + 1} {p.name}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {overridden && (
        <Notice tone="warning">
          <span className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            Manual Override: Starting order changed from tournament rule — ensure both teams agree before Dart 1
          </span>
        </Notice>
      )}
    </div>
  );
}
