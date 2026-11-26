import { usePlayerLabel } from '../hooks/PlayerNames.tsx';
import { describeSlot, matchLabel, playersOfSlot } from '../engine/selectors.ts';
import type { TournamentState } from '../engine/state.ts';
import type { Match, TeamSlot } from '../engine/types.ts';
import { resolveSlot } from '../engine/standings.ts';
import { Avatar, TeamLogo } from './ui.tsx';

/** Stage version: logo and name on top, the team's player photos standing at the bottom (left team bottom-left, right team bottom-right). */
function SideXl({ state, slot, align }: { state: TournamentState; slot: TeamSlot; align: 'start' | 'end' }) {
  const label = usePlayerLabel(state);
  const players = playersOfSlot(state, slot);
  const teamId = resolveSlot(state, slot);
  const team = teamId ? state.teams.find((t) => t.id === teamId) : undefined;
  const title = describeSlot(state, slot);
  const end = align === 'end';
  const tall = players.length > 2 ? 'h-52' : 'h-64';
  return (
    <div className={`flex min-w-0 flex-1 flex-col justify-between gap-6 ${end ? 'items-end text-right' : 'items-start text-left'}`}>
      <div className={`flex max-w-full flex-col gap-4 ${end ? 'items-end' : 'items-start'}`}>
        {team?.logoDataUrl && <TeamLogo name={team.name} src={team.logoDataUrl} size={160} />}
        <p className={`max-w-full truncate font-display font-bold uppercase ${title.length > 20 ? 'text-4xl' : 'text-5xl'}`}>{title}</p>
      </div>
      <div className={`flex w-full items-end gap-5 ${end ? 'justify-end' : ''}`}>
        {players.map((p) => (
          <figure key={p.id} className="flex min-w-0 flex-col items-center gap-2">
            {p.futPhotoDataUrl ? (
              <img src={p.futPhotoDataUrl} alt={p.name} className={`${tall} w-auto max-w-full rounded-xl object-contain object-bottom`} />
            ) : (
              <Avatar name={p.name} src={p.avatarDataUrl} size={players.length > 2 ? 190 : 230} />
            )}
            <figcaption className="max-w-60 truncate font-display text-2xl tracking-wide text-text-muted uppercase">{label(p)}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function Side({ state, slot, align }: { state: TournamentState; slot: TeamSlot; align: 'start' | 'end' }) {
  const label = usePlayerLabel(state);
  const players = playersOfSlot(state, slot);
  const teamId = resolveSlot(state, slot);
  const team = teamId ? state.teams.find((t) => t.id === teamId) : undefined;
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-3 ${align === 'end' ? 'items-end text-right' : 'items-start text-left'}`}>
      {team?.logoDataUrl && <TeamLogo name={team.name} src={team.logoDataUrl} size={40} />}
      <p className="max-w-full truncate font-display text-xl font-bold uppercase">{describeSlot(state, slot)}</p>
      <div className={`flex flex-wrap gap-3 ${align === 'end' ? 'justify-end' : ''}`}>
        {players.map((p) => (
          <div key={p.id} className="flex flex-col items-center gap-1">
            <Avatar name={p.name} src={p.avatarDataUrl} size={48} />
            <span className="max-w-28 truncate text-xs text-text-muted">{label(p)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Face-off graphic: Team A vs Team B with player photos. size xl = the stage. */
export function Matchup({ state, match, size = 'md' }: { state: TournamentState; match: Match; size?: 'md' | 'xl' }) {
  if (size === 'xl') {
    return (
      <div className="flex w-full flex-col items-center gap-6">
        <p className="font-display text-3xl tracking-[0.3em] text-accent-gold uppercase">
          {matchLabel(state, match)} · {match.format}
        </p>
        <div className="flex w-full items-stretch gap-8">
          <SideXl state={state} slot={match.home} align="start" />
          <span className="flex shrink-0 items-center font-display text-7xl font-bold text-accent-primary">VS</span>
          <SideXl state={state} slot={match.away} align="end" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="font-display text-xs tracking-[0.3em] text-accent-gold uppercase">
        {matchLabel(state, match)} · {match.format}
      </p>
      <div className="flex w-full items-center gap-4">
        <Side state={state} slot={match.home} align="end" />
        <span className="shrink-0 font-display text-2xl font-bold text-accent-primary">VS</span>
        <Side state={state} slot={match.away} align="start" />
      </div>
    </div>
  );
}
