import { Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Matchup } from '../components/Matchup.tsx';
import { NoTournament } from '../components/NoTournament.tsx';
import { FullscreenButton } from '../components/StatusIndicators.tsx';
import { upNextMatch } from '../engine/selectors.ts';
import { useLiveTournamentId } from '../hooks/ControlProvider.tsx';
import { TournamentScope, useTournamentState, useTransportContext } from '../hooks/TransportProvider.tsx';
import { usePresenceRole } from '../hooks/useTransport.ts';

export function StagePage() {
  const id = useLiveTournamentId();
  return (
    <div className="touch-route group relative h-dvh overflow-hidden bg-bg-primary [background:var(--surface-gradient)]">
      <div className="absolute top-4 right-4 z-10 opacity-0 transition-opacity group-hover:opacity-100">
        <FullscreenButton />
      </div>
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

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="font-mono text-4xl text-accent-gold">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>;
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

/** Projector kiosk: no admin or scoring controls. */
function StageLive() {
  usePresenceRole('stage');
  const { status } = useTransportContext();
  const state = useTournamentState();
  if (!state) return <StageIdle />;
  const next = upNextMatch(state);

  return (
    <div className="flex h-full flex-col p-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Target size={44} className="text-accent-primary" aria-hidden />
          <h1 className="font-display text-4xl font-bold tracking-wider uppercase">{state.meta?.name}</h1>
        </div>
        <Clock />
      </header>
      <main className="flex flex-1 items-center justify-center">
        {next ? (
          <div className="w-full max-w-6xl space-y-10">
            <p className="text-center font-display text-3xl tracking-[0.4em] text-text-muted uppercase">Next Match</p>
            <Matchup state={state} match={next} size="xl" />
          </div>
        ) : (
          <p className="font-display text-5xl uppercase">All matches complete</p>
        )}
      </main>
      <span
        className={`absolute bottom-4 left-4 h-2.5 w-2.5 rounded-full ${status === 'connected' ? 'bg-accent-success' : 'bg-accent-warning'}`}
        title={status}
      />
    </div>
  );
}
