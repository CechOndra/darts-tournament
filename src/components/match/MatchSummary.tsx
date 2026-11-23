import { Trophy } from 'lucide-react';
import type { MatchView } from '../../engine/match.ts';
import { matchLabel, teamName } from '../../engine/selectors.ts';
import type { TournamentState } from '../../engine/state.ts';
import type { Side } from '../../engine/types.ts';

/** Post-match result: winner, leg score and per-team averages. */
export function MatchSummary({ state, view, size = 'md' }: { state: TournamentState; view: MatchView; size?: 'md' | 'xl' }) {
  const xl = size === 'xl';
  const winner = view.winner;
  const row = (label: string, f: (s: Side) => string) => (
    <tr className="border-t border-border-subtle">
      <td className="py-1.5 text-center font-mono tabular-nums">{f('home')}</td>
      <td className="px-4 py-1.5 text-center text-text-muted">{label}</td>
      <td className="py-1.5 text-center font-mono tabular-nums">{f('away')}</td>
    </tr>
  );
  return (
    <div className="flex w-full flex-col items-center gap-4 text-center">
      <p className={`font-display tracking-[0.3em] text-text-muted uppercase ${xl ? 'text-2xl' : 'text-xs'}`}>{matchLabel(state, view.match)} · Final</p>
      {winner && (
        <div className="flex items-center gap-3">
          <Trophy size={xl ? 64 : 28} className="text-accent-gold" aria-hidden />
          <p className={`font-display font-bold text-accent-gold uppercase ${xl ? 'text-7xl' : 'text-3xl'}`}>{teamName(state, view.teamIds[winner])} wins</p>
        </div>
      )}
      <p className={`font-display font-bold tabular-nums ${xl ? 'text-8xl' : 'text-5xl'}`}>
        {view.legsWon.home} – {view.legsWon.away}
      </p>
      <table className={`w-full table-fixed ${xl ? 'max-w-5xl text-3xl' : 'max-w-md text-sm'}`}>
        <thead>
          <tr>
            <th className="w-[38%] truncate pb-2 text-center font-display uppercase">{teamName(state, view.teamIds.home)}</th>
            <th className="w-[24%]" />
            <th className="w-[38%] truncate pb-2 text-center font-display uppercase">{teamName(state, view.teamIds.away)}</th>
          </tr>
        </thead>
        <tbody>
          {row('3-dart avg', (s) => view.stats[s].average.toFixed(2))}
          {row('High visit', (s) => String(view.stats[s].highestVisit))}
          {row('Darts', (s) => String(view.stats[s].darts))}
          {(view.stats.home.bonusPoints > 0 || view.stats.away.bonusPoints > 0) && row('Bonus pts', (s) => String(view.stats[s].bonusPoints))}
        </tbody>
      </table>
    </div>
  );
}
