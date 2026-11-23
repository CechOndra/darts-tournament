import { CalendarClock, ClipboardList, Coffee, Layers, Megaphone, Radio, Star, Trophy, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ActiveEffects } from '../components/cards/ActiveEffects.tsx';
import { CardIcon, RARITY_VAR } from '../components/cards/PowerCard.tsx';
import { AwardCard } from '../components/fut/AwardCard.tsx';
import { CheckoutRoutes } from '../components/match/CheckoutRoutes.tsx';
import { DutyBanner } from '../components/match/DutyBanner.tsx';
import { MatchSummary } from '../components/match/MatchSummary.tsx';
import { Scoreboard } from '../components/match/Scoreboard.tsx';
import { qualifiersPerGroup, StandingsTable } from '../components/match/StandingsTable.tsx';
import { Matchup } from '../components/Matchup.tsx';
import { NoTournament } from '../components/NoTournament.tsx';
import { ConnectionBadge } from '../components/StatusIndicators.tsx';
import { Select } from '../components/ui.tsx';
import { CARD_BY_ID, CARD_TYPES, RARITY_LABEL } from '../engine/cardCatalog.ts';
import { handOf } from '../engine/cardPool.ts';
import { formatClock, type MatchEta } from '../engine/pace.ts';
import { describeSlot, matchLabel, matchNumber, queuedMatches, teamName, upNextMatch } from '../engine/selectors.ts';
import { CROWD_SOUNDS, GLOBAL_COOLDOWN_MS, PHONE_COOLDOWN_MS, soundboardLock, type CrowdSound } from '../engine/soundboard.ts';
import { allGroupStandings, matchTeams } from '../engine/standings.ts';
import type { TournamentState } from '../engine/state.ts';
import type { Match, ScheduledBreak } from '../engine/types.ts';
import { useLiveTournamentId } from '../hooks/ControlProvider.tsx';
import { TournamentScope, useTournamentState, useTransportContext } from '../hooks/TransportProvider.tsx';
import { useRarityOf } from '../hooks/useCardLook.ts';
import { useDuty, useMatchView } from '../hooks/useMatch.ts';
import { useProjection, useTournamentStats } from '../hooks/useStats.ts';
import { usePresenceRole } from '../hooks/useTransport.ts';
import { CROWD_EVENT, sendCrowdSound } from '../services/soundboardOps.ts';
import { FutCardFor } from './admin/sections/AwardsSection.tsx';

type Tab = 'live' | 'schedule' | 'standings' | 'cards' | 'sound';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'live', label: 'Live', icon: Radio },
  { id: 'schedule', label: 'Schedule', icon: CalendarClock },
  { id: 'standings', label: 'Standings', icon: Trophy },
  { id: 'cards', label: 'Cards / Stats', icon: Layers },
  { id: 'sound', label: 'Soundboard', icon: Megaphone },
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

// ------------------------------------------------------------------ helpers

function useFollowedTeam(tournamentId: string | undefined, state: TournamentState | null): [string | null, (id: string | null) => void] {
  const key = `darts.follow.${tournamentId ?? ''}`;
  const [team, setTeam] = useState<string | null>(() => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  });
  const valid = team && state?.teams.some((t) => t.id === team) ? team : null;
  return [
    valid,
    (id) => {
      setTeam(id);
      try {
        if (id) localStorage.setItem(key, id);
        else localStorage.removeItem(key);
      } catch {
        // ignore
      }
    },
  ];
}

const involves = (state: TournamentState, m: Match, teamId: string | null) => {
  if (!teamId) return false;
  const t = matchTeams(state, m);
  return t.home === teamId || t.away === teamId;
};

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

/** ETAs only after Round 1, when the admin allows them; after an upcoming break show its name. */
function etaText(eta: MatchEta | undefined, enabled: boolean): string | null {
  if (!enabled || !eta) return null;
  return eta.afterBreak ? `After ${eta.afterBreak.name}` : `~${formatClock(eta.start)}`;
}

// ------------------------------------------------------------------ tabs

function ScheduleList({ state, follow, etas, showEtas }: { state: TournamentState; follow: string | null; etas: MatchEta[]; showEtas: boolean }) {
  const queue = queuedMatches(state);
  return (
    <ol className="space-y-2">
      {queue.map((m) => {
        const mine = involves(state, m, follow);
        const eta = etaText(
          etas.find((e) => e.matchId === m.id),
          showEtas,
        );
        return (
          <li key={m.id} className="space-y-2">
            <div className={`surface flex items-center gap-3 p-3 ${mine ? 'border-accent-gold' : ''}`}>
              <span className="w-9 shrink-0 font-mono text-xs text-text-muted">M{matchNumber(state, m.id)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {describeSlot(state, m.home)} <span className="text-text-muted">vs</span> {describeSlot(state, m.away)}
                </p>
                <p className="truncate text-xs text-text-muted">
                  {matchLabel(state, m)} · {m.format}
                </p>
              </div>
              {m.status === 'IN_PROGRESS' ? (
                <span className="shrink-0 text-xs font-semibold text-accent-success">LIVE</span>
              ) : m.suspended ? (
                <span className="shrink-0 text-xs font-semibold text-accent-warning">PAUSED</span>
              ) : (
                eta && <span className="shrink-0 font-mono text-xs text-accent-gold">{eta}</span>
              )}
            </div>
            {visibleBreaks(state, m.id).map((b) => (
              <BreakRow key={b.id} b={b} />
            ))}
          </li>
        );
      })}
      {queue.length === 0 && <p className="text-sm text-text-muted">All matches played.</p>}
    </ol>
  );
}

function PlayoffList({ state }: { state: TournamentState }) {
  const playoffs = state.matches.filter((m) => m.stage === 'PLAYOFF');
  if (!playoffs.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="font-display text-sm tracking-widest text-text-muted uppercase">Playoffs</h3>
      {playoffs.map((m) => {
        const t = matchTeams(state, m);
        return (
          <div key={m.id} className="surface flex items-center gap-3 p-3 text-sm">
            <span className="w-20 shrink-0 text-xs text-text-muted">{matchLabel(state, m)}</span>
            <span className={`min-w-0 flex-1 truncate ${m.winnerTeamId && m.winnerTeamId === t.home ? 'font-semibold' : ''}`}>{describeSlot(state, m.home)}</span>
            <span className="shrink-0 font-mono">{m.status === 'SCHEDULED' ? 'vs' : `${m.legsWon.home} - ${m.legsWon.away}`}</span>
            <span className={`min-w-0 flex-1 truncate text-right ${m.winnerTeamId && m.winnerTeamId === t.away ? 'font-semibold' : ''}`}>{describeSlot(state, m.away)}</span>
          </div>
        );
      })}
    </div>
  );
}

function GuestCards({ state, follow }: { state: TournamentState; follow: string | null }) {
  const rarityOf = useRarityOf();
  if (state.settings.cards.mode === 'OFF') return <p className="text-sm text-text-muted">Power Cards are off for this tournament.</p>;
  const teams = [...state.teams].sort((a, b) => (a.id === follow ? -1 : b.id === follow ? 1 : 0));
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {teams.map((t) => {
          const hand = handOf(state.cards, t.id);
          return (
            <li key={t.id} className={`surface p-3 ${t.id === follow ? 'border-accent-gold' : ''}`}>
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

function GuestStats({ state, follow }: { state: TournamentState; follow: string | null }) {
  const stats = useTournamentStats(state);
  const v = state.settings.visibility;
  if (!stats) return null;
  const rows = [...stats.metrics].filter((m) => m.visits > 0).sort((a, b) => b.average - a.average);
  return (
    <div className="space-y-4">
      {v.showBasicStats && (
        <div className="surface overflow-hidden">
          <p className="border-b border-border-subtle px-3 py-2 font-display text-xs tracking-widest text-text-muted uppercase">Player stats</p>
          {rows.length === 0 ? (
            <p className="p-3 text-xs text-text-muted">Stats appear once darts are thrown.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-text-muted">
                <tr className="text-left">
                  <th className="px-3 py-1.5 font-normal">Player</th>
                  <th className="px-2 py-1.5 text-right font-normal">Avg</th>
                  <th className="px-2 py-1.5 text-right font-normal">High</th>
                  <th className="px-3 py-1.5 text-right font-normal">Outs</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.playerId} className={`border-t border-border-subtle ${m.teamId === follow ? 'bg-accent-gold/10' : ''}`}>
                    <td className="max-w-0 truncate px-3 py-1.5">
                      {state.players[m.playerId]?.name} <span className="text-xs text-text-muted">{teamName(state, m.teamId)}</span>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">{m.average.toFixed(1)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{m.highestVisit}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{m.checkouts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {v.showAwardsPreview && (
        <div className="space-y-2">
          <h3 className="font-display text-sm tracking-widest text-text-muted uppercase">Awards race</h3>
          {stats.awards.map((a) => (
            <AwardCard key={a.id} state={state} award={a} />
          ))}
        </div>
      )}
      {v.showPlayerFutCards && stats.cards.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-sm tracking-widest text-text-muted uppercase">Player cards</h3>
          <div className="grid grid-cols-2 gap-3">
            {[...stats.cards]
              .sort((a, b) => (a.teamId === follow ? -1 : 0) - (b.teamId === follow ? -1 : 0) || b.ovr - a.ovr)
              .map((c) => (
                <FutCardFor key={c.playerId} state={state} card={c} className="w-full" />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

const PHONE_KEY = 'darts.soundboard.last';

function Soundboard({ state }: { state: TournamentState }) {
  const { transport } = useTransportContext();
  const view = useMatchView(state);
  const lock = soundboardLock(state, view);
  const [now, setNow] = useState(Date.now());
  const [mine, setMine] = useState(() => {
    try {
      return Number(localStorage.getItem(PHONE_KEY) ?? 0);
    } catch {
      return 0;
    }
  });
  const [anyone, setAnyone] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => transport.onLiveEvent((e) => e.type === CROWD_EVENT && setAnyone(Date.now())), [transport]);

  const phoneLeft = Math.max(0, Math.ceil((mine + PHONE_COOLDOWN_MS - now) / 1000));
  const globalLeft = Math.max(0, Math.ceil((anyone + GLOBAL_COOLDOWN_MS - now) / 1000));
  const reason = lock ?? (phoneLeft ? `Your next sound in ${phoneLeft} s` : globalLeft ? `Someone just played a sound (${globalLeft} s)` : null);

  const press = (sound: CrowdSound) => {
    const at = Date.now();
    setMine(at);
    try {
      localStorage.setItem(PHONE_KEY, String(at));
    } catch {
      // ignore
    }
    void sendCrowdSound(transport, sound);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">Plays on the stage speakers. Locked while someone is throwing.</p>
      <div className="grid grid-cols-2 gap-3">
        {CROWD_SOUNDS.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={!!reason}
            onClick={() => press(s.id)}
            className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-border-strong bg-bg-elevated font-display text-lg tracking-wide uppercase transition active:scale-95 disabled:opacity-40"
          >
            <Megaphone size={26} className="text-accent-gold" aria-hidden />
            {s.label}
          </button>
        ))}
      </div>
      {reason && <p className="rounded-md bg-bg-elevated px-3 py-2 text-center text-sm text-accent-warning">{reason}</p>}
    </div>
  );
}

function MyTeamCard({ state, follow, etas, showEtas }: { state: TournamentState; follow: string; etas: MatchEta[]; showEtas: boolean }) {
  const { duty, next: dutyMatch } = useDuty(state);
  const nextMine = queuedMatches(state).find((m) => involves(state, m, follow));
  const onDuty = duty?.kind === 'TEAM' && duty.teamId === follow;
  const eta = nextMine ? etaText(etas.find((e) => e.matchId === nextMine.id), showEtas) : null;
  return (
    <div className="surface space-y-2 border-accent-gold p-3">
      <p className="flex items-center gap-2 text-xs tracking-wide text-accent-gold uppercase">
        <Star size={14} aria-hidden /> {teamName(state, follow)}
      </p>
      {onDuty && (
        <p className="flex items-center gap-2 rounded-md bg-accent-gold/15 px-2 py-1.5 text-sm font-semibold text-accent-gold">
          <ClipboardList size={16} aria-hidden /> Your team is on table duty{dutyMatch ? ` for M${matchNumber(state, dutyMatch.id)}` : ''}
        </p>
      )}
      {nextMine ? (
        <p className="text-sm">
          Next: <span className="font-semibold">{describeSlot(state, nextMine.home)}</span> vs <span className="font-semibold">{describeSlot(state, nextMine.away)}</span>
          {nextMine.status === 'IN_PROGRESS' ? <span className="ml-1 text-accent-success">(live now)</span> : eta && <span className="ml-1 font-mono text-accent-gold">{eta}</span>}
        </p>
      ) : (
        <p className="text-sm text-text-muted">No more matches scheduled.</p>
      )}
    </div>
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
  const projection = useProjection(state);
  const [follow, setFollow] = useFollowedTeam(state?.meta?.id, state);
  const showEtas = useMemo(() => !!state?.settings.visibility.showMatchEtas && !!projection?.pace.measured, [state, projection]);
  if (!state) return <NoTournament message="The live tournament could not be loaded." />;
  const next = upNextMatch(state);
  const phase = state.live?.phase ?? 'UP_NEXT';
  const tables = allGroupStandings(state);
  const etas = projection?.etas ?? [];

  return (
    <div className="touch-route flex min-h-dvh flex-col bg-bg-primary">
      <header className="sticky top-0 z-10 space-y-2 border-b border-border-subtle bg-bg-surface px-4 pb-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 truncate font-display text-lg font-semibold tracking-wide uppercase">{state.meta?.name}</h1>
          <ConnectionBadge />
        </div>
        <Select aria-label="Follow a team" value={follow ?? ''} onChange={(e) => setFollow(e.target.value || null)} className="min-h-10 text-sm">
          <option value="">Follow a team (optional)</option>
          {state.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </header>

      <main className="flex-1 space-y-4 p-4 pb-28">
        <h2 className="font-display text-sm tracking-widest text-text-muted uppercase">{active.label}</h2>
        {tab === 'live' && (
          <div className="space-y-3">
            {follow && <MyTeamCard state={state} follow={follow} etas={etas} showEtas={showEtas} />}
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
        {tab === 'schedule' && <ScheduleList state={state} follow={follow} etas={etas} showEtas={showEtas} />}
        {tab === 'standings' && (
          <div className="space-y-3">
            {tables.map((rows, g) => (
              <StandingsTable key={g} state={state} rows={rows} groupIndex={g} qualify={qualifiersPerGroup(state)} />
            ))}
            <PlayoffList state={state} />
          </div>
        )}
        {tab === 'cards' && (
          <div className="space-y-5">
            <GuestCards state={state} follow={follow} />
            <GuestStats state={state} follow={follow} />
          </div>
        )}
        {tab === 'sound' && <Soundboard state={state} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-border-subtle bg-bg-surface" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Guest sections">
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
