import type { MatchView } from '../../engine/match.ts';
import { dartLabel } from '../../engine/scoring.ts';
import { playersOfTeam, teamName } from '../../engine/selectors.ts';
import type { TournamentState } from '../../engine/state.ts';
import type { Side } from '../../engine/types.ts';
import { Avatar } from '../ui.tsx';

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

function TeamPanel({ state, view, side, size }: { state: TournamentState; view: MatchView; side: Side; size: Size }) {
  const teamId = view.teamIds[side];
  const active = view.turn?.side === side;
  const players = playersOfTeam(state, teamId);
  const remaining = view.turn?.side === side ? view.turn.remaining : view.currentLeg.remaining[side];
  const xl = size === 'xl';
  const lastVisit = [...view.currentLeg.visits].reverse().find((v) => v.side === side && v.complete);
  const won = view.winner === side;

  return (
    <div
      className={`flex min-w-0 flex-1 flex-col gap-3 rounded-lg border p-4 transition ${
        active ? 'border-accent-gold bg-accent-gold/5 shadow-[0_0_0_1px_var(--accent-gold)]' : won ? 'border-accent-success' : 'border-border-subtle bg-bg-elevated/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`min-w-0 truncate font-display font-bold uppercase ${xl ? 'text-4xl' : 'text-xl'}`}>{teamName(state, teamId)}</p>
        <span className={`shrink-0 font-display font-bold text-accent-gold ${xl ? 'text-4xl' : 'text-xl'}`}>{view.legsWon[side]}</span>
      </div>
      <LegPips won={view.legsWon[side]} target={view.legsToWin} size={size} />
      <p className={`font-display leading-none font-bold tabular-nums ${xl ? 'text-[9rem]' : 'text-6xl'} ${active ? 'text-text-primary' : 'text-text-muted'}`}>
        {remaining}
      </p>
      <div className="flex flex-wrap gap-3">
        {players.map((p) => {
          const throwing = active && view.turn?.playerId === p.id;
          return (
            <div key={p.id} className={`flex items-center gap-2 rounded-full pr-3 ${throwing ? 'bg-accent-gold/15 ring-2 ring-accent-gold' : ''}`}>
              <Avatar name={p.name} src={p.avatarDataUrl} size={xl ? 64 : 36} />
              <span className={`max-w-32 truncate ${xl ? 'text-2xl' : 'text-sm'} ${throwing ? 'font-semibold text-text-primary' : 'text-text-muted'}`}>{p.name}</span>
            </div>
          );
        })}
      </div>
      <div className={`flex flex-wrap gap-x-4 gap-y-1 text-text-muted ${xl ? 'text-xl' : 'text-xs'}`}>
        <span>Avg {view.stats[side].average.toFixed(2)}</span>
        {lastVisit && <span>Last {lastVisit.bust ? 'BUST' : lastVisit.scored}</span>}
        <span>Darts {view.currentLeg.dartsBySide[side]}</span>
      </div>
    </div>
  );
}

export function Scoreboard({ state, view, size = 'md' }: { state: TournamentState; view: MatchView; size?: Size }) {
  return (
    <div className="flex w-full gap-3">
      <TeamPanel state={state} view={view} side="home" size={size} />
      <TeamPanel state={state} view={view} side="away" size={size} />
    </div>
  );
}
