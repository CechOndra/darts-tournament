import { CalendarClock, Layers, Radio, Trophy, Volume2, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Matchup } from '../components/Matchup.tsx';
import { NoTournament } from '../components/NoTournament.tsx';
import { Placeholder } from '../components/RouteHeader.tsx';
import { ConnectionBadge } from '../components/StatusIndicators.tsx';
import { describeSlot, matchLabel, matchNumber, queuedMatches, upNextMatch } from '../engine/selectors.ts';
import type { TournamentState } from '../engine/state.ts';
import { useLiveTournamentId } from '../hooks/ControlProvider.tsx';
import { TournamentScope, useTournamentState } from '../hooks/TransportProvider.tsx';
import { usePresenceRole } from '../hooks/useTransport.ts';

type Tab = 'live' | 'schedule' | 'standings' | 'cards' | 'sound';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'live', label: 'Live', icon: Radio },
  { id: 'schedule', label: 'Schedule', icon: CalendarClock },
  { id: 'standings', label: 'Standings', icon: Trophy },
  { id: 'cards', label: 'Cards', icon: Layers },
  { id: 'sound', label: 'Sound', icon: Volume2 },
];

export function GuestPage() {
  const id = useLiveTournamentId();
  if (id === undefined) return <NoTournament loading />;
  if (id === null) return <NoTournament />;
  return (
    <TournamentScope tournamentId={id}>
      <GuestView />
    </TournamentScope>
  );
}

function ScheduleList({ state }: { state: TournamentState }) {
  const queue = queuedMatches(state);
  return (
    <ol className="space-y-2">
      {queue.map((m) => (
        <li key={m.id} className="surface flex items-center gap-3 p-3">
          <span className="w-9 shrink-0 font-mono text-xs text-text-muted">M{matchNumber(state, m.id)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {describeSlot(state, m.home)} <span className="text-text-muted">vs</span> {describeSlot(state, m.away)}
            </p>
            <p className="truncate text-xs text-text-muted">{matchLabel(state, m)} · {m.format}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** iPhone-first (390–430 px) guest companion with safe-area aware bottom tabs. */
function GuestView() {
  usePresenceRole('guest');
  const state = useTournamentState();
  const [tab, setTab] = useState<Tab>('live');
  const active = TABS.find((t) => t.id === tab) ?? TABS[0]!;
  if (!state) return <NoTournament message="The live tournament could not be loaded." />;
  const next = upNextMatch(state);

  return (
    <div className="touch-route flex min-h-dvh flex-col bg-bg-primary">
      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border-subtle bg-bg-surface px-4 pb-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <h1 className="min-w-0 truncate font-display text-lg font-semibold tracking-wide uppercase">{state.meta?.name}</h1>
        <ConnectionBadge />
      </header>

      <main className="flex-1 space-y-4 p-4 pb-28">
        <h2 className="font-display text-sm tracking-widest text-text-muted uppercase">{active.label}</h2>
        {tab === 'live' && (
          <div className="surface p-4">
            {next ? <Matchup state={state} match={next} /> : <p className="text-center text-text-muted">All matches complete.</p>}
          </div>
        )}
        {tab === 'schedule' && <ScheduleList state={state} />}
        {tab !== 'live' && tab !== 'schedule' && (
          <Placeholder milestone={5}>The {active.label.toLowerCase()} view arrives in Milestone 5.</Placeholder>
        )}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-border-subtle bg-bg-surface"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Guest sections"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`touch-target flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium ${tab === id ? 'text-accent-gold' : 'text-text-muted'}`}
            aria-current={tab === id ? 'page' : undefined}
          >
            <Icon size={20} aria-hidden />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
