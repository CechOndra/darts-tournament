import { Coins, Target, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ActiveEffects } from '../components/cards/ActiveEffects.tsx';
import { CheckoutRoutes } from '../components/match/CheckoutRoutes.tsx';
import { DutyBanner } from '../components/match/DutyBanner.tsx';
import { MatchSummary } from '../components/match/MatchSummary.tsx';
import { Scoreboard, VisitSlots } from '../components/match/Scoreboard.tsx';
import { qualifiersPerGroup, StandingsTable } from '../components/match/StandingsTable.tsx';
import { Matchup } from '../components/Matchup.tsx';
import { NoTournament } from '../components/NoTournament.tsx';
import { FullscreenButton } from '../components/StatusIndicators.tsx';
import type { MatchView } from '../engine/match.ts';
import { dartLabel } from '../engine/scoring.ts';
import { matchLabel, playersOfTeam, teamName, upNextMatch } from '../engine/selectors.ts';
import { allGroupStandings } from '../engine/standings.ts';
import type { TournamentState } from '../engine/state.ts';
import type { Side } from '../engine/types.ts';
import { useLiveTournamentId } from '../hooks/ControlProvider.tsx';
import { TournamentScope, useTournamentState, useTransportContext } from '../hooks/TransportProvider.tsx';
import { useDuty, useMatchView } from '../hooks/useMatch.ts';
import { usePresenceRole } from '../hooks/useTransport.ts';
import { useSoundState, useWinSong } from '../hooks/useSound.ts';
import { setMuted, unlockAudio } from '../services/audio/sound.ts';
import { MATCH_EVENTS } from '../services/matchOps.ts';
import { HelpBanner, useHelpAlert } from '../components/HelpBanner.tsx';
import { CardEventsOverlay } from './stage/CardEventsOverlay.tsx';
import { MemeOverlay } from './stage/MemeOverlay.tsx';
import { ScoreCaller } from './stage/ScoreCaller.tsx';
import { CrowdSoundPlayer, JoinQr, StageOverlayView } from './stage/StageExtras.tsx';

function SoundButton() {
  const { muted, unlocked } = useSoundState();
  const off = muted || !unlocked;
  return (
    <button
      type="button"
      onClick={() => {
        void unlockAudio();
        if (unlocked) setMuted(!muted);
        else setMuted(false);
      }}
      className="flex min-h-11 items-center gap-2 rounded-md border border-border-subtle bg-bg-elevated px-3 text-sm font-medium"
      aria-label={off ? 'Turn sound on' : 'Mute sound'}
    >
      {off ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />}
      {off ? 'Sound off' : 'Sound on'}
    </button>
  );
}

export function StagePage() {
  const id = useLiveTournamentId();
  return (
    <div
      className="touch-route group relative h-dvh overflow-hidden bg-bg-primary [background:var(--surface-gradient)]"
      // Browsers only allow audio after a gesture: any click on the stage enables sound.
      onPointerDown={() => void unlockAudio()}
    >
      <div className="absolute top-4 right-4 z-40 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <SoundButton />
        <FullscreenButton />
      </div>
      <SoundHint />
      {id === undefined ? (
        <NoTournament loading />
      ) : id === null ? (
        <StageIdle />
      ) : (
        <TournamentScope tournamentId={id}>
          <StageLive />
        </TournamentScope>
      )}
    </div>
  );
}

/** Small reminder until someone clicks the stage once (needed for the win song and card sounds). */
function SoundHint() {
  const { muted, unlocked } = useSoundState();
  if (unlocked || muted) return null;
  return <p className="absolute right-4 bottom-3 z-40 text-sm text-text-muted">Click anywhere once to enable sound</p>;
}

function Clock({ className = 'text-4xl' }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className={`font-mono text-accent-gold ${className}`}>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>;
}

function StageIdle() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <Target size={96} className="text-accent-primary" aria-hidden />
      <h1 className="font-display text-6xl font-bold tracking-wider uppercase">Darts Tournament Live</h1>
      <p className="text-xl text-text-muted">Waiting for the host to start a tournament</p>
      <Clock />
    </div>
  );
}

/** Projector kiosk: mirrors the match state machine, zero interactive controls. */
function StageLive() {
  usePresenceRole('stage');
  const { status } = useTransportContext();
  const state = useTournamentState();
  const view = useMatchView(state);
  useWinSong(state);
  useHelpAlert(state);
  if (!state) return <StageIdle />;
  const phase = state.live?.phase ?? 'UP_NEXT';

  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Target size={40} className="shrink-0 text-accent-primary" aria-hidden />
          <h1 className="truncate font-display text-3xl font-bold tracking-wider uppercase">{state.meta?.name}</h1>
          {view && phase !== 'UP_NEXT' && (
            <span className="font-display text-2xl tracking-widest text-text-muted uppercase">
              · {matchLabel(state, view.match)} · {view.match.format}
              {phase === 'IN_PROGRESS' && ` · Leg ${view.currentLegIndex + 1}`}
            </span>
          )}
        </div>
        <Clock />
      </header>
      <HelpBanner state={state} size="xl" />
      <main className="relative flex min-h-0 flex-1 flex-col">
        {phase === 'UP_NEXT' && <UpNextStage state={state} />}
        {phase === 'PRE_MATCH' && view && <PreMatchStage state={state} view={view} />}
        {phase === 'IN_PROGRESS' && view && <InProgressStage state={state} view={view} />}
        {phase === 'POST_MATCH' && view && <PostMatchStage state={state} view={view} />}
        <CoinTossOverlay state={state} view={view} />
        <CardEventsOverlay state={state} />
        <StageOverlayView state={state} />
        <CrowdSoundPlayer state={state} view={view} />
        <MemeOverlay state={state} view={view} />
        <ScoreCaller state={state} view={view} />

        {phase !== 'IN_PROGRESS' && !state.stageOverlay && state.settings.visibility.showJoinQr !== false && (
          <div className="absolute right-0 bottom-0 z-10">
            <JoinQr size={150} />
          </div>
        )}
      </main>
      <span className={`absolute bottom-3 left-3 h-2.5 w-2.5 rounded-full ${status === 'connected' ? 'bg-accent-success' : 'bg-accent-warning'}`} title={status} />
    </div>
  );
}

function UpNextStage({ state }: { state: TournamentState }) {
  const { duty, next } = useDuty(state);
  const match = upNextMatch(state);
  const tables = allGroupStandings(state);
  const hasResults = state.completedOrder.length > 0 && tables.length > 0;
  const [showTables, setShowTables] = useState(false);
  useEffect(() => {
    if (!hasResults) return setShowTables(false);
    const t = setInterval(() => setShowTables((v) => !v), 12_000);
    return () => clearInterval(t);
  }, [hasResults]);

  if (!match) return <p className="m-auto font-display text-6xl uppercase">All matches complete</p>;
  if (showTables) {
    return (
      <div className="flex h-full flex-col gap-6">
        <p className="text-center font-display text-3xl tracking-[0.4em] text-text-muted uppercase">Standings</p>
        <div className={`grid flex-1 content-start gap-6 ${tables.length > 1 ? 'grid-cols-2' : 'mx-auto w-full max-w-4xl'}`}>
          {tables.map((rows, g) => (
            <StandingsTable key={g} state={state} rows={rows} groupIndex={g} qualify={qualifiersPerGroup(state)} size="xl" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="m-auto flex w-full max-w-6xl flex-col items-center gap-10">
      <p className="font-display text-3xl tracking-[0.4em] text-text-muted uppercase">Next Match</p>
      <Matchup state={state} match={match} size="xl" />
      <DutyBanner state={state} duty={duty} match={next} size="xl" />
    </div>
  );
}

function PreMatchStage({ state, view }: { state: TournamentState; view: MatchView }) {
  const { duty, next } = useDuty(state);
  const setup = view.setup;
  const decisionText: Record<string, string> = {
    VIRTUAL_COIN_TOSS: 'Coin toss coming up',
    CLOSEST_TO_BULL_1P: 'Bull-up to decide who throws first',
    CLOSEST_TO_BULL_2P: 'Bull-up (2 players each) to decide who throws first',
    HIGH_SCORE_2DART_SHOOTOUT: '2-dart shootout to decide who throws first',
    MANUAL_CHOICE: 'Teams decide who throws first',
  };
  return (
    <div className="m-auto flex w-full max-w-6xl flex-col items-center gap-10">
      <Matchup state={state} match={view.match} size="xl" />
      <p className="font-display text-4xl tracking-wide text-accent-gold uppercase">
        {setup?.firstTeam ? `${teamName(state, view.teamIds[setup.firstTeam])} throws first` : setup?.decision ? decisionText[setup.decision] : ''}
      </p>
      <DutyBanner state={state} duty={duty} match={next} size="xl" />
    </div>
  );
}

function InProgressStage({ state, view }: { state: TournamentState; view: MatchView }) {
  const turn = view.turn;
  const thrower = turn ? playersOfTeam(state, turn.teamId).find((p) => p.id === turn.playerId) : null;
  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <Scoreboard state={state} view={view} size="xl" history={state.settings.visibility.stageVisitHistory} className="min-h-0 flex-1" />
      <div className="grid shrink-0 grid-cols-[1fr_auto] items-center gap-8">
        <div className="min-w-0">
          {turn ? (
            <>
              <p className="mb-3 font-display text-3xl tracking-wide uppercase">
                <span className="text-text-muted">Throwing:</span> {thrower?.name} <span className="text-text-muted">· needs</span> {turn.remaining}
              </p>
              <div className="mb-3">
                <ActiveEffects state={state} view={view} size="xl" sound />
              </div>
              <CheckoutRoutes state={state} view={view} size="xl" />
            </>
          ) : (
            <LegResult state={state} view={view} />
          )}
        </div>
        <VisitSlots view={view} size="xl" />
      </div>
      <VisitFlash view={view} />
    </div>
  );
}

function LegResult({ state, view }: { state: TournamentState; view: MatchView }) {
  const leg = view.currentLeg;
  if (!leg.winner) return <p className="font-display text-4xl text-accent-gold uppercase">Next leg starting</p>;
  const finishing = leg.visits.find((v) => v.checkout);
  return (
    <div className="space-y-2">
      <p className="font-display text-5xl text-accent-gold uppercase">
        Leg {view.currentLegIndex + 1} to {teamName(state, view.teamIds[leg.winner])}
      </p>
      {finishing && leg.checkoutDart && (
        <p className="font-display text-3xl text-text-muted uppercase">
          {finishing.scoreBefore} checkout on {dartLabel(leg.checkoutDart)} · legs {view.legsWon.home} - {view.legsWon.away}
        </p>
      )}
    </div>
  );
}

/** How long the stage keeps the final leg up after the match-winning dart, before the summary. */
const FINAL_LEG_HOLD_MS = 12_000;

function PostMatchStage({ state, view }: { state: TournamentState; view: MatchView }) {
  const { duty, next } = useDuty(state);
  const doneAt = view.live.completedAt ?? 0;
  const [summary, setSummary] = useState(() => Date.now() - doneAt >= FINAL_LEG_HOLD_MS);
  useEffect(() => {
    const left = FINAL_LEG_HOLD_MS - (Date.now() - doneAt);
    if (left <= 0) return setSummary(true);
    setSummary(false);
    const t = setTimeout(() => setSummary(true), left);
    return () => clearTimeout(t);
  }, [doneAt]);
  if (!summary) {
    const winner = view.winner ? teamName(state, view.teamIds[view.winner]) : '';
    const finishing = view.currentLeg.visits.find((v) => v.checkout);
    return (
      <div className="flex h-full min-h-0 flex-col gap-6">
        <Scoreboard state={state} view={view} size="xl" history={state.settings.visibility.stageVisitHistory} className="min-h-0 flex-1" />
        <div className="shrink-0 space-y-2">
          <p className="font-display text-5xl text-accent-gold uppercase">
            Game shot · {winner} wins the match {view.legsWon.home} - {view.legsWon.away}
          </p>
          {finishing && view.currentLeg.checkoutDart && (
            <p className="font-display text-3xl text-text-muted uppercase">
              {finishing.scoreBefore} checkout on {dartLabel(view.currentLeg.checkoutDart)}
            </p>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="m-auto flex w-full max-w-6xl flex-col items-center gap-10">
      <MatchSummary state={state} view={view} size="xl" />
      <DutyBanner state={state} duty={duty} match={next} size="xl" />
    </div>
  );
}

/** Big flash for the visit that just ended: BUST / 180 / GAME SHOT / score. */
function VisitFlash({ view }: { view: MatchView }) {
  const v = view.lastCompletedVisit;
  const key = v ? `${v.legIndex}-${v.visitIndex}-${v.darts.length}` : '';
  const prevKey = useRef<string | null>(null);
  const [shown, setShown] = useState<{ text: string; tone: string } | null>(null);
  useEffect(() => {
    // Only flash on a *change* (not on first render / reconnect / StrictMode re-run).
    const prev = prevKey.current;
    prevKey.current = key;
    if (prev === null || prev === key || !v) return;
    const text = v.bust ? 'BUST' : v.checkout ? 'GAME SHOT' : v.scored === 180 ? 'ONE HUNDRED AND EIGHTY' : String(v.scored);
    const tone = v.bust ? 'text-accent-danger' : v.checkout || v.scored >= 100 ? 'text-accent-gold' : 'text-text-primary';
    setShown({ text, tone });
    const t = setTimeout(() => setShown(null), 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!shown) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <p className={`animate-pulse rounded-xl bg-bg-overlay px-16 py-8 text-center font-display text-9xl font-bold uppercase ${shown.tone}`}>{shown.text}</p>
    </div>
  );
}

function CoinTossOverlay({ state, view }: { state: TournamentState; view: MatchView | null }) {
  const { transport } = useTransportContext();
  const [toss, setToss] = useState<{ result: Side; revealed: boolean } | null>(null);
  useEffect(
    () =>
      transport.onLiveEvent((e) => {
        if (e.type !== MATCH_EVENTS.COIN_TOSS) return;
        const { result } = e.payload as { result: Side };
        setToss({ result, revealed: false });
        setTimeout(() => setToss((t) => (t ? { ...t, revealed: true } : t)), 2100);
        setTimeout(() => setToss(null), 5500);
      }),
    [transport],
  );
  if (!toss || !view) return null;
  const face = (side: Side) => (
    <div className={`coin-face ${side === 'away' ? 'coin-back' : ''}`}>
      <span className="line-clamp-3 font-display text-5xl leading-tight font-bold break-words uppercase">{teamName(state, view.teamIds[side])}</span>
    </div>
  );
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-12 rounded-lg bg-bg-primary/95">
      <div className="coin-stage">
        <div className={`coin ${toss.result === 'home' ? 'coin-land-home' : 'coin-land-away'}`} aria-hidden>
          {face('home')}
          {face('away')}
        </div>
      </div>
      <p className="font-display text-6xl uppercase">
        {toss.revealed ? (
          <>
            <span className="text-accent-gold">{teamName(state, view.teamIds[toss.result])}</span> throws first
          </>
        ) : (
          <span className="inline-flex items-center gap-4 text-text-muted">
            <Coins size={56} aria-hidden /> Coin toss
          </span>
        )}
      </p>
    </div>
  );
}
