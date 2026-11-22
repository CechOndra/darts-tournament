import { CalendarClock, Coffee, Layers, Radio, Trophy, Volume2, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { ActiveEffects } from '../components/cards/ActiveEffects.tsx';
import { CardIcon, RARITY_VAR } from '../components/cards/PowerCard.tsx';
import { CheckoutRoutes } from '../components/match/CheckoutRoutes.tsx';
import { CARD_BY_ID, CARD_TYPES, RARITY_LABEL } from '../engine/cardCatalog.ts';
import { handOf } from '../engine/cardPool.ts';
import { useRarityOf } from '../hooks/useCardLook.ts';
import { DutyBanner } from '../components/match/DutyBanner.tsx';
import { MatchSummary } from '../components/match/MatchSummary.tsx';
import { Scoreboard } from '../components/match/Scoreboard.tsx';
import { qualifiersPerGroup, StandingsTable } from '../components/match/StandingsTable.tsx';
import { Matchup } from '../components/Matchup.tsx';
import { allGroupStandings } from '../engine/standings.ts';
import { useDuty, useMatchView } from '../hooks/useMatch.ts';
import { NoTournament } from '../components/NoTournament.tsx';
import { Placeholder } from '../components/RouteHeader.tsx';
import { ConnectionBadge } from '../components/StatusIndicators.tsx';
import { describeSlot, matchLabel, matchNumber, queuedMatches, upNextMatch } from '../engine/selectors.ts';
import type { TournamentState } from '../engine/state.ts';
import type { ScheduledBreak } from '../engine/types.ts';
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

function GuestCards({ state }: { state: TournamentState }) {
  const rarityOf = useRarityOf();
  if (state.settings.cards.mode === 'OFF') return <p className="text-sm text-text-muted">Power Cards are off for this tournament.</p>;
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {state.teams.map((t) => {
          const hand = handOf(state.cards, t.id);
          return (
            <li key={t.id} className="surface p-3">
              <p className="mb-2 truncate text-sm font-semibold">{t.name}</p>
              {hand.length === 0 ? (
                <p className="text-xs text-text-muted">No cards</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {hand.map((i) => (
                    <span key={i.instanceId} className="inline-flex items-center gap-1.5 rounded-md border-2 bg-bg-elevated px-2 py-1 text-xs font-semibold" style={{ borderColor: RARITY_VAR[rarityOf(i.cardTypeId)] }}>
                      <span style={{ color: RARITY_VAR[rarityOf(i.cardTypeId)] }}>
                        <CardIcon id={i.cardTypeId} size={14} />
                      </span>
                      {CARD_BY_ID[i.cardTypeId].name}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <details className="surface p-3">
        <summary className="cursor-pointer text-sm font-medium">What every card does</summary>
        <ul className="mt-3 space-y-3">
          {CARD_TYPES.filter((c) => state.settings.cards.config[c.id]?.enabled !== false).map((c) => (
            <li key={c.id} className="flex gap-3">
              <span className="mt-0.5 shrink-0" style={{ color: RARITY_VAR[rarityOf(c.id)] }}>
                <CardIcon id={c.id} size={20} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  {c.name} <span className="text-xs font-normal text-text-muted">{RARITY_LABEL[rarityOf(c.id)]}</span>
                </span>
                <span className="block text-xs text-text-muted">{c.rules}</span>
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function BreakRow({ b }: { b: ScheduledBreak }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-dashed border-accent-gold/50 px-3 py-2 text-sm text-accent-gold">
      <Coffee size={16} aria-hidden className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{b.name}</span>
      {b.durationMinutes && <span className="shrink-0 text-xs">{b.durationMinutes} min</span>}
    </div>
  );
}

const visibleBreaks = (state: TournamentState, matchId: string) =>
  state.settings.visibility.showBreaksToGuests ? state.breaks.filter((b) => b.afterMatchId === matchId && !b.completed) : [];

function ScheduleList({ state }: { state: TournamentState }) {
  const queue = queuedMatches(state);
  return (
    <ol className="space-y-2">
      {queue.map((m) => (
        <li key={m.id} className="space-y-2">
          <div className="surface flex items-center gap-3 p-3">
            <span className="w-9 shrink-0 font-mono text-xs text-text-muted">M{matchNumber(state, m.id)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {describeSlot(state, m.home)} <span className="text-text-muted">vs</span> {describeSlot(state, m.away)}
              </p>
              <p className="truncate text-xs text-text-muted">{matchLabel(state, m)} · {m.format}</p>
            </div>
          </div>
          {visibleBreaks(state, m.id).map((b) => (
            <BreakRow key={b.id} b={b} />
          ))}
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
  const view = useMatchView(state);
  const { duty, next: dutyMatch } = useDuty(state);
  if (!state) return <NoTournament message="The live tournament could not be loaded." />;
  const next = upNextMatch(state);
  const phase = state.live?.phase ?? 'UP_NEXT';
  const tables = allGroupStandings(state);

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
          <div className="space-y-3">
            <div className="surface space-y-3 p-3">
              {phase === 'IN_PROGRESS' && view ? (
                <>
                  <Scoreboard state={state} view={view} />
                  <ActiveEffects state={state} view={view} />
                  <CheckoutRoutes state={state} view={view} />
                </>
              ) : phase === 'POST_MATCH' && view ? (
                <MatchSummary state={state} view={view} />
              ) : view ? (
                <Matchup state={state} match={view.match} />
              ) : next ? (
                <Matchup state={state} match={next} />
              ) : (
                <p className="text-center text-text-muted">All matches complete.</p>
              )}
            </div>
            <DutyBanner state={state} duty={duty} match={dutyMatch} />
            {(view?.match ?? next) &&
              visibleBreaks(state, (view?.match ?? next)!.id).map((b) => (
                <div key={b.id} className="space-y-1">
                  <p className="text-xs tracking-wide text-text-muted uppercase">After this match</p>
                  <BreakRow b={b} />
                </div>
              ))}
          </div>
        )}
        {tab === 'schedule' && <ScheduleList state={state} />}
        {tab === 'standings' &&
          (tables.length ? (
            tables.map((rows, g) => <StandingsTable key={g} state={state} rows={rows} groupIndex={g} qualify={qualifiersPerGroup(state)} />)
          ) : (
            <Placeholder milestone={5}>Playoff bracket view arrives in Milestone 5.</Placeholder>
          ))}
        {tab === 'cards' && <GuestCards state={state} />}
        {tab === 'sound' && (
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
