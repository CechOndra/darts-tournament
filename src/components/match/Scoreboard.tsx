import type { MatchView, VisitView } from '../../engine/match.ts';
import { dartLabel } from '../../engine/scoring.ts';
import { playersOfTeam, teamName } from '../../engine/selectors.ts';
import { usePlayerLabel } from '../../hooks/PlayerNames.tsx';
import type { TournamentState } from '../../engine/state.ts';
import type { Side } from '../../engine/types.ts';
import { Avatar, TeamLogo } from '../ui.tsx';

type Size = 'md' | 'xl';

function LegPips({ won, target, size }: { won: number; target: number; size: Size }) {
  if (target <= 1) return null;
  const dim = size === 'xl' ? 'h-5 w-5' : 'h-3 w-3';
  return (
    <div className="flex gap-1.5" aria-label={`${won} of ${target} legs`}>
      {Array.from({ length: target }, (_, i) => (
        <span key={i} className={`${dim} rounded-full border-2 ${i < won ? 'border-accent-gold bg-accent-gold' : 'border-border-strong'}`} />
      ))}
    </div>
  );
}

export function VisitSlots({ view, size }: { view: MatchView; size: Size }) {
  const turn = view.turn;
  if (!turn) return null;
  const big = size === 'xl';
  return (
    <div className="flex gap-2">
      {Array.from({ length: turn.maxDarts }, (_, i) => {
        const d = turn.darts[i];
        return (
          <span
            key={i}
            className={`flex items-center justify-center rounded-md border font-mono font-bold ${big ? 'h-16 w-28 text-3xl' : 'h-10 w-16 text-lg'} ${
              d ? 'border-accent-gold/70 bg-accent-gold/10 text-text-primary' : 'border-dashed border-border-strong text-text-muted'
            }`}
          >
            {d ? dartLabel(d) : i + 1}
          </span>
        );
      })}
    </div>
  );
}

/** Every completed visit of the current leg for one side, newest first. */
function VisitHistory({ state, visits }: { state: TournamentState; visits: VisitView[] }) {
  const label = usePlayerLabel(state);
  if (!visits.length) return <p className="text-xl text-text-muted">No visits yet this leg.</p>;
  return (
    <ol className="min-h-0 flex-1 space-y-1.5 overflow-hidden" aria-label="Visit history">
      {visits.map((v, i) => ({ v, n: i + 1 })).reverse().map(({ v, n }) => {
        const after = v.bust ? v.scoreBefore : v.scoreBefore - v.scored;
        return (
          <li key={v.visitIndex} className="grid grid-cols-[3rem_minmax(0,1fr)_auto_6rem_5rem] items-center gap-4 rounded-md bg-bg-elevated/50 px-4 py-1.5 text-2xl">
            <span className="font-mono text-lg text-text-muted">{n}</span>
            <span className="truncate text-text-muted">{state.players[v.playerId] && label(state.players[v.playerId]!)}</span>
            <span className="font-mono text-xl text-text-muted">{v.darts.map(dartLabel).join(' ')}</span>
            <span className={`text-right font-display font-bold tabular-nums ${v.bust ? 'text-accent-danger' : v.scored >= 100 || v.checkout ? 'text-accent-gold' : ''}`}>
              {v.bust ? 'BUST' : v.scored}
            </span>
            <span className="text-right font-mono tabular-nums text-text-muted">{after}</span>
          </li>
        );
      })}
    </ol>
  );
}

function TeamPanel({ state, view, side, size, history }: { state: TournamentState; view: MatchView; side: Side; size: Size; history?: boolean }) {
  const teamId = view.teamIds[side];
  const active = view.turn?.side === side;
  const label = usePlayerLabel(state);
  const players = playersOfTeam(state, teamId);
  const remaining = view.turn?.side === side ? view.turn.remaining : view.currentLeg.remaining[side];
  const xl = size === 'xl';
  const lastVisit = [...view.currentLeg.visits].reverse().find((v) => v.side === side && v.complete);
  const won = view.winner === side;
  const team = state.teams.find((t) => t.id === teamId);
  const visits = view.currentLeg.visits.filter((v) => v.side === side && v.complete);

  return (
    <div
      className={`flex min-w-0 flex-1 flex-col gap-3 rounded-lg border p-4 transition ${xl ? 'min-h-0 gap-4 p-6' : ''} ${xl && !history ? 'justify-center' : ''} ${
        active ? 'border-accent-gold bg-accent-gold/5 shadow-[0_0_0_1px_var(--accent-gold)]' : won ? 'border-accent-success' : 'border-border-subtle bg-bg-elevated/40'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          {xl && team?.logoDataUrl && <TeamLogo name={team.name} src={team.logoDataUrl} size={88} />}
          <div className="min-w-0 space-y-2">
            <p className={`min-w-0 truncate font-display font-bold uppercase ${xl ? 'text-5xl' : 'text-xl'}`}>{teamName(state, teamId)}</p>
            <LegPips won={view.legsWon[side]} target={view.legsToWin} size={size} />
          </div>
        </div>
        <span className={`shrink-0 font-display font-bold text-accent-gold ${xl ? 'text-7xl' : 'text-xl'}`}>{view.legsWon[side]}</span>
      </div>
      <p
        className={`font-display leading-none font-bold tabular-nums ${xl ? (history ? 'text-[11rem]' : 'text-[16rem]') : 'text-6xl'} ${
          active ? 'text-text-primary' : 'text-text-muted'
        }`}
      >
        {remaining}
      </p>
      <div className="flex flex-wrap gap-3">
        {players.map((p) => {
          const throwing = active && view.turn?.playerId === p.id;
          return (
            <div key={p.id} className={`flex items-center gap-2 rounded-full pr-3 ${throwing ? 'bg-accent-gold/15 ring-2 ring-accent-gold' : ''}`}>
              <Avatar name={p.name} src={p.avatarDataUrl} size={xl ? 80 : 36} />
              <span className={`truncate ${xl ? 'max-w-60 text-3xl' : 'max-w-32 text-sm'} ${throwing ? 'font-semibold text-text-primary' : 'text-text-muted'}`}>{label(p)}</span>
            </div>
          );
        })}
      </div>
      <div className={`flex flex-wrap gap-x-4 gap-y-1 text-text-muted ${xl ? 'gap-x-8 text-2xl' : 'text-xs'}`}>
        <span>Avg {view.stats[side].average.toFixed(2)}</span>
        {xl && <span>High {view.stats[side].highestVisit}</span>}
        {lastVisit && <span>Last {lastVisit.bust ? 'BUST' : lastVisit.scored}</span>}
        <span>Darts {view.currentLeg.dartsBySide[side]}</span>
      </div>
      {xl && history && <VisitHistory state={state} visits={visits} />}
    </div>
  );
}

export function Scoreboard({
  state,
  view,
  size = 'md',
  history,
  className = '',
}: {
  state: TournamentState;
  view: MatchView;
  size?: Size;
  /** xl only: list the current leg's visits under each team. */
  history?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex w-full gap-3 ${size === 'xl' ? 'gap-6' : ''} ${className}`}>
      <TeamPanel state={state} view={view} side="home" size={size} history={history} />
      <TeamPanel state={state} view={view} side="away" size={size} history={history} />
    </div>
  );
}
