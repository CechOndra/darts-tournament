import { displayName } from '../../engine/selectors.ts';
import { Award as AwardIcon, Trophy, Users } from 'lucide-react';
import { formatAwardValue, type Award } from '../../engine/awards.ts';
import type { TournamentState } from '../../engine/state.ts';
import { Avatar, TeamLogo } from '../ui.tsx';

export function awardWinnerName(state: TournamentState, award: Award, id: string): string {
  if (award.kind === 'TEAM') return state.teams.find((t) => t.id === id)?.name ?? id;
  const p = state.players[id];
  const team = p ? state.teams.find((t) => t.id === p.teamId)?.name : '';
  return p ? `${displayName(p)}${team ? ` (${team})` : ''}` : id;
}

/** One award with its winner(s). size xl = stage spotlight. */
export function AwardCard({ state, award, size = 'md', children }: { state: TournamentState; award: Award; size?: 'md' | 'xl'; children?: React.ReactNode }) {
  const xl = size === 'xl';
  const Icon = award.kind === 'TEAM' ? Users : AwardIcon;
  return (
    <div className={`surface flex flex-col gap-3 ${xl ? 'items-center gap-8 p-12 text-center' : 'p-4'}`}>
      <div className={`flex items-center gap-2 ${xl ? 'flex-col gap-4' : ''}`}>
        <Trophy size={xl ? 96 : 18} className="shrink-0 text-accent-gold" aria-hidden />
        <div className="min-w-0">
          <p className={`font-display font-bold tracking-wide uppercase ${xl ? 'text-7xl' : 'text-base'}`}>{award.title}</p>
          <p className={`text-text-muted ${xl ? 'text-2xl' : 'text-xs'}`}>{award.description}</p>
        </div>
      </div>
      {award.winners.length === 0 ? (
        <p className={`text-text-muted ${xl ? 'text-3xl' : 'text-sm'}`}>No winner yet.</p>
      ) : (
        <ul className={`space-y-2 ${xl ? 'space-y-6' : ''}`}>
          {award.winners.map((w) => {
            const team = award.kind === 'TEAM' ? state.teams.find((t) => t.id === w.id) : null;
            const player = award.kind === 'PLAYER' ? state.players[w.id] : null;
            return (
              <li key={w.id} className={`flex items-center gap-3 ${xl ? 'flex-col gap-4' : ''}`}>
                {team?.logoDataUrl && <TeamLogo name={team.name} src={team.logoDataUrl} size={xl ? 140 : 32} />}
                {award.kind === 'TEAM' && !team?.logoDataUrl && <Icon size={xl ? 72 : 18} className="shrink-0 text-accent-gold" aria-hidden />}
                {player && <Avatar name={player.name} src={player.avatarDataUrl} size={xl ? 160 : 32} />}
                <span className={`min-w-0 font-semibold ${xl ? 'font-display text-6xl uppercase' : 'truncate text-sm'}`}>{awardWinnerName(state, award, w.id)}</span>
                <span className={`font-mono text-accent-gold ${xl ? 'text-4xl' : 'ml-auto shrink-0 text-xs'}`}>{formatAwardValue(award.id, w.value)}</span>
              </li>
            );
          })}
        </ul>
      )}
      {children}
    </div>
  );
}
