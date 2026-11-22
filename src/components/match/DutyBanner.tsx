import { ClipboardList } from 'lucide-react';
import { describeSlot, teamName } from '../../engine/selectors.ts';
import type { ScorerDuty } from '../../engine/standings.ts';
import type { TournamentState } from '../../engine/state.ts';
import type { Match } from '../../engine/types.ts';

export function dutyText(state: TournamentState, duty: ScorerDuty, match: Match | null): string {
  const who = duty.kind === 'ADMIN' ? 'Admin (Host)' : teamName(state, duty.teamId);
  if (!match) return `TABLE DUTY: ${who}`;
  const a = describeSlot(state, match.home);
  const b = describeSlot(state, match.away);
  if (duty.kind === 'ADMIN') return `TABLE DUTY: ${who} — gather ${a} & ${b}`;
  const size = state.teams.find((t) => t.id === duty.teamId)?.playerIds.length ?? 1;
  return size > 1 ? `TABLE DUTY: ${who} — 1 on Tablet • 1 gather ${a} & ${b}` : `TABLE DUTY: ${who} — on Tablet, gather ${a} & ${b}`;
}

export function DutyBanner({ state, duty, match, size = 'md' }: { state: TournamentState; duty: ScorerDuty | null; match: Match | null; size?: 'md' | 'xl' }) {
  if (!duty) return null;
  const xl = size === 'xl';
  return (
    <div className={`flex items-center gap-3 rounded-md border border-accent-gold/50 bg-accent-gold/10 px-4 py-2 font-display tracking-wide text-accent-gold uppercase ${xl ? 'text-2xl' : 'text-sm'}`}>
      <ClipboardList size={xl ? 28 : 18} aria-hidden className="shrink-0" />
      <span className="min-w-0">{dutyText(state, duty, match)}</span>
    </div>
  );
}
