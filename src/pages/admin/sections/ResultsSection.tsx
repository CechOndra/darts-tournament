import { Trophy } from 'lucide-react';
import { qualifiersPerGroup, StandingsTable } from '../../../components/match/StandingsTable.tsx';
import { replayStoredMatch } from '../../../engine/match.ts';
import { matchLabel, matchNumber, teamName } from '../../../engine/selectors.ts';
import { allGroupStandings, matchTeams } from '../../../engine/standings.ts';
import type { TournamentState } from '../../../engine/state.ts';
import type { Match, Side } from '../../../engine/types.ts';

function ResultRow({ state, match }: { state: TournamentState; match: Match }) {
  const ids = matchTeams(state, match);
  if (!ids.home || !ids.away) return null;
  const teamIds = { home: ids.home, away: ids.away };
  const replay = replayStoredMatch(state, match, teamIds);
  const side = (s: Side) => {
    const won = match.winnerTeamId === teamIds[s];
    const st = replay.stats[s];
    return (
      <div className={`flex min-w-0 flex-1 flex-col ${s === 'home' ? 'items-end text-right' : 'items-start text-left'}`}>
        <span className={`max-w-full truncate ${won ? 'font-semibold text-text-primary' : 'text-text-muted'}`}>
          {won && s === 'away' && <Trophy size={13} className="mr-1 inline align-[-1px] text-accent-gold" aria-hidden />}
          {teamName(state, teamIds[s])}
          {won && s === 'home' && <Trophy size={13} className="ml-1 inline align-[-1px] text-accent-gold" aria-hidden />}
        </span>
        <span className="text-xs text-text-muted">
          Avg {st.average.toFixed(1)} · High {st.highestVisit}
          {st.bonusPoints > 0 && ` · +${st.bonusPoints} bonus`}
        </span>
      </div>
    );
  };
  return (
    <li className="surface-elevated p-3">
      <p className="mb-1 text-xs text-text-muted">
        M{matchNumber(state, match.id)} · {matchLabel(state, match)} · {match.format}
      </p>
      <div className="flex items-center gap-3">
        {side('home')}
        <span className="shrink-0 rounded bg-bg-primary px-3 py-1 font-display text-xl font-bold tabular-nums">
          {match.legsWon.home} - {match.legsWon.away}
        </span>
        {side('away')}
      </div>
    </li>
  );
}

/** Admin: group tables plus every completed match, newest first. */
export function ResultsSection({ state }: { state: TournamentState }) {
  const tables = allGroupStandings(state);
  const completed = [...state.completedOrder]
    .reverse()
    .map((id) => state.matches.find((m) => m.id === id))
    .filter((m): m is Match => !!m && m.status === 'COMPLETED');

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <div className="space-y-3">
        <h3 className="font-display text-sm tracking-widest text-text-muted uppercase">Standings</h3>
        {tables.length ? (
          tables.map((rows, g) => <StandingsTable key={g} state={state} rows={rows} groupIndex={g} qualify={qualifiersPerGroup(state)} />)
        ) : (
          <p className="text-sm text-text-muted">No group stage in this format. The playoff bracket view arrives in Milestone 5.</p>
        )}
      </div>
      <div className="space-y-3">
        <h3 className="font-display text-sm tracking-widest text-text-muted uppercase">Results ({completed.length})</h3>
        {completed.length ? (
          <ol className="space-y-2">
            {completed.map((m) => (
              <ResultRow key={m.id} state={state} match={m} />
            ))}
          </ol>
        ) : (
          <p className="text-sm text-text-muted">No matches finished yet.</p>
        )}
      </div>
    </div>
  );
}
