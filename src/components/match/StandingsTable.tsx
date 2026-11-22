import { groupLabel, teamName } from '../../engine/selectors.ts';
import type { StandingRow } from '../../engine/standings.ts';
import type { TournamentState } from '../../engine/state.ts';

/** Group table (W, L, bonus, legs, average). `qualify` highlights playoff places. */
export function StandingsTable({ state, rows, groupIndex, qualify = 0, size = 'md' }: { state: TournamentState; rows: StandingRow[]; groupIndex: number; qualify?: number; size?: 'md' | 'xl' }) {
  const xl = size === 'xl';
  const showBonus = state.settings.rules.specialRules.doubleCheckoutBonus.enabled || state.settings.rules.specialRules.tripleCheckoutBonus.enabled;
  const cell = xl ? 'px-4 py-3' : 'px-2 py-1.5';
  return (
    <div className="surface overflow-hidden">
      {state.settings.structure.groupCount > 1 && (
        <p className={`border-b border-border-subtle font-display tracking-widest text-accent-gold uppercase ${xl ? 'px-4 py-3 text-2xl' : 'px-3 py-2 text-xs'}`}>
          {groupLabel(groupIndex)}
        </p>
      )}
      <table className={`w-full ${xl ? 'text-2xl' : 'text-sm'}`}>
        <thead className="text-text-muted">
          <tr className="text-left">
            <th className={`${cell} w-8 font-normal`}>#</th>
            <th className={`${cell} font-normal`}>Team</th>
            <th className={`${cell} text-right font-normal`}>W</th>
            <th className={`${cell} text-right font-normal`}>L</th>
            {showBonus && <th className={`${cell} text-right font-normal`}>Bonus</th>}
            <th className={`${cell} text-right font-normal`}>Legs</th>
            <th className={`${cell} text-right font-normal`}>Avg</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.teamId} className={`border-t border-border-subtle ${r.rank <= qualify ? 'bg-accent-success/5' : ''}`}>
              <td className={`${cell} font-mono ${r.rank <= qualify ? 'text-accent-success' : 'text-text-muted'}`}>{r.rank}</td>
              <td className={`${cell} max-w-0 truncate font-medium`}>{teamName(state, r.teamId)}</td>
              <td className={`${cell} text-right font-mono`}>{r.wins}</td>
              <td className={`${cell} text-right font-mono text-text-muted`}>{r.losses}</td>
              {showBonus && <td className={`${cell} text-right font-mono`}>{r.bonusPoints}</td>}
              <td className={`${cell} text-right font-mono`}>
                {r.legDiff > 0 ? '+' : ''}
                {r.legDiff}
              </td>
              <td className={`${cell} text-right font-mono`}>{r.average.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Playoff places per group (for highlighting). */
export function qualifiersPerGroup(state: TournamentState): number {
  const s = state.settings.structure;
  if (s.mode !== 'GROUPS_AND_PLAYOFFS') return 0;
  return Math.ceil(s.playoff.bracketSize / Math.max(1, s.groupCount));
}
