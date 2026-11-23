import { AlertTriangle, ArrowLeft, Crosshair, Dumbbell, PauseCircle, Wrench, FastForward, Keyboard, Lock, Megaphone, MegaphoneOff, Play, RotateCcw, ShieldAlert, SkipForward } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ActiveEffects } from '../../components/cards/ActiveEffects.tsx';
import { CardHands } from '../../components/cards/CardHands.tsx';
import { CheckoutRoutes } from '../../components/match/CheckoutRoutes.tsx';
import { DartKeypad } from '../../components/match/DartKeypad.tsx';
import { AdminPinGate } from '../../components/AdminPinGate.tsx';
import { formatClock } from '../../engine/pace.ts';
import { TableTools } from './TableTools.tsx';
import { DutyBanner } from '../../components/match/DutyBanner.tsx';
import { MatchSummary } from '../../components/match/MatchSummary.tsx';
import { Scoreboard, VisitSlots } from '../../components/match/Scoreboard.tsx';
import { Matchup } from '../../components/Matchup.tsx';
import { RouteHeader } from '../../components/RouteHeader.tsx';
import { ConnectionBadge, FullscreenButton, PingIndicator } from '../../components/StatusIndicators.tsx';
import { Button, Modal, Notice } from '../../components/ui.tsx';
import { restrictedPoints } from '../../engine/cardEffects.ts';
import { CARD_BY_ID } from '../../engine/cardCatalog.ts';
import { startableTeams } from '../../engine/matchReducer.ts';
import { dartLabel, dartPoints } from '../../engine/scoring.ts';
import type { MatchView } from '../../engine/match.ts';
import type { TournamentState } from '../../engine/state.ts';
import { playersOfTeam, teamName, upNextMatch } from '../../engine/selectors.ts';
import type { Multiplier } from '../../engine/scoring.ts';
import { useDispatch, useTournamentState, useTransportContext } from '../../hooks/TransportProvider.tsx';
import { useDuty, useMatchView } from '../../hooks/useMatch.ts';
import { throwDart, undoDart } from '../../services/matchOps.ts';
import { countActiveScorers } from '../../services/presence.ts';
import { useKeypadPrefs } from '../../hooks/useKeypadPrefs.ts';
import { KeypadSettings, type KeypadControl } from './KeypadSettings.tsx';
import { CardDrawPanel } from './CardDrawPanel.tsx';
import { LegStartPanel } from './LegStartPanel.tsx';
import { PracticePanel } from './PracticePanel.tsx';

/** Unlocked scorer: 16:9 zero-scroll split grid that follows the 4-phase match state machine. */
export function ScorerConsole({ onLock }: { onLock: () => void }) {
  const { peers } = useTransportContext();
  const state = useTournamentState()!;
  const scorers = countActiveScorers(peers);
  const phase = state.live?.phase ?? 'UP_NEXT';
  const tournamentDefault = state.settings.table.defaultKeypad;
  const keypad = useKeypadPrefs(tournamentDefault);
  const [practice, setPractice] = useState(false);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const dispatch = useDispatch();
  const crowdOn = state.settings.visibility.soundboardEnabled !== false;
  // Practice is only offered while no darts are being scored for real.
  const practiceAllowed = phase === 'UP_NEXT' || phase === 'PRE_MATCH';
  const inPractice = practice && practiceAllowed;

  return (
    <div className="touch-route flex h-dvh flex-col overflow-hidden bg-bg-primary">
      {scorers > 1 && (
        <div role="alert" className="animate-pulse bg-accent-danger px-4 py-2 text-center font-display text-lg font-bold tracking-wide text-text-primary uppercase">
          <ShieldAlert size={22} className="mr-2 inline align-[-4px]" aria-hidden />
          Warning: multiple scorer devices connected — rotate PIN in admin
        </div>
      )}
      <RouteHeader
        icon={Crosshair}
        title="Table Scorer"
        subtitle={`${state.meta?.name ?? ''} · ${phase.replace('_', ' ')}`}
        actions={
          <>
            <PingIndicator />
            <ConnectionBadge />
            {practiceAllowed && !inPractice && (
              <Button size="sm" icon={Dumbbell} onClick={() => setPractice(true)}>
                <span className="hidden lg:inline">Practice</span>
              </Button>
            )}
            {state.settings.visibility.soundboardFeature !== false && (
            <Button
              size="sm"
              icon={crowdOn ? Megaphone : MegaphoneOff}
              aria-label={crowdOn ? 'Mute crowd soundboard' : 'Unmute crowd soundboard'}
              title="Crowd soundboard on the stage"
              onClick={() => void dispatch({ type: 'UPDATE_VISIBILITY', patch: { soundboardEnabled: !crowdOn } }, { persist: 'immediate' })}
            >
              <span className="hidden lg:inline">{crowdOn ? 'Crowd on' : 'Crowd off'}</span>
            </Button>
            )}
            <Button size="sm" icon={state.helpRequest ? AlertTriangle : Wrench} onClick={() => setToolsOpen(true)} aria-label="Table tools" className={state.helpRequest ? 'animate-pulse border-accent-warning text-accent-warning' : ''}>
              <span className="hidden lg:inline">{state.helpRequest ? 'Admin called' : 'Tools'}</span>
            </Button>
            <Button size="sm" icon={Keyboard} onClick={() => setKeypadOpen(true)} aria-label="Keypad layout">
              <span className="hidden lg:inline">Keypad layout</span>
            </Button>
            <FullscreenButton />
            <Button size="sm" icon={Lock} onClick={onLock} aria-label="Lock scorer">
              <span className="hidden xl:inline">Lock</span>
            </Button>
          </>
        }
      />
      <main className="grid min-h-0 flex-1 grid-cols-2 gap-3 p-3">
        {inPractice ? (
          <PracticePanel state={state} keypad={keypad} onExit={() => setPractice(false)} />
        ) : (
          <>
            {phase === 'UP_NEXT' && <UpNextPhase onPractice={() => setPractice(true)} />}
            {phase === 'PRE_MATCH' && <PreMatchPhase />}
            {phase === 'IN_PROGRESS' && <InProgressPhase keypad={keypad} />}
            {phase === 'POST_MATCH' && <PostMatchPhase />}
          </>
        )}
      </main>
      {toolsOpen && <TableTools state={state} onClose={() => setToolsOpen(false)} />}
      {keypadOpen && (
        <Modal title="Keypad layout" wide onClose={() => setKeypadOpen(false)}>
          <KeypadSettings
            keypad={keypad}
            tournamentDefault={tournamentDefault}
            onPractice={
              practiceAllowed
                ? () => {
                    setKeypadOpen(false);
                    setPractice(true);
                  }
                : undefined
            }
          />
        </Modal>
      )}
    </div>
  );
}

const Panel = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <section className={`surface flex min-h-0 flex-col gap-3 overflow-hidden p-4 ${className}`}>{children}</section>
);

function UpNextPhase({ onPractice }: { onPractice: () => void }) {
  const state = useTournamentState()!;
  const dispatch = useDispatch();
  const [restartGate, setRestartGate] = useState(false);
  const { next, duty } = useDuty(state);
  const match = upNextMatch(state);
  const teams = match ? startableTeams(state, match) : null;
  const canDefer = match ? state.queue.some((id) => id !== match.id && state.matches.find((m) => m.id === id)?.status === 'SCHEDULED') : false;

  if (!match) {
    return (
      <Panel className="col-span-2 items-center justify-center text-center">
        <p className="font-display text-3xl uppercase">All matches complete</p>
        <p className="text-text-muted">The Admin can project awards to the stage.</p>
      </Panel>
    );
  }
  return (
    <>
      <Panel className="justify-center">
        <h2 className="font-display text-sm tracking-widest text-text-muted uppercase">Next Match</h2>
        <Matchup state={state} match={match} />
        <DutyBanner state={state} duty={duty} match={next} />
      </Panel>
      <Panel className="justify-center">
        {!teams && <Notice tone="info">Waiting for earlier results before this match can start.</Notice>}
        {match.suspended ? (
          <>
            <Notice tone="warning">
              <span className="flex items-center gap-2">
                <PauseCircle size={16} aria-hidden /> This match was paused at {formatClock(match.suspended.at)}.
              </span>
            </Notice>
            <Button
              size="lg"
              variant="primary"
              icon={Play}
              className="min-h-24 text-2xl"
              onClick={() => void dispatch({ type: 'START_MATCH', matchId: match.id, at: Date.now() }, { persist: 'immediate' })}
            >
              Resume where you left off
            </Button>
            <Button size="lg" icon={ArrowLeft} onClick={() => setRestartGate(true)}>
              Start over from zero (admin)
            </Button>
          </>
        ) : (
          <Button
            size="lg"
            variant="primary"
            icon={Play}
            className="min-h-28 text-2xl"
            disabled={!teams}
            onClick={() => void dispatch({ type: 'START_MATCH', matchId: match.id, at: Date.now() }, { persist: 'immediate' })}
          >
            Everyone Ready — Start Match
          </Button>
        )}
        {restartGate && (
          <AdminPinGate
            title="Start the paused match over"
            confirmLabel="Start over"
            onClose={() => setRestartGate(false)}
            onConfirm={() => dispatch({ type: 'START_MATCH', matchId: match.id, at: Date.now(), restart: true }, { persist: 'immediate' })}
          >
            The darts of the paused attempt are deleted and every Power Card played in it goes back to its team's hand.
          </AdminPinGate>
        )}
        <Button
          size="lg"
          icon={SkipForward}
          disabled={!canDefer}
          onClick={() => void dispatch({ type: 'DEFER_MATCH', matchId: match.id }, { persist: 'immediate' })}
        >
          Skip / Defer Match
        </Button>
        <Button size="lg" icon={Dumbbell} onClick={onPractice}>
          Practice the Keypad (not counted)
        </Button>
      </Panel>
    </>
  );
}

function PreMatchPhase() {
  const state = useTournamentState()!;
  const dispatch = useDispatch();
  const { transport } = useTransportContext();
  const view = useMatchView(state);
  const { duty, next } = useDuty(state);
  if (!view) return null;
  const ready = !!view.setup?.firstTeam;
  return (
    <>
      <Panel className="justify-center">
        <Matchup state={state} match={view.match} />
        <DutyBanner state={state} duty={duty} match={next} />
        <CardHands state={state} view={view} only="PRE_MATCH" />
        {view.plays.length > 0 && (
          <Button icon={RotateCcw} className="border-accent-warning/60 text-accent-warning" onClick={() => void undoDart(transport)}>
            Undo {view.plays.length > 1 ? 'Last Card' : 'First Throw Card'}
          </Button>
        )}
      </Panel>
      <Panel>
        <LegStartPanel state={state} view={view} />
        <div className="mt-auto grid grid-cols-[auto_1fr] gap-2">
          <Button size="lg" icon={ArrowLeft} onClick={() => void dispatch({ type: 'ABORT_MATCH' }, { persist: 'immediate' })}>
            Back
          </Button>
          <Button size="lg" variant="primary" icon={Play} disabled={!ready} onClick={() => void dispatch({ type: 'BEGIN_PLAY' }, { persist: 'immediate' })}>
            Begin — Game On
          </Button>
        </div>
      </Panel>
    </>
  );
}

function InProgressPhase({ keypad }: { keypad: KeypadControl }) {
  const state = useTournamentState()!;
  const { transport } = useTransportContext();
  const view = useMatchView(state);
  const [busy, setBusy] = useState(false);
  if (!view) return null;
  const turn = view.turn;
  const matchThrows = state.throws.filter((t) => t.matchId === view.match.id).length;
  const canUndo = matchThrows > 0 || view.plays.length > 0;
  // Undo is strictly last-in-first-out: say when the next undo takes back a card.
  const lastPlay = view.plays[view.plays.length - 1];
  const undoLabel = lastPlay && lastPlay.afterThrowCount >= matchThrows ? `Undo Card: ${CARD_BY_ID[lastPlay.cardTypeId].name}` : undefined;
  // Bottom Half / Parity Lock: dim darts that would score 0 (still tappable so the real hit is logged).
  const dartNo = (turn?.darts.length ?? 0) + 1;
  const isDimmed = turn ? (segment: number, multiplier: Multiplier) => dartPoints({ segment, multiplier }) > 0 && restrictedPoints({ segment, multiplier }, dartNo, turn.mods) === 0 : undefined;
  const thrower = turn ? playersOfTeam(state, turn.teamId).find((p) => p.id === turn.playerId) : null;

  const onDart = async (segment: number, multiplier: Multiplier) => {
    if (busy) return;
    setBusy(true);
    try {
      await throwDart(transport, segment, multiplier);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Panel>
        <Scoreboard state={state} view={view} />
        {view.dartsThrownInLeg === 0 ? (
          <LegStartPanel state={state} view={view} compact />
        ) : (
          <CheckoutRoutes state={state} view={view} />
        )}
        <ActiveEffects state={state} view={view} />
        <CardHands state={state} view={view} />
        {turn && (
          <div className="mt-auto flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm text-text-muted">
              Throwing: <span className="font-semibold text-text-primary">{thrower?.name}</span> ({teamName(state, turn.teamId)}) · Leg {view.currentLegIndex + 1}
            </p>
            <VisitSlots view={view} size="md" />
          </div>
        )}
      </Panel>
      <Panel className="p-3">
        {view.live.awaitingNextLeg != null && !view.winner ? (
          <LegDone state={state} view={view} onUndo={() => void undoDart(transport)} />
        ) : (
        <DartKeypad
          layout={keypad.layout}
          stickyModifier={keypad.prefs.stickyModifier}
          onDart={onDart}
          onUndo={() => void undoDart(transport)}
          disabled={!turn}
          canUndo={canUndo}
          isDimmed={isDimmed}
          undoLabel={undoLabel}
        />
        )}
      </Panel>
    </>
  );
}

/** BO3+: a leg just ended. The stage keeps showing it until the scorer starts the next leg. */
function LegDone({ state, view, onUndo }: { state: TournamentState; view: MatchView; onUndo: () => void }) {
  const dispatch = useDispatch();
  const leg = view.currentLeg;
  const winner = leg.winner ? teamName(state, view.teamIds[leg.winner]) : '';
  const out = leg.checkoutDart;
  const finishing = leg.visits.find((v) => v.checkout);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
      <p className="font-display text-sm tracking-[0.3em] text-text-muted uppercase">Leg {view.currentLegIndex + 1} complete</p>
      <p className="font-display text-4xl font-bold uppercase">{winner} wins the leg</p>
      {out && finishing && (
        <p className="text-lg text-text-muted">
          Checkout {finishing.scoreBefore} on <span className="font-mono font-bold text-accent-gold">{dartLabel(out)}</span> · legs {view.legsWon.home} - {view.legsWon.away}
        </p>
      )}
      <Button size="lg" variant="primary" icon={Play} className="min-h-28 w-full max-w-md text-2xl" onClick={() => void dispatch({ type: 'NEXT_LEG' }, { persist: 'immediate' })}>
        Start Leg {view.currentLegIndex + 2}
      </Button>
      <Button icon={RotateCcw} className="border-accent-warning/60 text-accent-warning" onClick={onUndo}>
        Undo Last Dart (reopen leg)
      </Button>
    </div>
  );
}

function PostMatchPhase() {
  const state = useTournamentState()!;
  const dispatch = useDispatch();
  const { transport } = useTransportContext();
  const view = useMatchView(state);
  const { duty, next } = useDuty(state);
  if (!view) return null;
  return (
    <>
      <Panel className="justify-center">
        <MatchSummary state={state} view={view} />
        <DutyBanner state={state} duty={duty} match={next} />
      </Panel>
      <Panel className="justify-center">
        <CardDrawPanel state={state} />
        <Button size="lg" variant="primary" icon={FastForward} className="min-h-24 text-2xl" disabled={!!state.cards.pendingDiscard} onClick={() => void dispatch({ type: 'CONTINUE_TO_NEXT' }, { persist: 'immediate' })}>
          Continue to Next Match
        </Button>
        <Button size="lg" icon={RotateCcw} className="min-h-16 border-accent-warning/60 text-accent-warning" onClick={() => void undoDart(transport)}>
          Undo Last Dart (Reopen Match)
        </Button>
        <p className="text-center text-xs text-text-muted">Entered the wrong finishing dart? One tap removes it and resumes the leg.</p>
      </Panel>
    </>
  );
}
