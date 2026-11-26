import { usePlayerLabel } from '../hooks/PlayerNames.tsx';
import { describeSlot, matchLabel, playersOfSlot } from '../engine/selectors.ts';
import type { TournamentState } from '../engine/state.ts';
import type { Match, TeamSlot } from '../engine/types.ts';
import { resolveSlot } from '../engine/standings.ts';
import { Avatar, TeamLogo } from './ui.tsx';

function Side({ state, slot, size, align }: { state: TournamentState; slot: TeamSlot; size: 'md' | 'xl'; align: 'start' | 'end' }) {
  const label = usePlayerLabel(state);
  const players = playersOfSlot(state, slot);
  const xl = size === 'xl';
  const teamId = resolveSlot(state, slot);
  const team = teamId ? state.teams.find((t) => t.id === teamId) : undefined;
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-3 ${align === 'end' ? 'items-end text-right' : 'items-start text-left'}`}>
      {team?.logoDataUrl && <TeamLogo name={team.name} src={team.logoDataUrl} size={xl ? 128 : 40} />}
      <p className={`max-w-full truncate font-display font-bold uppercase ${xl ? 'text-5xl' : 'text-xl'}`}>{describeSlot(state, slot)}</p>
      <div className={`flex flex-wrap gap-3 ${align === 'end' ? 'justify-end' : ''}`}>
        {players.map((p) => (
          <div key={p.id} className="flex flex-col items-center gap-1">
            <Avatar name={p.name} src={p.avatarDataUrl} size={xl ? 112 : 48} />
            <span className={`truncate ${xl ? 'max-w-48 text-xl' : 'max-w-28 text-xs'} text-text-muted`}>{label(p)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Face-off graphic: Team A vs Team B with player photos beneath each name. */
export function Matchup({ state, match, size = 'md' }: { state: TournamentState; match: Match; size?: 'md' | 'xl' }) {
  const xl = size === 'xl';
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className={`font-display tracking-[0.3em] text-accent-gold uppercase ${xl ? 'text-2xl' : 'text-xs'}`}>
        {matchLabel(state, match)} · {match.format}
      </p>
      <div className="flex w-full items-center gap-4">
        <Side state={state} slot={match.home} size={size} align="end" />
        <span className={`shrink-0 font-display font-bold text-accent-primary ${xl ? 'text-6xl' : 'text-2xl'}`}>VS</span>
        <Side state={state} slot={match.away} size={size} align="start" />
      </div>
    </div>
  );
}
