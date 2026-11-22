import { Crosshair, Delete, Lock, LockKeyhole, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Matchup } from '../components/Matchup.tsx';
import { NoTournament } from '../components/NoTournament.tsx';
import { Placeholder, RouteHeader } from '../components/RouteHeader.tsx';
import { ConnectionBadge, FullscreenButton, PingIndicator } from '../components/StatusIndicators.tsx';
import { Button, Notice } from '../components/ui.tsx';
import { upNextMatch } from '../engine/selectors.ts';
import { useControl, useLiveTournamentId } from '../hooks/ControlProvider.tsx';
import { TournamentScope, useTournamentState, useTransportContext } from '../hooks/TransportProvider.tsx';
import { usePresenceRole } from '../hooks/useTransport.ts';
import { describeControlError } from '../services/control/index.ts';
import { sessionStore, type ScorerSession } from '../services/control/sessionStore.ts';
import { countActiveScorers } from '../services/presence.ts';
import { isScorerKickedOut, LIVE_EVENTS } from '../services/tournamentOps.ts';

export function ScorerPage() {
  const id = useLiveTournamentId();
  if (id === undefined) return <NoTournament loading />;
  if (id === null) return <NoTournament />;
  return (
    <TournamentScope tournamentId={id}>
      <ScorerGate tournamentId={id} />
    </TournamentScope>
  );
}

function ScorerGate({ tournamentId }: { tournamentId: string }) {
  const { api } = useControl();
  const { transport, hydrated } = useTransportContext();
  const state = useTournamentState();
  const [session, setSessionState] = useState<ScorerSession | null>(() => sessionStore.getScorer(tournamentId));
  const [lockReason, setLockReason] = useState<string | null>(null);

  const setSession = useCallback(
    (s: ScorerSession | null, reason: string | null = null) => {
      sessionStore.setScorer(tournamentId, s);
      setSessionState(s);
      setLockReason(reason);
    },
    [tournamentId],
  );

  usePresenceRole('scorer', !!session, session?.pinVersion ?? null);

  // Authorize persisted writes with the scorer token.
  useEffect(() => {
    transport.setAuthToken(session?.token ?? null);
  }, [transport, session]);

  // Kickout 1: PIN rotated (public pinVersion in the synced snapshot changed).
  useEffect(() => {
    if (session && isScorerKickedOut(session.pinVersion, state)) setSession(null, 'The Scorer PIN was changed by the Admin. Enter the new PIN.');
  }, [session, state, setSession]);

  // Kickout 2: instant lock broadcast.
  useEffect(
    () =>
      transport.onLiveEvent((e) => {
        if (e.type !== LIVE_EVENTS.SCORER_LOCK) return;
        const { pinVersion } = e.payload as { pinVersion: number };
        setSessionState((s) => {
          if (s && s.pinVersion !== pinVersion) {
            sessionStore.setScorer(tournamentId, null);
            setLockReason('The Scorer PIN was changed by the Admin. Enter the new PIN.');
            return null;
          }
          return s;
        });
      }),
    [transport, tournamentId],
  );

  // Kickout 3: token revoked/expired server-side (checked on load and every minute).
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const check = () =>
      api.validateSession(session.token, tournamentId).then(
        (r) => !cancelled && !r.valid && setSession(null, 'Your scorer session expired. Enter the PIN again.'),
        () => undefined,
      );
    void check();
    const t = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [api, session, tournamentId, setSession]);

  if (!hydrated) return <NoTournament loading />;
  if (!state) return <NoTournament message="The live tournament could not be loaded." />;
  if (!session) return <PinPad tournamentId={tournamentId} name={state.meta?.name ?? ''} reason={lockReason} onUnlock={(s) => setSession(s)} />;
  return <ScorerConsole onLock={() => setSession(null)} />;
}

function PinPad({ tournamentId, name, reason, onUnlock }: { tournamentId: string; name: string; reason: string | null; onUnlock: (s: ScorerSession) => void }) {
  const { api } = useControl();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (code: string) => {
      setBusy(true);
      setError(null);
      try {
        onUnlock(await api.scorerLogin(tournamentId, code));
      } catch (err) {
        setError(describeControlError(err));
        setPin('');
      } finally {
        setBusy(false);
      }
    },
    [api, tournamentId, onUnlock],
  );

  const press = (d: string) => {
    if (busy) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) void submit(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="touch-route flex h-dvh items-center justify-center overflow-hidden bg-bg-primary p-4">
      <div className="flex w-full max-w-4xl flex-col items-center gap-6 md:flex-row md:justify-center md:gap-16">
        <div className="flex flex-col items-center gap-3 text-center md:items-start md:text-left">
          <LockKeyhole size={44} className="text-accent-gold" aria-hidden />
          <h1 className="font-display text-3xl tracking-wide uppercase">Table Scorer</h1>
          <p className="text-text-muted">{name}</p>
          <div className="flex gap-3" aria-label={`${pin.length} of 4 digits entered`}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-4 w-4 rounded-full border-2 ${i < pin.length ? 'border-accent-gold bg-accent-gold' : 'border-border-strong'}`} />
            ))}
          </div>
          <div className="min-h-12 w-72">
            {reason && !error && <Notice tone="warning">{reason}</Notice>}
            {error && <Notice tone="danger">{error}</Notice>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3" role="group" aria-label="PIN keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <PadKey key={d} label={d} onPress={() => press(d)} disabled={busy} />
          ))}
          <span />
          <PadKey label="0" onPress={() => press('0')} disabled={busy} />
          <button
            type="button"
            aria-label="Delete digit"
            onClick={() => setPin((p) => p.slice(0, -1))}
            className="flex h-18 w-18 items-center justify-center rounded-lg text-text-muted hover:text-text-primary"
          >
            <Delete size={26} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

function PadKey({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className="flex h-18 w-18 items-center justify-center rounded-lg border border-border-subtle bg-bg-elevated font-display text-3xl font-semibold transition active:scale-95 active:bg-accent-gold active:text-text-inverse disabled:opacity-50"
    >
      {label}
    </button>
  );
}

/** Unlocked: 16:9 zero-scroll split grid (scoreboard + cards left, keypad right). */
function ScorerConsole({ onLock }: { onLock: () => void }) {
  const { peers } = useTransportContext();
  const state = useTournamentState()!;
  const scorers = countActiveScorers(peers);
  const next = upNextMatch(state);

  return (
    <div className="touch-route flex h-dvh flex-col overflow-hidden bg-bg-primary">
      {scorers > 1 && (
        <div role="alert" className="animate-pulse bg-accent-danger px-4 py-3 text-center font-display text-lg font-bold tracking-wide text-text-primary uppercase">
          <ShieldAlert size={22} className="mr-2 inline align-[-4px]" aria-hidden />
          Warning: multiple scorer devices connected — rotate PIN in admin
        </div>
      )}
      <RouteHeader
        icon={Crosshair}
        title="Table Scorer"
        subtitle={state.meta?.name}
        actions={
          <>
            <PingIndicator />
            <ConnectionBadge />
            <FullscreenButton />
            <Button size="sm" icon={Lock} onClick={onLock} aria-label="Lock scorer">
              <span className="hidden xl:inline">Lock</span>
            </Button>
          </>
        }
      />
      <main className="grid min-h-0 flex-1 grid-cols-2 gap-4 p-4">
        <section className="surface flex min-h-0 flex-col gap-4 p-4">
          <h2 className="font-display text-sm tracking-widest text-text-muted uppercase">Up Next</h2>
          {next ? <Matchup state={state} match={next} /> : <p className="text-text-muted">All matches have been played.</p>}
          <div className="mt-auto">
            <Placeholder milestone={3}>Live scoreboard, checkout routes and owned Power Cards render here.</Placeholder>
          </div>
        </section>
        <section className="surface flex min-h-0 flex-col p-4">
          <h2 className="font-display text-sm tracking-widest text-text-muted uppercase">Dart Keypad</h2>
          <div className="mt-3 flex-1">
            <Placeholder milestone={3}>Start match, starting order and the 1-tap per-dart keypad (48 px+ targets) with Undo Last Dart.</Placeholder>
          </div>
        </section>
      </main>
    </div>
  );
}
